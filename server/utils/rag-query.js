import { createEmbeddings } from "../../scripts/lib/google-ai-client.js";
import { QDRANT_CONFIG, RAG_CONFIG } from "../../shared/constants.js";
import { getParentItem, getRuleItemById } from "../db/queries.js";
import { redactRagCreatureSection } from "./data-redaction.js";

/**
 * @typedef {import("../../shared/types.js").RagContext} RagContext
 * @typedef {import("../../shared/types.js").RagSource} RagSource
 * @typedef {import("./vector-store.js").VectorStore} VectorStore
 */

/**
 * Generates a deterministic fake embedding from a string.
 * Used when MOCK_GOOGLE_AI=1 to avoid API calls in tests.
 * @param {string} text
 * @returns {number[]}
 */
function fakeEmbedding(text) {
    /** @type {number[]} */
    const embedding = [];
    for (let i = 0; i < 768; i++) {
        embedding.push(0);
    }
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        embedding[i % 768] += charCode / 65535;
    }
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] /= norm;
        }
    }
    return embedding;
}

/**
 * Convenience wrapper that creates a single embedding from a text prompt.
 * @param {string} prompt - The text to embed.
 * @param {string} apiKey - Google AI API key.
 * @param {string} model - Embedding model name.
 * @returns {Promise<number[]>}
 */
export async function createSingleEmbedding(prompt, apiKey, model) {
    if (process.env.MOCK_GOOGLE_AI === "1") {
        return fakeEmbedding(prompt);
    }
    const embeddings = await createEmbeddings(apiKey, model, [prompt]);
    return embeddings[0];
}

/**
 * Orchestrates the full RAG pipeline: embed → search → deduplicate → format.
 *
 * rag-query OWNS the rule_item_id dedup over-fetch: it inflates the user-facing
 * `topN` via `max(topN * SEARCH_OVERFETCH_FACTOR, SEARCH_MIN_LIMIT)` and passes
 * that to VectorStore.search(), which queries Qdrant with `limit = topN` and
 * performs NO further multiplication.
 *
 * @param {string} userPrompt - The user's question.
 * @param {{ vectorStore?: VectorStore | null, db?: import("bun:sqlite").Database | null, topN?: number, threshold?: number, apiKey?: string, model?: string, mode?: string }} options
 * @returns {Promise<RagContext>}
 */
export async function queryRagContext(userPrompt, options = {}) {
    const embeddingTokens = Math.ceil(userPrompt.length / 4);
    const vectorStore = options.vectorStore ?? null;
    const mainDb = options.db ?? null;
    const topN = options.topN ?? RAG_CONFIG.TOP_N;
    const threshold = options.threshold ?? RAG_CONFIG.SIMILARITY_THRESHOLD;
    const apiKey = options.apiKey ?? process.env.GOOGLE_AI_API_KEY ?? "";
    const model = options.model ?? RAG_CONFIG.EMBEDDING_MODEL;
    const mode = options.mode ?? "gm";

    if (!vectorStore) {
        return { contextText: "", sources: [], embeddingTokens: 0 };
    }
    if (!vectorStore.isAvailable()) {
        try {
            await vectorStore.ensureCollection();
        } catch {
            // Qdrant unreachable; RAG degrades silently.
        }
    }
    if (!vectorStore.isAvailable()) {
        return { contextText: "", sources: [], embeddingTokens: 0 };
    }
    if (!apiKey) {
        return { contextText: "", sources: [], embeddingTokens: 0 };
    }

    try {
        const queryEmbedding = await createSingleEmbedding(userPrompt, apiKey, model);

        const overfetch = Math.max(
            topN * QDRANT_CONFIG.SEARCH_OVERFETCH_FACTOR,
            QDRANT_CONFIG.SEARCH_MIN_LIMIT,
        );
        const scored = await vectorStore.search(queryEmbedding, { topN: overfetch, threshold });

        /** @type {Map<string, { chunk: import("./vector-store.js").VectorChunkLite, score: number }>} */
        const deduped = new Map();
        for (const entry of scored) {
            const key = entry.chunk.ruleItemId;
            if (!deduped.has(key)) {
                deduped.set(key, entry);
            }
        }

        const topResults = [...deduped.values()].slice(0, topN);

        if (topResults.length === 0) {
            return { contextText: "", sources: [], embeddingTokens };
        }

        const contextParts = topResults.map((entry) => {
            const { chunk } = entry;
            /** @type {string[]} */
            const parts = [
                `--- ${chunk.ruleItemName} (${chunk.ruleItemType}) [ID: ${chunk.ruleItemId}] ---`,
            ];
            parts.push(chunk.text);

            if (mainDb) {
                const ruleItem = getRuleItemById(mainDb, chunk.ruleItemId);
                if (ruleItem) {
                    /** @type {{ description?: string }} */
                    const data = /** @type {{ description?: string }} */ (ruleItem.data);

                    if (data.description) {
                        parts.push(`\nDescription: ${data.description}`);
                    }

                    if (ruleItem.parentId) {
                        const parent = getParentItem(mainDb, chunk.ruleItemId);
                        if (parent) {
                            parts.push(
                                `\nParent: ${parent.name} (${parent.type}) [ID: ${parent.id}]`,
                            );
                            /** @type {{ description?: string }} */
                            const parentData = /** @type {{ description?: string }} */ (
                                parent.data
                            );
                            if (parentData.description) {
                                parts.push(`Parent Description: ${parentData.description}`);
                            }
                        }
                    }
                }
            }

            return parts.join("\n");
        });

        if (mode === "player") {
            for (let i = 0; i < topResults.length; i++) {
                if (topResults[i].chunk.ruleItemType === "creature") {
                    contextParts[i] = redactRagCreatureSection(contextParts[i]);
                }
            }
        }

        const contextText =
            `<retrieved-context>\n` + contextParts.join("\n\n") + `\n</retrieved-context>`;

        /** @type {RagSource[]} */
        const sources = topResults.map((entry) => ({
            name: entry.chunk.ruleItemName,
            type: entry.chunk.ruleItemType,
            score: entry.score,
        }));

        return { contextText, sources, embeddingTokens };
    } catch (error) {
        return {
            contextText: `Error in queryRagContext: ${String(error)}`,
            sources: [],
            embeddingTokens: 0,
        };
    }
}
