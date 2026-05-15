import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createMessageSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { getDb, getUserId, getVectorDb } from "../utils/context.js";
import { resolveLocalizeRefs, resolveUuidRefs, loadLocalizations } from "../utils/foundry-refs.js";
import { RetryableError, getLlmResponse } from "../utils/llm-client.js";
import { queryRagContext } from "../utils/rag-query.js";
import { paramSchema } from "./conversations-schema.js";

const validateId = zValidator("param", paramSchema);

let firstMessageCounter = 0;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000;
const CHUNK_DELAY_MS = 100;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Serialises and enqueues an event. Returns false if the client has already disconnected.
 * @param {ReadableStreamDefaultController} controller
 * @param {object} event
 * @returns {boolean}
 */
function tryEnqueue(controller, event) {
    try {
        controller.enqueue(JSON.stringify(event) + "\n");
        return true;
    } catch {
        return false;
    }
}

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

    const data = /** @type {import("../../shared/types.js").CreatureData} */ (ruleItem.data);
    const children = queries.getChildItems(database, block.ruleItemId);

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

    // Resolve trait names → rule item IDs
    if (data.traits?.length) {
        const traitMap = queries.getRuleItemsByTypeAndNames(database, "trait", data.traits);
        data.traitRefs = data.traits.map((name) => {
            const found = traitMap.get(name);
            return { name, ruleItemId: found?.id };
        });
    }

    // Resolve @UUID and @Localize in action descriptions
    const localizations = loadLocalizations();
    if (data.actions?.length) {
        for (const action of data.actions) {
            if (typeof action.description === "string") {
                action.description = resolveLocalizeRefs(action.description, localizations);
                const resolved = resolveUuidRefs(action.description, database);
                if (resolved.segments.length > 0) {
                    action.descriptionSegments = resolved.segments;
                }
            }
        }
    }

    const { ruleItemId: _id, ...blockWithoutId } = block;
    return { ...blockWithoutId, data };
}

/**
 * Resolves a rule-detail block with ruleItemId to one with full item data.
 * @param {import("bun:sqlite").Database} db
 * @param {{ type: "rule-detail", ruleItemId: string }} block
 * @returns {import("../../shared/types.js").MessageBlock}
 */
function resolveRuleDetail(db, block) {
    const item = queries.getRuleItemById(db, block.ruleItemId);
    if (!item) {
        return block;
    }
    const itemData = /** @type {Record<string, unknown>} */ (item.data ?? {});
    return {
        type: "rule-detail",
        title: item.name,
        category: item.type,
        description: typeof itemData.description === "string" ? itemData.description : undefined,
        traits: Array.isArray(itemData.traits) ? itemData.traits : undefined,
    };
}

/**
 * Resolves LLM block references (stat-block, rule-detail) to their full data.
 * @param {import("bun:sqlite").Database} db
 * @param {import("../../shared/types.js").MessageBlock[]} llmBlocks
 * @returns {import("../../shared/types.js").MessageBlock[]}
 */
function resolveBlocks(db, llmBlocks) {
    return llmBlocks.map((block) => {
        if (block.type === "stat-block" && block.ruleItemId) {
            return resolveStatBlock(
                db,
                /** @type {{ type: "stat-block", title: string, ruleItemId: string }} */ (block),
            );
        }
        if (block.type === "rule-detail" && "ruleItemId" in block && block.ruleItemId) {
            return resolveRuleDetail(
                db,
                /** @type {{ type: "rule-detail", ruleItemId: string }} */ (block),
            );
        }
        return block;
    });
}

/**
 * Handles the "__new__" conversation ID by creating a real conversation.
 * Returns the resolved ID and the new conversation object (null when pre-existing).
 * @param {string} convId
 * @param {import("bun:sqlite").Database} db
 * @param {string} userId
 * @returns {{ actualConvId: string, newConv: import("../../shared/types.js").Conversation | null }}
 */
function resolveConversation(convId, db, userId) {
    if (convId !== "__new__") {
        return { actualConvId: convId, newConv: null };
    }
    firstMessageCounter++;
    const conv = queries.createConversation(db, {
        title: `New Chat ${firstMessageCounter}`,
        userId,
    });
    const newConv = queries.getConversationById(db, conv.id);
    return { actualConvId: conv.id, newConv };
}

