import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createMessageSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { compactConversation } from "../utils/compaction.js";
import { getDb, getUserId, getVectorDb } from "../utils/context.js";
import { formatConversationForLlm, shouldCompact } from "../utils/conversation-history.js";
import { redactCreatureDataForPlayer } from "../utils/data-redaction.js";
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
 * @param {string} mode - "player" or "gm"
 * @returns {import("../../shared/types.js").MessageBlock}
 */
function resolveStatBlock(database, block, mode) {
    const ruleItem = queries.getRuleItemById(database, block.ruleItemId);
    if (!ruleItem) {
        return {
            type: "text",
            markdown: `Creature not found: **${block.title}**`,
        };
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

    // Resolve creature trait names → rule item IDs
    if (data.traits?.length) {
        const traitMap = queries.getRuleItemsByTypeAndNames(database, "trait", data.traits);
        data.traitRefs = data.traits.map((name) => {
            const found = traitMap.get(name);
            return { name, ruleItemId: found?.id };
        });
    }

    // Resolve action trait names → rule item IDs (enables interactive tags)
    if (data.actions?.length) {
        const actionTraitNames = [...new Set(data.actions.flatMap((a) => a.traits ?? []))];
        if (actionTraitNames.length > 0) {
            const traitMap = queries.getRuleItemsByTypeAndNames(
                database,
                "trait",
                actionTraitNames,
            );
            for (const action of data.actions) {
                if (action.traits?.length) {
                    action.traitRefs = action.traits.map((name) => ({
                        name,
                        ruleItemId: traitMap.get(name)?.id,
                    }));
                }
            }
        }
    }

    // Resolve melee trait names → rule item IDs (enables interactive tags)
    if (data.melee?.length) {
        const meleeTraitNames = [...new Set(data.melee.flatMap((m) => m.traits ?? []))];
        if (meleeTraitNames.length > 0) {
            const traitMap = queries.getRuleItemsByTypeAndNames(database, "trait", meleeTraitNames);
            for (const melee of data.melee) {
                if (melee.traits?.length) {
                    melee.traitRefs = melee.traits.map((name) => ({
                        name,
                        ruleItemId: traitMap.get(name)?.id,
                    }));
                }
            }
        }
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

    const { ruleItemId: _id, title: blockTitle, ...blockWithoutId } = block;
    // Fall back to the creature's name from the DB if the LLM omitted the title.

    if (mode === "player") {
        const redactedData = redactCreatureDataForPlayer(data);
        return {
            ...blockWithoutId,
            title: blockTitle ?? ruleItem.name,
            data: redactedData,
            redacted: true,
        };
    }

    return { ...blockWithoutId, title: blockTitle ?? ruleItem.name, data };
}

/**
 * Resolves a rule-detail block with ruleItemId to one with full item data.
 * Returns null when the item is not found so the caller can drop it.
 * @param {import("bun:sqlite").Database} db
 * @param {{ type: "rule-detail", ruleItemId: string }} block
 * @returns {import("../../shared/types.js").MessageBlock | null}
 */
function resolveRuleDetail(db, block) {
    const item = queries.getRuleItemById(db, block.ruleItemId);
    if (!item) {
        // The LLM produced an ID that doesn't exist — drop the block rather
        // than rendering an empty, meaningless card.
        return null;
    }
    const itemData = /** @type {Record<string, unknown>} */ (item.data ?? {});
    let rawDescription =
        typeof itemData.description === "string" ? itemData.description : undefined;

    // Resolve @Localize and @UUID references in the description, same as
    // resolveStatBlock does for action descriptions.
    if (rawDescription) {
        const localizations = loadLocalizations();
        rawDescription = resolveLocalizeRefs(rawDescription, localizations);
        const resolved = resolveUuidRefs(rawDescription, db);
        rawDescription = resolved.segments.length > 0 ? undefined : resolved.text;
        return /** @type {import("../../shared/types.js").MessageBlock} */ ({
            type: "rule-detail",
            title: item.name,
            category: item.type,
            description: rawDescription,
            descriptionSegments: resolved.segments.length > 0 ? resolved.segments : undefined,
            traits: Array.isArray(itemData.traits) ? itemData.traits : undefined,
        });
    }

    return {
        type: "rule-detail",
        title: item.name,
        category: item.type,
        description: rawDescription,
        traits: Array.isArray(itemData.traits) ? itemData.traits : undefined,
    };
}

/**
 * Resolves LLM block references (stat-block, rule-detail) to their full data.
 * Drops rule-detail blocks whose ruleItemId doesn't resolve to a DB item
 * rather than emitting empty cards.
 * @param {import("bun:sqlite").Database} db
 * @param {import("../../shared/types.js").MessageBlock[]} llmBlocks
 * @param {string} mode - "player" or "gm"
 * @returns {import("../../shared/types.js").MessageBlock[]}
 */
function resolveBlocks(db, llmBlocks, mode) {
    /** @type {import("../../shared/types.js").MessageBlock[]} */
    const result = [];
    for (const block of llmBlocks) {
        if (block.type === "stat-block" && block.ruleItemId) {
            result.push(
                resolveStatBlock(
                    db,
                    /** @type {{ type: "stat-block", title: string, ruleItemId: string }} */ (
                        block
                    ),
                    mode,
                ),
            );
        } else if (block.type === "rule-detail" && "ruleItemId" in block && block.ruleItemId) {
            const resolved = resolveRuleDetail(
                db,
                /** @type {{ type: "rule-detail", ruleItemId: string }} */ (block),
            );
            if (resolved !== null) {
                result.push(resolved);
            }
        } else {
            result.push(block);
        }
    }
    return result;
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
 * @param {{ contents: Array<{role: string, parts: Array<{text: string}>}>, contextText: string, mode: string, userId: string, ungrounded: boolean }} params
 * @param {(event: object) => boolean} notify
 * @returns {Promise<import("../../shared/types.js").MessageBlock[] | undefined>}
 */
async function getLlmResponseWithRetry(
    { contents, contextText, mode, userId, ungrounded },
    notify,
) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await getLlmResponse(contents, contextText, mode, userId, ungrounded);
        } catch (error) {
            if (!(error instanceof RetryableError)) {
                throw error;
            }
            if (attempt < MAX_RETRIES - 1) {
                const connected = notify({
                    type: "retryScheduled",
                    data: {
                        delay: 30,
                        attempt: attempt + 1,
                        maxAttempts: MAX_RETRIES,
                    },
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
    /** @type {number} */
    let ragResultCount = 0;
    try {
        const ragContext = await queryRagContext(data.content, {
            db,
            vectorDb,
            topN: 5,
            threshold: 0.3,
            mode: data.mode,
        });
        ragResultCount = ragContext.sources.length;
        const isUngrounded = ragResultCount === 0;

        const llmContents = formatConversationForLlm(db, actualConvId);

        try {
            await compactConversation(db, actualConvId, llmContents);
        } catch (compactionError) {
            // oxlint-disable-next-line no-console
            console.error("Compaction failed:", compactionError);
            if (shouldCompact(llmContents)) {
                tryEnqueue(controller, {
                    type: "compactionWarning",
                    data: {
                        message:
                            "This conversation is getting long. If the AI can't respond, try starting a new conversation.",
                    },
                });
            }
        }

        const llmBlocks = await getLlmResponseWithRetry(
            {
                contents: llmContents,
                contextText: ragContext.contextText,
                mode: data.mode,
                userId,
                ungrounded: isUngrounded,
            },
            (event) => tryEnqueue(controller, event),
        );

        /** @type {import("../../shared/types.js").MessageBlock[]} */
        const resolvedBlocks = resolveBlocks(db, llmBlocks ?? [], data.mode);

        if (isUngrounded) {
            const disclaimerCallout = {
                type: /** @type {const} */ ("callout"),
                title: "⚠ No Database Match",
                markdown:
                    "This answer is based on general knowledge — no matching rules data was found in the database. Details may be inaccurate for Pathfinder 2e.",
            };
            resolvedBlocks.unshift(disclaimerCallout);
        }

        for (const resolved of resolvedBlocks) {
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
        tryEnqueue(controller, {
            type: "assistantComplete",
            data: { ...assistantMsg, ragMeta: { resultCount: ragResultCount } },
        });
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
            return c.json(
                {
                    result: /** @type {"error"} */ ("error"),
                    message: "Not found",
                },
                404,
            );
        }
        return c.json({
            result: /** @type {"success"} */ ("success"),
            data: conv,
        });
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
