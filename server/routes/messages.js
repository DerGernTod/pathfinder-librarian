import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createMessageSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { getDb, getUserId, getVectorDb } from "../utils/context.js";
import { RetryableError, getLlmResponse } from "../utils/llm-client.js";
import { queryRagContext } from "../utils/rag-query.js";
import { paramSchema } from "./conversations-schema.js";

const validateId = zValidator("param", paramSchema);

let firstMessageCounter = 0;

/**
 * Resolves a stat-block with ruleItemId to one with full creature data.
 * @param {import("bun:sqlite").Database} database
 * @param {{ type: "stat-block", title: string, ruleItemId: string }} block
 * @returns {import("../../shared/types.js").MessageBlock}
 */
function resolveStatBlock(database, block) {
    const ruleItem = queries.getRuleItemById(database, block.ruleItemId);
    if (!ruleItem) {
        return { type: "paragraph", text: `Creature not found: ${block.title}` };
    }

    /** @type {import("../../shared/types.js").CreatureData} */
    const data = /** @type {import("../../shared/types.js").CreatureData} */ (ruleItem.data);

    // Merge child items (melee, spellcasting, actions) into creature data
    const children = queries.getChildItems(database, block.ruleItemId);
    if (children.length > 0) {
        /** @type {import("../../shared/types.js").MeleeEntry[]} */
        const melee = [];
        /** @type {import("../../shared/types.js").SpellcastingEntry[]} */
        const spellcasting = [];
        /** @type {import("../../shared/types.js").ActionEntry[]} */
        const actions = [];
        for (const child of children) {
            if (child.type === "melee") {
                melee.push(
                    /** @type {import("../../shared/types.js").MeleeEntry} */ (
                        /** @type {unknown} */ (child.data)
                    ),
                );
            } else if (child.type === "spellcastingEntry") {
                spellcasting.push(
                    /** @type {import("../../shared/types.js").SpellcastingEntry} */ (
                        /** @type {unknown} */ (child.data)
                    ),
                );
            } else if (child.type === "action") {
                actions.push(
                    /** @type {import("../../shared/types.js").ActionEntry} */ (
                        /** @type {unknown} */ (child.data)
                    ),
                );
            }
        }
        if (melee.length > 0) {
            data.melee = melee;
        }
        if (spellcasting.length > 0) {
            data.spellcasting = spellcasting;
        }
        if (actions.length > 0) {
            data.actions = actions;
        }
    }

    const { ruleItemId: _id, ...blockWithoutId } = block;
    return { ...blockWithoutId, data };
}

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
                            db,
                            vectorDb,
                            topN: 5,
                            threshold: 0.3,
                        });

                        // Get LLM response with automatic retry on 503
                        const MAX_RETRIES = 3;
                        const RETRY_DELAY_MS = 30000;
                        /** @type {import("../../shared/types.js").MessageBlock[] | undefined} */
                        let llmBlocks;
                        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                            try {
                                llmBlocks = await getLlmResponse(
                                    data.content,
                                    ragContext.contextText,
                                    data.mode,
                                );
                                break;
                            } catch (error) {
                                if (!(error instanceof RetryableError)) {
                                    throw error;
                                }
                                if (attempt < MAX_RETRIES - 1) {
                                    try {
                                        controller.enqueue(
                                            JSON.stringify({
                                                type: "retryScheduled",
                                                data: {
                                                    delay: 30,
                                                    attempt: attempt + 1,
                                                    maxAttempts: MAX_RETRIES,
                                                },
                                            }) + "\n",
                                        );
                                    } catch {
                                        break;
                                    }
                                    await new Promise((resolve) =>
                                        setTimeout(resolve, RETRY_DELAY_MS),
                                    );
                                } else {
                                    try {
                                        controller.enqueue(
                                            JSON.stringify({
                                                type: "retryFailed",
                                                data: {
                                                    message:
                                                        "The AI service is temporarily unavailable after multiple attempts. Please try again later.",
                                                },
                                            }) + "\n",
                                        );
                                    } catch {
                                        // Client disconnected
                                    }
                                }
                            }
                        }
                        if (llmBlocks) {
                            for (const block of llmBlocks) {
                                // Resolve stat-block references to full creature data
                                const resolved =
                                    block.type === "stat-block" && block.ruleItemId
                                        ? resolveStatBlock(
                                              db,
                                              /** @type {{ type: "stat-block", title: string, ruleItemId: string }} */ (
                                                  block
                                              ),
                                          )
                                        : block;
                                blocks.push(resolved);
                                controller.enqueue(
                                    JSON.stringify({
                                        type: "assistantChunk",
                                        data: resolved,
                                    }) + "\n",
                                );
                                await new Promise((resolve) => setTimeout(resolve, 100));
                            }
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
