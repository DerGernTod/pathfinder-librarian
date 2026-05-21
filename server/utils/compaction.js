import { CONVERSATION_CONFIG } from "../../shared/constants.js";
import { getConversationById, updateCompactedSummary } from "../db/queries.js";
import { shouldCompact } from "./conversation-history.js";
import { callGeminiForSummarization } from "./llm-client.js";

/**
 * Orchestrate summarization and storage of old conversation messages.
 * Returns the summary text, or null if compaction was not needed.
 * Throws if summarization API call fails.
 * @param {import("bun:sqlite").Database} db
 * @param {string} conversationId
 * @param {Array<{ role: string, parts: Array<{ text: string }> }>} contents
 * @param {number} [threshold]
 * @returns {Promise<string | null>}
 */
export async function compactConversation(db, conversationId, contents, threshold) {
    const conversation = getConversationById(db, conversationId);
    if (conversation?.compactedSummary) {
        return null;
    }

    if (!shouldCompact(contents, threshold)) {
        return null;
    }

    const keepRecent = CONVERSATION_CONFIG.COMPACTION_KEEP_RECENT_TURNS * 2;
    if (contents.length <= keepRecent) {
        return null;
    }

    const oldTurns = contents.slice(0, -keepRecent);
    const messagesText = oldTurns
        .map((turn) => `${turn.role}: ${turn.parts.map((p) => p.text).join("\n")}`)
        .join("\n\n");

    const summary = await callGeminiForSummarization(messagesText);
    if (summary) {
        updateCompactedSummary(db, conversationId, summary);
    }
    return summary;
}
