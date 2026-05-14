import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createMessageSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { getDb, getUserId, getVectorDb } from "../utils/context.js";
import { getLlmResponse } from "../utils/llm-client.js";
import { queryRagContext } from "../utils/rag-query.js";
import { paramSchema } from "./conversations-schema.js";

const validateId = zValidator("param", paramSchema);

let firstMessageCounter = 0;

export const messagesRouter = new Hono()
    .get("/", validateId, async (c) => {
        const db = getDb(c);
        const convId = c.req.valid("param").id;
        const conv = queries.getConversationById(db, convId);
        if (!conv) {
            return c.json({ result: /** @type {"error"} */ ("error"), message: "Not found" }, 404);
        }
        return c.json({ result: /** @type {"success"} */ ("success"), data: conv });
    })
    .get("/messages", validateId, async (c) => {
        const db = getDb(c);
        const convId = c.req.valid("param").id;
        const messagesList = queries.getMessagesByConversationId(db, convId);
        return c.json({ result: /** @type {"success"} */ ("success"), data: messagesList });
    })
    .post("/messages", validateId, zValidator("json", createMessageSchema), async (c) => {
        const db = getDb(c);
        const convId = c.req.valid("param").id;
        const data = c.req.valid("json");

        let actualConvId = convId;
        let conversationCreated = false;

        // Handle special "__new__" ID - creates conversation first
        if (convId === "__new__") {
            const userId = getUserId(c);
            firstMessageCounter++;
            const title = `New Chat ${firstMessageCounter}`;
            const conv = queries.createConversation(db, { title, userId });
            actualConvId = conv.id;
            conversationCreated = true;
        }

        // 1. Create user message
        const userMsg = queries.createMessage(db, {
            conversationId: actualConvId,
            role: "user",
            mode: data.mode,
            content: data.content,
            blocksJson: null,
        });

        // 2. Stream assistant response
        return new Response(
            new ReadableStream({
                async start(controller) {
                    // Send conversation first if created (so client can update URL)
                    if (conversationCreated) {
                        const newConv = queries.getConversationById(db, actualConvId);
                        controller.enqueue(
                            JSON.stringify({ type: "conversation", data: newConv }) + "\n",
                        );
                    }

                    // Send user message first
                    controller.enqueue(
                        JSON.stringify({ type: "userMessage", data: userMsg }) + "\n",
                    );

                    const blocks = [];
                    try {
                        // Retrieve RAG context from vector DB
                        const vectorDb = getVectorDb(c);
                        const ragContext = await queryRagContext(data.content, {
                            vectorDb,
                            topN: 5,
                            threshold: 0.3,
                        });

                        // Get LLM response with RAG context (JSON mode, falls back to mock)
                        const llmBlocks = await getLlmResponse(
                            data.content,
                            ragContext.contextText,
                            data.mode,
                        );
                        for (const block of llmBlocks) {
                            blocks.push(block);
                            controller.enqueue(
                                JSON.stringify({ type: "assistantChunk", data: block }) + "\n",
                            );
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                    } catch (error) {
                        // oxlint-disable-next-line no-console
                        console.error("Error streaming assistant response:", error);
                    } finally {
                        // Save assistant message to DB
                        const assistantMsg = queries.createMessage(db, {
                            conversationId: actualConvId,
                            role: "assistant",
                            mode: data.mode,
                            content: null,
                            blocksJson: JSON.stringify(blocks),
                        });

                        try {
                            controller.enqueue(
                                JSON.stringify({ type: "assistantComplete", data: assistantMsg }) +
                                    "\n",
                            );
                            controller.close();
                        } catch {
                            // Controller might already be closed if the client disconnected
                        }
                    }
                },
            }),
            {
                headers: {
                    "Content-Type": "text/plain",
                },
            },
        );
    });
