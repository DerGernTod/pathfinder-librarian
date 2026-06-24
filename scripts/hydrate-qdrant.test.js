import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";

import { packEmbedding } from "./create-vector-db.js";

/** Records createStore invocations and returns a fake store. */
function makeFakeStoreModule() {
    /** @type {{ calls: { url?: string, collection?: string }[], upsertCalls: Array<{ points: unknown[] }>, deleteCalls: string[], ensureCalls: number[], points: Map<string, unknown>, available: boolean }} */
    const state = {
        calls: [],
        upsertCalls: [],
        deleteCalls: [],
        ensureCalls: [],
        points: new Map(),
        available: false,
    };
    const fakeStore = {
        collectionName: "rule_chunks",
        client: {
            async deleteCollection(/** @type {string} */ name) {
                state.deleteCalls.push(name);
            },
        },
        isAvailable: () => state.available,
        async ensureCollection(/** @type {number} */ vectorSize) {
            state.ensureCalls.push(vectorSize);
            state.available = true;
            return true;
        },
        async search() {
            return [];
        },
        async getChunksByRuleItemId() {
            return [];
        },
        async upsertChunks(/** @type {Array<{ id: string }>} */ chunks) {
            state.upsertCalls.push({ points: chunks });
            for (const c of chunks) {
                state.points.set(c.id, c);
            }
            return { upserted: chunks.length };
        },
    };
    const createStore = (/** @type {{ url?: string, collection?: string }} */ opts = {}) => {
        state.calls.push({ url: opts.url, collection: opts.collection });
        return /** @type {import("../server/utils/vector-store.js").VectorStore} */ (
            /** @type {unknown} */ (fakeStore)
        );
    };
    return { state, createStore };
}

const { parseHydrateArgs, readAllChunks, detectVectorSize, runHydrate } =
    await import("./hydrate-qdrant.js");

const TEMP_DIR = "./temp";
const HYDRATE_DB = `${TEMP_DIR}/__hydrate_test.sqlite`;
const HYDRATE_RECREATE_DB = `${TEMP_DIR}/__hydrate_recreate.sqlite`;

