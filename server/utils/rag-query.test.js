import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { packEmbedding } from "../../scripts/create-vector-db.js";
import { createSingleEmbedding, queryRagContext } from "./rag-query.js";

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

describe("rag-query", () => {
    const originalApiKey = process.env.GOOGLE_AI_API_KEY;
    const originalMockAi = process.env.MOCK_GOOGLE_AI;

    afterEach(() => {
        if (originalApiKey !== undefined) {
            process.env.GOOGLE_AI_API_KEY = originalApiKey;
        } else {
            delete process.env.GOOGLE_AI_API_KEY;
        }
        if (originalMockAi !== undefined) {
            process.env.MOCK_GOOGLE_AI = originalMockAi;
        } else {
            delete process.env.MOCK_GOOGLE_AI;
        }
    });

    describe("createSingleEmbedding", () => {
        it("wraps single text into array and returns first result", async () => {
            process.env.MOCK_GOOGLE_AI = "1";

            const embedding = await createSingleEmbedding(
                "test prompt",
                "fake-key",
                "gemini-embedding-001",
            );

            expect(Array.isArray(embedding)).toBe(true);
            expect(embedding.length).toBeGreaterThan(0);
        });
    });

    describe("queryRagContext", () => {
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

        it("returns empty context when no vector DB provided", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            process.env.MOCK_GOOGLE_AI = "1";

            const result = await queryRagContext("What is Fireball?", {
                vectorDb: null,
            });

            expect(result.contextText).toBe("");
            expect(result.sources).toEqual([]);
        });

        it("returns empty context when no API key is set", async () => {
            delete process.env.GOOGLE_AI_API_KEY;

            const result = await queryRagContext("What is Fireball?", {
                vectorDb: vdb,
            });

            expect(result.contextText).toBe("");
            expect(result.sources).toEqual([]);
        });

        it("returns formatted context with matched chunks", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            process.env.MOCK_GOOGLE_AI = "1";

            // Insert a chunk with embedding that will match
            insertChunk(vdb, {
                id: "c1",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                compendiumSource: "Pathfinder Core Rulebook",
                chunkIndex: 0,
                text: "Spell: Fireball (Rank 3). Traditions: arcane, primal. Cast: two actions.",
                embedding: Array(768)
                    .fill(0)
                    .map((_, i) => (i === 0 ? 1 : 0)), // [1,0,0,...,0]
            });

            const result = await queryRagContext("What is Fireball?", {
                vectorDb: vdb,
                topN: 5,
                threshold: 0.1,
            });

            expect(result.contextText).toContain("retrieved-context");
            expect(result.contextText).toContain("Fireball");
            expect(result.sources).toHaveLength(1);
            expect(result.sources[0].name).toBe("Fireball");
            expect(result.sources[0].type).toBe("spell");
            expect(result.sources[0].score).toBeGreaterThan(0);
        });

        it("deduplicates by rule item ID keeping highest score", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            process.env.MOCK_GOOGLE_AI = "1";

            // Two chunks from the same rule item, one more similar
            insertChunk(vdb, {
                id: "c1",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "Fireball description",
                embedding: Array(768)
                    .fill(0)
                    .map((_, i) => (i === 0 ? 0.9 : 0)),
            });
            insertChunk(vdb, {
                id: "c2",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                chunkIndex: 1,
                text: "Fireball heightened effects",
                embedding: Array(768)
                    .fill(0)
                    .map((_, i) => (i === 0 ? 0.5 : 0)),
            });

            const result = await queryRagContext("Fireball?", {
                vectorDb: vdb,
                topN: 5,
                threshold: 0.1,
            });

            // Should deduplicate to just 1 source for ri1
            expect(result.sources).toHaveLength(1);
            expect(result.sources[0].name).toBe("Fireball");
        });

        it("mock mode generates deterministic fake embedding without API call", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            process.env.MOCK_GOOGLE_AI = "1";

            // Just verify it doesn't throw and produces results
            insertChunk(vdb, {
                id: "c1",
                ruleItemId: "ri1",
                ruleItemName: "Test",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "Test text",
                embedding: Array(768)
                    .fill(0)
                    .map((_, i) => (i === 0 ? 1 : 0)),
            });

            // Should not throw - mock mode uses fake embedding
            const result = await queryRagContext("anything", {
                vectorDb: vdb,
                topN: 5,
                threshold: 0.0,
            });

            // Mock embedding is deterministic but may or may not match the test embedding
            // Just verify structure is correct
            expect(result).toHaveProperty("contextText");
            expect(result).toHaveProperty("sources");
            expect(Array.isArray(result.sources)).toBe(true);
        });
    });
});
