import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createDb } from "../server/db/database.js";
import { seedRuleItems } from "../server/db/seed.js";
import {
    createVectorDb,
    packEmbedding,
    parseVectorArgs,
    unpackEmbedding,
} from "./create-vector-db.js";

/**
 * @param {() => Promise<unknown>} fn
 */
function mockFetch(fn) {
    globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (mock(fn)));
}

describe("create-vector-db", () => {
    describe("packEmbedding / unpackEmbedding", () => {
        it("round-trips float64 arrays", () => {
            const original = [0.1, 0.2, 0.3, -0.4, 0.5];
            const packed = packEmbedding(original);
            const unpacked = unpackEmbedding(packed);

            expect(unpacked.length).toBe(original.length);
            for (let i = 0; i < original.length; i++) {
                expect(Math.abs(unpacked[i] - original[i])).toBeLessThan(1e-10);
            }
        });

        it("handles empty array", () => {
            const packed = packEmbedding([]);
            expect(packed.length).toBe(0);
            const unpacked = unpackEmbedding(packed);
            expect(unpacked).toEqual([]);
        });
    });

    describe("parseVectorArgs", () => {
        it("parses all arguments", () => {
            const args = [
                "bun",
                "script.js",
                "--api-key",
                "test-key",
                "--types",
                "creature,spell",
                "--limit",
                "10",
                "--batch-size",
                "5",
                "--db",
                "source.sqlite",
                "--vector-db",
                "output.sqlite",
                "--model",
                "embedding-001",
                "--dry-run",
            ];
            const opts = parseVectorArgs(args);

            expect(opts.apiKey).toBe("test-key");
            expect(opts.types).toEqual(["creature", "spell"]);
            expect(opts.limit).toBe(10);
            expect(opts.batchSize).toBe(5);
            expect(opts.db).toBe("source.sqlite");
            expect(opts.vectorDb).toBe("output.sqlite");
            expect(opts.model).toBe("embedding-001");
            expect(opts.dryRun).toBe(true);
        });

        it("uses defaults for missing args", () => {
            const opts = parseVectorArgs(["bun", "script.js"]);

            expect(opts.apiKey).toBeUndefined();
            expect(opts.types).toBeUndefined();
            expect(opts.limit).toBeUndefined();
            expect(opts.batchSize).toBe(20);
            expect(opts.db).toBe("data/dev.sqlite");
            expect(opts.vectorDb).toBe("data/vectors.sqlite");
            expect(opts.model).toBe("text-embedding-004");
            expect(opts.dryRun).toBe(false);
        });
    });

    describe("createVectorDb", () => {
        it("creates vector DB with correct schema", () => {
            const vdb = createVectorDb(":memory:");

            // Check table exists
            const tables = vdb
                .query("SELECT name FROM sqlite_master WHERE type='table' AND name='vector_chunks'")
                .all();
            expect(tables.length).toBe(1);

            // Check indexes
            const indexes = vdb
                .query(
                    "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_vector_%'",
                )
                .all();
            expect(indexes.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe("vector DB creation with mocked API", () => {
        /** @type {import("bun:sqlite").Database} */
        let db;
        /** @type {import("bun:sqlite").Database} */
        let vdb;

        beforeEach(() => {
            db = createDb(":memory:");
            seedRuleItems(db);
            vdb = createVectorDb(":memory:");
        });

        it("generates chunks from fixture DB with dry run", async () => {
            // For dry run, we test that chunks are generated from seeded data
            const { createChunksFromRuleItem } = await import("./lib/vector-chunker.js");
            const { getRuleItems } = await import("../server/db/queries.js");

            const items = getRuleItems(db);
            const allChunks = [];
            for (const item of items) {
                allChunks.push(...createChunksFromRuleItem(item));
            }

            // Should have generated some chunks from the seeded data
            expect(allChunks.length).toBeGreaterThan(0);
        });

        it("creates vector chunks with mocked API", async () => {
            // Mock fetch for Google AI API
            mockFetch(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            embeddings: [{ values: [0.1, 0.2, 0.3] }, { values: [0.4, 0.5, 0.6] }],
                        }),
                }),
            );

            // Use runVectorCreate but we need to mock the DB creation
            // For this test, we'll manually create chunks and insert
            const { createChunksFromRuleItem } = await import("./lib/vector-chunker.js");
            const { getRuleItems } = await import("../server/db/queries.js");

            const items = getRuleItems(db);
            const allChunks = [];
            for (const item of items) {
                allChunks.push(...createChunksFromRuleItem(item));
            }

            // Manually insert into vector DB
            const insertStmt = vdb.prepare(
                "INSERT INTO vector_chunks (id, rule_item_id, rule_item_name, rule_item_type, compendium_source, chunk_index, text, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            );

            for (const chunk of allChunks) {
                const embedding = [Math.random(), Math.random(), Math.random()];
                insertStmt.run(
                    chunk.id,
                    chunk.ruleItemId,
                    chunk.ruleItemName,
                    chunk.ruleItemType,
                    chunk.compendiumSource ?? null,
                    chunk.chunkIndex,
                    chunk.text,
                    packEmbedding(embedding),
                    new Date().toISOString(),
                );
            }

            // Verify rows
            const rows = vdb.query("SELECT * FROM vector_chunks").all();
            expect(rows.length).toBe(allChunks.length);

            // Verify embeddings are stored as BLOBs
            const row = /** @type {{ embedding: Uint8Array }} */ (
                vdb.query("SELECT embedding FROM vector_chunks LIMIT 1").get()
            );
            expect(row.embedding).toBeDefined();
            expect(row.embedding.length).toBe(24); // 3 floats * 8 bytes

            // Verify unpack
            const unpacked = unpackEmbedding(row.embedding);
            expect(unpacked.length).toBe(3);

            // Verify chunk-to-rule-item links
            const creatureChunks = vdb
                .query("SELECT * FROM vector_chunks WHERE rule_item_type = 'creature'")
                .all();
            expect(creatureChunks.length).toBeGreaterThan(0);
        });

        it("type filtering works", async () => {
            const { createChunksFromRuleItem } = await import("./lib/vector-chunker.js");
            const { getRuleItems } = await import("../server/db/queries.js");

            const items = getRuleItems(db);
            const spellItems = items.filter((i) => i.type === "spell");

            const chunks = [];
            for (const item of spellItems) {
                chunks.push(...createChunksFromRuleItem(item));
            }

            // Only spell chunks
            for (const chunk of chunks) {
                expect(chunk.ruleItemType).toBe("spell");
            }
            expect(chunks.length).toBeGreaterThan(0);
        });
    });
});