/** @param {Database} db */
function ensureSchema(db) {
    db.exec(`
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
}

/**
 * @param {Database} db
 * @param {{ id: string, ruleItemId: string, ruleItemName: string, ruleItemType: string, compendiumSource?: string | null, chunkIndex: number, text: string, embedding?: number[] | null }} chunk
 */
function insertChunk(db, chunk) {
    const blob = chunk.embedding ? packEmbedding(chunk.embedding) : null;
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
            blob,
            new Date().toISOString(),
        ],
    );
}

/** @param {string} path @param {number} count */
function writeTempDb(path, count) {
    mkdirSync(TEMP_DIR, { recursive: true });
    try {
        rmSync(path);
    } catch {
        // ignore
    }
    const db = new Database(path);
    ensureSchema(db);
    for (let i = 0; i < count; i++) {
        insertChunk(db, {
            id: `c${i}`,
            ruleItemId: "ri1",
            ruleItemName: "Alpha",
            ruleItemType: "spell",
            chunkIndex: i,
            text: `part ${i}`,
            embedding: [i, 0, 0],
        });
    }
    db.close();
}

describe("hydrate-qdrant", () => {
    describe("parseHydrateArgs", () => {
        const origUrl = process.env.QDRANT_URL;
        const origCollection = process.env.QDRANT_COLLECTION;

        afterEach(() => {
            if (origUrl !== undefined) {
                process.env.QDRANT_URL = origUrl;
            } else {
                delete process.env.QDRANT_URL;
            }
            if (origCollection !== undefined) {
                process.env.QDRANT_COLLECTION = origCollection;
            } else {
                delete process.env.QDRANT_COLLECTION;
            }
        });

        it("applies defaults when no flags and no env", () => {
            delete process.env.QDRANT_URL;
            delete process.env.QDRANT_COLLECTION;
            const args = parseHydrateArgs(["bun", "script.js"]);
            expect(args.vectorDb).toBe("data/vectors.sqlite");
            expect(args.qdrantUrl).toBe("http://localhost:6333");
            expect(args.collection).toBe("rule_chunks");
            expect(args.batchSize).toBe(100);
            expect(args.vectorSize).toBeUndefined();
            expect(args.recreate).toBe(false);
        });

        it("honors flags over env defaults", () => {
            process.env.QDRANT_URL = "http://env:6333";
            process.env.QDRANT_COLLECTION = "env_coll";
            const args = parseHydrateArgs([
                "bun",
                "script.js",
                "--vector-db",
                "x.sqlite",
                "--qdrant-url",
                "http://flag:6333",
                "--collection",
                "flag_coll",
                "--batch-size",
                "5",
                "--vector-size",
                "3072",
                "--recreate",
            ]);
            expect(args.vectorDb).toBe("x.sqlite");
            expect(args.qdrantUrl).toBe("http://flag:6333");
            expect(args.collection).toBe("flag_coll");
            expect(args.batchSize).toBe(5);
            expect(args.vectorSize).toBe(3072);
            expect(args.recreate).toBe(true);
        });

        it("exits 0 on --help", () => {
            /** @type {string[]} */
            const logs = [];
            const originalLog = console.log;
            console.log = (...args) => logs.push(String(args[0]));
            const originalExit = process.exit;
            process.exit = (/** @type {number} */ code) => {
                throw { code, logs };
            };
            try {
                parseHydrateArgs(["bun", "script.js", "--help"]);
            } catch (/** @type {unknown} */ e) {
                const err = /** @type {{ code: number, logs: string[] }} */ (e);
                expect(err.code).toBe(0);
                expect(err.logs[0]).toContain("Usage:");
            } finally {
                process.exit = originalExit;
                console.log = originalLog;
            }
        });
    });

    describe("detectVectorSize", () => {
        it("returns override when provided", () => {
            expect(detectVectorSize([], 123)).toBe(123);
            expect(detectVectorSize([{ embedding: null }], 123)).toBe(123);
        });

        it("infers from first non-null embedding (64-byte BLOB = 8 dims)", () => {
            const eightBytes = Buffer.alloc(64);
            const rows = [{ embedding: null }, { embedding: eightBytes }];
            expect(detectVectorSize(rows, undefined)).toBe(8);
        });

        it("falls back to QDRANT_CONFIG.VECTOR_SIZE on empty rows", () => {
            expect(detectVectorSize([], undefined)).toBe(3072);
        });
    });

    describe("readAllChunks", () => {
        /** @type {Database} */
        let sqlite;
        beforeEach(() => {
            sqlite = new Database(":memory:");
            ensureSchema(sqlite);
        });
        afterEach(() => {
            if (sqlite) {
                sqlite.close();
            }
        });

        it("returns all rows", () => {
            insertChunk(sqlite, {
                id: "a",
                ruleItemId: "ri1",
                ruleItemName: "Alpha",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "alpha",
                embedding: [1, 0, 0],
            });
            insertChunk(sqlite, {
                id: "b",
                ruleItemId: "ri2",
                ruleItemName: "Beta",
                ruleItemType: "spell",
                chunkIndex: 0,
                text: "beta",
                embedding: [0, 1, 0],
            });
            const rows = readAllChunks(sqlite);
            expect(rows.length).toBe(2);
            expect(String(rows[0].id)).toBe("a");
            expect(String(rows[1].id)).toBe("b");
        });
    });

    describe("runHydrate", () => {
        const origUrl = process.env.QDRANT_URL;
        const origCollection = process.env.QDRANT_COLLECTION;

        beforeEach(() => {
            delete process.env.QDRANT_URL;
            delete process.env.QDRANT_COLLECTION;
        });

        afterEach(() => {
            if (origUrl !== undefined) {
                process.env.QDRANT_URL = origUrl;
            } else {
                delete process.env.QDRANT_URL;
            }
            if (origCollection !== undefined) {
                process.env.QDRANT_COLLECTION = origCollection;
            } else {
                delete process.env.QDRANT_COLLECTION;
            }
        });

        it("upserts rows in batches of batchSize and creates collection once", async () => {
            writeTempDb(HYDRATE_DB, 7);
            const fakeModule = makeFakeStoreModule();
            const result = await runHydrate(
                {
                    vectorDb: HYDRATE_DB,
                    qdrantUrl: "http://test:6333",
                    collection: "rule_chunks",
                    batchSize: 3,
                    vectorSize: undefined,
                    recreate: false,
                },
                { createStore: fakeModule.createStore },
            );
            expect(result.points).toBe(7);
            expect(result.batches).toBe(3);
            expect(result.errors).toBe(0);
            expect(fakeModule.state.ensureCalls).toEqual([3]);
            expect(fakeModule.state.deleteCalls).toHaveLength(0);
            expect(fakeModule.state.upsertCalls[0].points.length).toBe(3);
            expect(fakeModule.state.upsertCalls[1].points.length).toBe(3);
            expect(fakeModule.state.upsertCalls[2].points.length).toBe(1);
        });

        it("re-running is idempotent: point count stable (dedup by UUID v5 id)", async () => {
            writeTempDb(HYDRATE_DB, 1);
            const fakeModule = makeFakeStoreModule();
            const args = {
                vectorDb: HYDRATE_DB,
                qdrantUrl: "http://test:6333",
                collection: "rule_chunks",
                batchSize: 100,
                vectorSize: undefined,
                recreate: false,
            };
            const r1 = await runHydrate(args, { createStore: fakeModule.createStore });
            expect(r1.points).toBe(1);
            const sizeAfterFirst = fakeModule.state.points.size;

            const r2 = await runHydrate(args, { createStore: fakeModule.createStore });
            expect(r2.points).toBe(1);
            expect(fakeModule.state.points.size).toBe(sizeAfterFirst);
        });

        it("recreate=true triggers deleteCollection exactly once", async () => {
            writeTempDb(HYDRATE_RECREATE_DB, 1);
            const fakeModule = makeFakeStoreModule();
            const result = await runHydrate(
                {
                    vectorDb: HYDRATE_RECREATE_DB,
                    qdrantUrl: "http://test:6333",
                    collection: "rule_chunks",
                    batchSize: 100,
                    vectorSize: undefined,
                    recreate: true,
                },
                { createStore: fakeModule.createStore },
            );
            expect(result.errors).toBe(0);
            expect(fakeModule.state.deleteCalls).toEqual(["rule_chunks"]);
        });
    });
});
