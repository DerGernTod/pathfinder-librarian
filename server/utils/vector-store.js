import { Database } from "bun:sqlite";
import { existsSync } from "fs";

import { unpackEmbedding } from "../../scripts/create-vector-db.js";

/** @type {Database | null | undefined} */
let cachedVectorDb = undefined;

/**
 * Opens the vector database. Returns null gracefully if file doesn't exist.
 * Caches singleton to avoid repeated file-exists checks.
 * @param {string} [dbPath] - Path to the vector DB file. Defaults to env VECTOR_DB_PATH or "data/vectors.sqlite".
 * @returns {Database | null}
 */
export function openVectorDb(dbPath) {
    if (cachedVectorDb !== undefined) {
        return cachedVectorDb;
    }

    const path = dbPath || process.env.VECTOR_DB_PATH || "data/vectors.sqlite";

    // Allow :memory: for testing
    if (path === ":memory:") {
        const vdb = new Database(path);
        vdb.exec("PRAGMA journal_mode=WAL");
        vdb.exec(CREATE_VECTOR_TABLE_SQL);
        cachedVectorDb = vdb;
        return vdb;
    }

    if (!existsSync(path)) {
        cachedVectorDb = null;
        return null;
    }

    const vdb = new Database(path);
    vdb.exec("PRAGMA journal_mode=WAL");
    cachedVectorDb = vdb;
    return vdb;
}

/**
 * Resets the cached vector DB singleton. Useful for testing.
 */
export function resetVectorDbCache() {
    cachedVectorDb = undefined;
}

/** SQL to create the vector_chunks table. */
const CREATE_VECTOR_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS vector_chunks (
    id TEXT PRIMARY KEY,
    rule_item_id TEXT NOT NULL,
    rule_item_name TEXT NOT NULL,
    rule_item_type TEXT NOT NULL,
    compendium_source TEXT,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding BLOB,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_rule_item ON vector_chunks(rule_item_id);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_type ON vector_chunks(rule_item_type);
`;

/**
 * @typedef {{ id: string, ruleItemId: string, ruleItemName: string, ruleItemType: string, compendiumSource: string | null, text: string, embedding: number[] }} ChunkWithEmbedding
 */

/**
 * Gets all chunk embeddings from the vector DB, unpacking BLOBs.
 * Filters out rows with null embeddings.
 * @param {Database} vdb
 * @returns {ChunkWithEmbedding[]}
 */
export function getAllChunkEmbeddings(vdb) {
    const rows = vdb
        .query(
            "SELECT id, rule_item_id, rule_item_name, rule_item_type, compendium_source, text, embedding FROM vector_chunks",
        )
        .all();

    /** @type {ChunkWithEmbedding[]} */
    const result = [];
    for (const row of rows) {
        if (!row.embedding) {
            continue;
        }
        /** @type {ChunkWithEmbedding} */
        const chunk = {
            id: String(row.id),
            ruleItemId: String(row.rule_item_id),
            ruleItemName: String(row.rule_item_name),
            ruleItemType: String(row.rule_item_type),
            compendiumSource: row.compendium_source ? String(row.compendium_source) : null,
            text: String(row.text),
            embedding: unpackEmbedding(/** @type {Buffer} */ (row.embedding)),
        };
        result.push(chunk);
    }
    return result;
}

/**
 * Computes cosine similarity between two vectors.
 * Returns 0 for zero-length vectors.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
export function cosineSimilarity(vecA, vecB) {
    const len = Math.min(vecA.length, vecB.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches the vector DB for chunks similar to the query embedding.
 * @param {Database} vdb
 * @param {number[]} queryEmbedding
 * @param {number} topN - Maximum number of results to return.
 * @param {number} threshold - Minimum cosine similarity score.
 * @returns {Array<{ chunk: ChunkWithEmbedding, score: number }>}
 */
export function searchVectorDb(vdb, queryEmbedding, topN, threshold) {
    const allChunks = getAllChunkEmbeddings(vdb);

    /** @type {Array<{ chunk: ChunkWithEmbedding, score: number }>} */
    const scored = [];
    for (const chunk of allChunks) {
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        if (score >= threshold) {
            scored.push({ chunk, score });
        }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topN);
}

/**
 * Gets all chunks for a specific rule item ID (for parent enrichment).
 * @param {Database} vdb
 * @param {string} ruleItemId
 * @returns {Array<{ id: string, text: string, chunkIndex: number }>}
 */
export function getChunksByRuleItemId(vdb, ruleItemId) {
    const rows = vdb
        .query(
            "SELECT id, text, chunk_index FROM vector_chunks WHERE rule_item_id = ? ORDER BY chunk_index",
        )
        .all(ruleItemId);

    return rows.map((row) => ({
        id: String(row.id),
        text: String(row.text),
        chunkIndex: Number(row.chunk_index),
    }));
}
