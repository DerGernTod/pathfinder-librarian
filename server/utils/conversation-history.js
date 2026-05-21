import { CONVERSATION_CONFIG } from "../../shared/constants.js";
import { getConversationById, getMessagesByConversationId } from "../db/queries.js";

/**
 * Serializes assistant message blocks to a readable text string.
 * @param {import("../../shared/types.js").MessageBlock[] | null} blocks
 * @returns {string}
 */
export function serializeBlocks(blocks) {
    if (!blocks || !Array.isArray(blocks)) {
        return "";
    }
    const parts = [];
    for (const block of blocks) {
        if (!block || typeof block !== "object" || !block.type) {
            continue;
        }
        switch (block.type) {
            case "text": {
                parts.push(block.markdown ?? "");
                break;
            }
            case "callout": {
                parts.push(`[${block.title ?? "Callout"}] ${block.markdown ?? ""}`);
                break;
            }
            case "stat-block": {
                parts.push(`[Stat Block: ${block.title ?? "Creature"}]`);
                break;
            }
            case "rule-detail": {
                parts.push(`[Rule Detail: ${block.title ?? "Item"}]`);
                break;
            }
        }
    }
    return parts.join("\n\n");
}

/**
 * Estimates token count for a contents array (~4 chars per token).
 * @param {Array<{ role: string, parts: Array<{ text: string }> }>} contents
 * @returns {number}
 */
export function estimateTokenCount(contents) {
    let totalChars = 0;
    for (const turn of contents) {
        for (const part of turn.parts) {
            totalChars += part.text.length;
        }
    }
    return Math.ceil(totalChars / 4);
}

/**
 * Returns true if estimated token count exceeds the compaction threshold.
 * @param {Array<{ role: string, parts: Array<{ text: string }> }>} contents
 * @param {number} [threshold]
 * @returns {boolean}
 */
export function shouldCompact(
    contents,
    threshold = CONVERSATION_CONFIG.COMPACTION_THRESHOLD_TOKENS,
) {
    return estimateTokenCount(contents) > threshold;
}

/**
 * Builds a Gemini-compatible contents array from conversation history.
 * Expects the current user message to already be persisted in the DB.
 * @param {import("bun:sqlite").Database} db
 * @param {string} conversationId
 * @returns {Array<{ role: string, parts: Array<{ text: string }> }>}
 */
export function formatConversationForLlm(db, conversationId) {
    const messages = getMessagesByConversationId(db, conversationId);
    const conversation = getConversationById(db, conversationId);

    /** @type {Array<{ role: string, parts: Array<{ text: string }> }>} */
    const contents = [];

    if (conversation?.compactedSummary) {
        contents.push({
            role: "user",
            parts: [
                {
                    text: `[Previous conversation summary]\n${conversation.compactedSummary}`,
                },
            ],
        });
        contents.push({
            role: "model",
            parts: [
                {
                    text: "Understood. I will use this conversation summary as context for our ongoing discussion.",
                },
            ],
        });
    }

    const windowLimit = CONVERSATION_CONFIG.MAX_HISTORY_TURNS * 2;
    const windowedMessages = messages.slice(-windowLimit);

    for (const message of windowedMessages) {
        if (message.role === "user") {
            contents.push({
                role: "user",
                parts: [{ text: message.content ?? "" }],
            });
        } else if (message.role === "assistant") {
            const text = serializeBlocks(
                /** @type {import("../../shared/types.js").MessageBlock[] | null} */ (
                    message.blocks
                ),
            );
            contents.push({
                role: "model",
                parts: [{ text }],
            });
        }
    }

    return contents;
}
