import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { packEmbedding } from "../../scripts/create-vector-db.js";
import {
    cosineSimilarity,
    getAllChunkEmbeddings,
    getChunksByRuleItemId,
    openVectorDb,
    resetVectorDbCache,
    searchVectorDb,
} from "./vector-store.js";

/**
 * @param {Database} db
 * @param {{ id: string, ruleItemId: string, ruleItemName: string, ruleItemType: string, compendiumSource?: string | null, chunkIndex: number, text: string, embedding?: number[] | null }} chunk
 */
function insertChunk(db, chunk) {
    const embeddingBlob = chunk.embedding ? packEmbedding(chunk.embedding) : null;
    db.run(
        "INSERT OR REPLACE INTO vector_chunks (id, rule_item_id, rule_item_name, rule_item_type, compendium_source, chunk_index, text, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            chunk.id,
            chunk.ruleItemId,
            chunk.ruleItemName,
            chunk.ruleItemType,
            chunk.compendiumSource ?? null,
            chunk.chunkIndex,
            chunk.text,
            embeddingBlob,
            new Date().toISOString(),
        ],
    );
}

describe("vector-store", () => {
    describe("cosineSimilarity", () => {
        it("returns 1.0 for identical vectors", () => {
            const vec = [1, 2, 3, 4];
            expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
        });

        it("returns 0.0 for orthogonal vectors", () => {
            const vecA = [1, 0, 0];
            const vecB = [0, 1, 0];
            expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0);
        });

        it("returns -1.0 for opposite vectors", () => {
            const vecA = [1, 2, 3];
            const vecB = [-1, -2, -3];
            expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0);
        });

        it("returns 0.0 for zero vectors", () => {
            expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0.0);
            expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0.0);
        });

        it("computes correct similarity for arbitrary vectors", () => {
            // [1,2,3] . [4,5,6] = 4+10+18 = 32
            // normA = sqrt(14), normB = sqrt(77) = sqrt(14*77) = sqrt(1078)
            // sim = 32/sqrt(1078) ≈ 0.9746
            const result = cosineSimilarity([1, 2, 3], [4, 5, 6]);
            expect(result).toBeCloseTo(0.9746, 3);
        });
    });

    describe("openVectorDb", () => {
        beforeEach(() => {
            resetVectorDbCache();
        });

        afterEach(() => {
            resetVectorDbCache();
        });

        it("returns null for non-existent path", () => {
            const result = openVectorDb("/tmp/nonexistent_vdb_test.sqlite");
            expect(result).toBeNull();
        });

        it("returns DB for valid in-memory path", () => {
            const result = openVectorDb(":memory:");
            expect(result).not.toBeNull();
            if (result) {
                result.close();
            }
        });
    });

    describe("getAllChunkEmbeddings and searchVectorDb", () => {
        /** @type {Database} */
        let vdb;

        beforeEach(() => {
            vdb = new Database(":memory:");
            vdb.exec("PRAGMA journal_mode=WAL");
            vdb.exec(`
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
            `);
        });

        afterEach(() => {
            if (vdb) {
                vdb.close();
            }
        });

        it("getAllChunkEmbeddings unpacks BLOBs and skips null embeddings", () => {
            insertChunk(vdb, {
                id: "c1",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                compendiumSource: "AoN",
                chunkIndex: 0,
                text: "Fireball spell text",
                embedding: [0.1, 0.2, 0.3],
            });
            insertChunk(vdb, {
                id: "c2",
                ruleItemId: "ri2",
                ruleItemName: "Shield",
                ruleItemType: "spell",
                compendiumSource: null,
                chunkIndex: 0,
                text: "Shield spell text",
                embedding: null,
            });

            const chunks = getAllChunkEmbeddings(vdb);
            expect(chunks).toHaveLength(1);
            expect(chunks[0].id).toBe("c1");
            expect(chunks[0].ruleItemName).toBe("Fireball");
            expect(chunks[0].embedding).toHaveLength(3);
            expect(chunks[0].embedding[0]).toBeCloseTo(0.1);
        });

        it("searchVectorDb returns correct top-N sorted by score", () => {
            const queryEmb = [1, 0, 0]; // Query vector pointing along x-axis

            insertChunk(vdb, {
                id: "c1",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "Fireball text",
                embedding: [0.9, 0.1, 0], // High similarity to query
            });
            insertChunk(vdb, {
                id: "c2",
                ruleItemId: "ri2",
                ruleItemName: "Shield",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "Shield text",
                embedding: [0.1, 0.9, 0], // Low similarity to query
            });
            insertChunk(vdb, {
                id: "c3",
                ruleItemId: "ri3",
                ruleItemName: "Magic Missile",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "Magic Missile text",
                embedding: [0.8, 0.2, 0], // Medium similarity
            });

            const results = searchVectorDb(vdb, queryEmb, 2, 0.0);
            expect(results).toHaveLength(2);
            expect(results[0].chunk.ruleItemName).toBe("Fireball");
            expect(results[0].score).toBeGreaterThan(results[1].score);
            expect(results[1].chunk.ruleItemName).toBe("Magic Missile");
        });

        it("searchVectorDb filters by threshold", () => {
            const queryEmb = [1, 0, 0];

            insertChunk(vdb, {
                id: "c1",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "Fireball text",
                embedding: [0.95, 0.05, 0], // ~0.998 similarity
            });
            insertChunk(vdb, {
                id: "c2",
                ruleItemId: "ri2",
                ruleItemName: "Shield",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "Shield text",
                embedding: [0.1, 0.9, 0], // ~0.11 similarity
            });

            const results = searchVectorDb(vdb, queryEmb, 5, 0.5);
            expect(results).toHaveLength(1);
            expect(results[0].chunk.ruleItemName).toBe("Fireball");
        });

        it("getChunksByRuleItemId returns all chunks for a given rule item", () => {
            insertChunk(vdb, {
                id: "c1",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "Fireball part 1",
                embedding: [0.1],
            });
            insertChunk(vdb, {
                id: "c2",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                chunkIndex: 1,
                text: "Fireball part 2",
                embedding: [0.2],
            });
            insertChunk(vdb, {
                id: "c3",
                ruleItemId: "ri2",
                ruleItemName: "Shield",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "Shield text",
                embedding: [0.3],
            });

            const chunks = getChunksByRuleItemId(vdb, "ri1");
            expect(chunks).toHaveLength(2);
            expect(chunks.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
        });

        it("searchVectorDb includes compendiumSource in results", () => {
            insertChunk(vdb, {
                id: "c1",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                compendiumSource: "Pathfinder Core Rulebook",
                chunkIndex: 0,
                text: "Fireball text",
                embedding: [1, 0, 0],
            });

            const results = searchVectorDb(vdb, [1, 0, 0], 1, 0.0);
            expect(results).toHaveLength(1);
            expect(results[0].chunk.compendiumSource).toBe("Pathfinder Core Rulebook");
        });
    });
});
