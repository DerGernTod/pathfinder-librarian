import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createConversationSchema, firstMessageSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { getDb, getUserId } from "../utils/context.js";
import { messagesRouter } from "./messages.js";

let firstMessageCounter = 0;

/**
 * Creates a conversations sub-router.
 */
export const conversationsRouter = new Hono()
    .get("/", async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        return c.json({
            result: /** @type {"success"} */ ("success"),
            data: queries.getConversationsByUser(db, userId),
        });
    })
    .post("/", zValidator("json", createConversationSchema), async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        const data = c.req.valid("json");
        const conv = queries.createConversation(db, { title: data.title, userId });
        return c.json({ result: /** @type {"success"} */ ("success"), data: conv }, 201);
    })
    .post("/first-message", zValidator("json", firstMessageSchema), async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        const data = c.req.valid("json");

        // Generate mock conversation name with counter
        firstMessageCounter++;
        const title = `New Chat ${firstMessageCounter}`;

        // Create conversation
        const conv = queries.createConversation(db, { title, userId });

        return new Response(
            new ReadableStream({
                async start(controller) {
                    // First, send conversation info
                    controller.enqueue(JSON.stringify({ type: "conversation", data: conv }) + "\n");

                    // Then create user message and stream response
                    const userMsg = queries.createMessage(db, {
                        conversationId: conv.id,
                        role: "user",
                        mode: data.mode || "player",
                        content: data.prompt,
                        blocksJson: null,
                    });

                    controller.enqueue(
                        JSON.stringify({ type: "userMessage", data: userMsg }) + "\n",
                    );

                    const { streamMockResponse } = await import("../utils/mock-response.js");
                    const blocks = [];
                    try {
                        for await (const block of streamMockResponse()) {
                            blocks.push(block);
                            controller.enqueue(
                                JSON.stringify({ type: "assistantChunk", data: block }) + "\n",
                            );
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                    } catch {
                        // Streaming interrupted
                    } finally {
                        const assistantMsg = queries.createMessage(db, {
                            conversationId: conv.id,
                            role: "assistant",
                            mode: data.mode || "player",
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
                            // Controller might already be closed
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
    })
    .route("/:id", messagesRouter);