/**
 * Calls getLlmResponse with automatic retries on RetryableError.
 * Notifies the stream of retry events via `notify`; returns false from notify to abort retrying
 * (signals client disconnection).
 * @param {{ content: string, contextText: string, mode: string, userId: string }} params
 * @param {(event: object) => boolean} notify
 * @returns {Promise<import("../../shared/types.js").MessageBlock[] | undefined>}
 */
async function getLlmResponseWithRetry({ content, contextText, mode, userId }, notify) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await getLlmResponse(content, contextText, mode, userId);
        } catch (error) {
            if (!(error instanceof RetryableError)) {
                throw error;
            }
            if (attempt < MAX_RETRIES - 1) {
                const connected = notify({
                    type: "retryScheduled",
                    data: { delay: 30, attempt: attempt + 1, maxAttempts: MAX_RETRIES },
                });
                if (!connected) {
                    break;
                }
                await delay(RETRY_DELAY_MS);
            } else {
                notify({
                    type: "retryFailed",
                    data: {
                        message:
                            "The AI service is temporarily unavailable after multiple attempts. Please try again later.",
                    },
                });
            }
        }
    }
    return undefined;
}

/**
 * @typedef {{ content: string, mode: "player" | "gm" }} MessageData
 * @typedef {{
 *   db: import("bun:sqlite").Database,
 *   vectorDb: import("bun:sqlite").Database | null,
 *   userMsg: object,
 *   actualConvId: string,
 *   newConv: import("../../shared/types.js").Conversation | null,
 *   data: MessageData,
 *   userId: string,
 * }} StreamContext
 */

/**
 * Orchestrates the full SSE-style streaming response: sends the conversation (if newly created),
 * the user message, assistant chunks, and finally the persisted assistant message.
 * @param {ReadableStreamDefaultController} controller
 * @param {StreamContext} ctx
 */
async function runResponseStream(controller, ctx) {
    const { db, vectorDb, userMsg, actualConvId, newConv, data, userId } = ctx;

    if (newConv) {
        tryEnqueue(controller, { type: "conversation", data: newConv });
    }
    tryEnqueue(controller, { type: "userMessage", data: userMsg });

    const blocks = [];
    try {
        const ragContext = await queryRagContext(data.content, {
            db,
            vectorDb,
            topN: 5,
            threshold: 0.3,
        });

        const llmBlocks = await getLlmResponseWithRetry(
            {
                content: data.content,
                contextText: ragContext.contextText,
                mode: data.mode,
                userId,
            },
            (event) => tryEnqueue(controller, event),
        );

        for (const resolved of resolveBlocks(db, llmBlocks ?? [])) {
            blocks.push(resolved);
            tryEnqueue(controller, { type: "assistantChunk", data: resolved });
            await delay(CHUNK_DELAY_MS);
        }
    } catch (error) {
        // oxlint-disable-next-line no-console
        console.error("Error streaming assistant response:", error);
    } finally {
        const assistantMsg = queries.createMessage(db, {
            conversationId: actualConvId,
            role: "assistant",
            mode: data.mode,
            content: null,
            blocksJson: JSON.stringify(blocks),
        });
        tryEnqueue(controller, { type: "assistantComplete", data: assistantMsg });
        try {
            controller.close();
        } catch {
            // Controller might already be closed if the client disconnected
        }
    }
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
        return c.json({
            result: /** @type {"success"} */ ("success"),
            data: messagesList,
        });
    })
    .post("/messages", validateId, zValidator("json", createMessageSchema), async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        const convId = c.req.valid("param").id;
        const data = c.req.valid("json");

        const { actualConvId, newConv } = resolveConversation(convId, db, userId);

        const userMsg = queries.createMessage(db, {
            conversationId: actualConvId,
            role: "user",
            mode: data.mode,
            content: data.content,
            blocksJson: null,
        });

        const vectorDb = getVectorDb(c);
        const streamCtx = {
            db,
            vectorDb,
            userMsg,
            actualConvId,
            newConv,
            data,
            userId,
        };

        return new Response(
            new ReadableStream({
                start: (controller) => runResponseStream(controller, streamCtx),
            }),
            { headers: { "Content-Type": "text/plain" } },
        );
    });
