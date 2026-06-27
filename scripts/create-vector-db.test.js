import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";

import { createDb } from "../server/db/database.js";
import { getRuleItems } from "../server/db/queries.js";
import { seedRuleItems } from "../server/db/seed.js";

// Capture the real fetch before any test stubs it so we can restore it and
// avoid leaking a mock into later test files (mock.module on the Google AI
// client would also leak across files in the same bun:test process).
const realFetch = globalThis.fetch;

/**
 * Stub globalThis.fetch to return canned embeddings for createEmbeddings.
 * The response embeddings count matches the request's `requests` array.
 */
function mockEmbeddingsFetch() {
    const handler = async (/** @type {string} */ _url, /** @type {RequestInit} */ opts) => {
        const body = JSON.parse(/** @type {string} */ (opts.body));
        const count = /** @type {{ requests: unknown[] }} */ (body).requests.length;
        return {
            ok: true,
            json: () =>
                Promise.resolve({
                    embeddings: Array.from({ length: count }, () => ({
                        values: [0.1, 0.2, 0.3],
                    })),
                }),
        };
    };
    globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (mock(handler)));
}

const { parseVectorArgs, runVectorCreate } = await import("./create-vector-db.js");

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

const TEMP_DIR = "./temp";
const SOURCE_DB = `${TEMP_DIR}/__create_vector_source.sqlite`;

/**
 * Seed a temp source DB file with rule items so runVectorCreate can read it.
 * @param {string} path
 */
function writeSeededSourceDb(path) {
    mkdirSync(TEMP_DIR, { recursive: true });
    try {
        rmSync(path);
    } catch {
        // ignore
    }
    const db = createDb(path);
    seedRuleItems(db);
    db.close();
}

describe("create-vector-db", () => {
    describe("parseVectorArgs", () => {
        const origApiKey = process.env.GOOGLE_AI_API_KEY;
        const origUrl = process.env.QDRANT_URL;
        const origCollection = process.env.QDRANT_COLLECTION;

        afterEach(() => {
            if (origApiKey !== undefined) {
                process.env.GOOGLE_AI_API_KEY = origApiKey;
            } else {
                delete process.env.GOOGLE_AI_API_KEY;
            }
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

        it("parses all arguments", () => {
            delete process.env.GOOGLE_AI_API_KEY;
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
                "--model",
                "embedding-001",
                "--qdrant-url",
                "http://flag:6333",
                "--collection",
                "flag_coll",
                "--vector-size",
                "768",
                "--recreate",
                "--dry-run",
            ];
            const opts = parseVectorArgs(args);

            expect(opts.apiKey).toBe("test-key");
            expect(opts.types).toEqual(["creature", "spell"]);
            expect(opts.limit).toBe(10);
            expect(opts.batchSize).toBe(5);
            expect(opts.db).toBe("source.sqlite");
            expect(opts.model).toBe("embedding-001");
            expect(opts.qdrantUrl).toBe("http://flag:6333");
            expect(opts.collection).toBe("flag_coll");
            expect(opts.vectorSize).toBe(768);
            expect(opts.recreate).toBe(true);
            expect(opts.dryRun).toBe(true);
        });

        it("uses defaults for missing args", () => {
            delete process.env.GOOGLE_AI_API_KEY;
            delete process.env.QDRANT_URL;
            delete process.env.QDRANT_COLLECTION;
            const opts = parseVectorArgs(["bun", "script.js", "--dry-run"]);

            expect(opts.apiKey).toBeUndefined();
            expect(opts.types).toBeUndefined();
            expect(opts.limit).toBeUndefined();
            expect(opts.batchSize).toBe(100);
            expect(opts.db).toBe("data/dev.sqlite");
            expect(opts.model).toBe("gemini-embedding-001");
            expect(opts.qdrantUrl).toBe("http://localhost:6333");
            expect(opts.collection).toBe("rule_chunks");
            expect(opts.vectorSize).toBe(3072);
            expect(opts.recreate).toBe(false);
            expect(opts.dryRun).toBe(true);
        });

        it("honors env vars for qdrant-url and collection when flags absent", () => {
            process.env.QDRANT_URL = "http://env:6333";
            process.env.QDRANT_COLLECTION = "env_coll";
            const opts = parseVectorArgs(["bun", "script.js", "--dry-run"]);
            expect(opts.qdrantUrl).toBe("http://env:6333");
            expect(opts.collection).toBe("env_coll");
        });

        it("exits with help when called with --help", () => {
            /** @type {string[]} */
            const logs = [];
            const originalLog = console.log;
            console.log = (...args) => logs.push(String(args[0]));
            const originalExit = process.exit;
            process.exit = (/** @type {number} */ code) => {
                throw { code, logs };
            };
            try {
                parseVectorArgs(["bun", "script.js", "--help"]);
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

    describe("chunking (storage-independent)", () => {
        /** @type {import("bun:sqlite").Database} */
        let db;

        beforeEach(() => {
            db = createDb(":memory:");
            seedRuleItems(db);
        });

        afterEach(() => {
            if (db) {
                db.close();
            }
        });

        it("generates chunks from fixture DB with dry run", async () => {
            const { createChunksFromRuleItem } = await import("./lib/vector-chunker.js");

            const items = getRuleItems(db, undefined, { includeChildren: true });
            const allChunks = [];
            for (const item of items) {
                allChunks.push(...createChunksFromRuleItem(item));
            }

            expect(allChunks.length).toBeGreaterThan(0);
        });

        it("getRuleItems with includeChildren returns all items", () => {
            const rootOnly = getRuleItems(db);
            const all = getRuleItems(db, undefined, { includeChildren: true });

            expect(all.length).toBeGreaterThan(rootOnly.length);
            expect(all.length).toBe(9);
            expect(rootOnly.length).toBe(5);
        });

        it("child chunks include parent context", async () => {
            const { createChunksFromRuleItem } = await import("./lib/vector-chunker.js");

            const allItems = getRuleItems(db, undefined, { includeChildren: true });
            const meleeChildren = allItems.filter((item) => item.parentId && item.type === "melee");

            for (const child of meleeChildren) {
                const parent = allItems.find((p) => p.id === child.parentId);
                const chunks = createChunksFromRuleItem(child, parent);

                for (const chunk of chunks) {
                    expect(chunk.text).toContain("Mitflit King's");
                }
            }

            const scChildren = allItems.filter(
                (item) => item.parentId && item.type === "spellcastingEntry",
            );
            for (const child of scChildren) {
                const parent = allItems.find((p) => p.id === child.parentId);
                const chunks = createChunksFromRuleItem(child, parent);
                for (const chunk of chunks) {
                    expect(chunk.text).toContain("Mitflit King's");
                }
            }
        });

        it("type filtering works", async () => {
            const { createChunksFromRuleItem } = await import("./lib/vector-chunker.js");

            const items = getRuleItems(db, undefined, { includeChildren: true });
            const spellItems = items.filter((i) => i.type === "spell");

            const chunks = [];
            for (const item of spellItems) {
                chunks.push(...createChunksFromRuleItem(item));
            }

            for (const chunk of chunks) {
                expect(chunk.ruleItemType).toBe("spell");
            }
            expect(chunks.length).toBeGreaterThan(0);
        });
    });

    describe("runVectorCreate (direct to Qdrant)", () => {
        const origUrl = process.env.QDRANT_URL;
        const origCollection = process.env.QDRANT_COLLECTION;

        beforeEach(() => {
            delete process.env.QDRANT_URL;
            delete process.env.QDRANT_COLLECTION;
            writeSeededSourceDb(SOURCE_DB);
            mockEmbeddingsFetch();
        });

        afterEach(() => {
            globalThis.fetch = realFetch;
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

        it("chunks, embeds, and upserts directly to Qdrant via createStore", async () => {
            const fake = makeFakeStoreModule();
            const result = await runVectorCreate(
                {
                    apiKey: "test-key",
                    db: SOURCE_DB,
                    batchSize: 100,
                    model: "gemini-embedding-001",
                    dryRun: false,
                    qdrantUrl: "http://test:6333",
                    collection: "rule_chunks",
                    vectorSize: 3072,
                    recreate: false,
                },
                { createStore: fake.createStore },
            );

            expect(result.errors).toBe(0);
            expect(result.chunksCreated).toBeGreaterThan(0);
            expect(result.apiCalls).toBeGreaterThanOrEqual(1);
            expect(fake.state.calls[0]).toEqual({
                url: "http://test:6333",
                collection: "rule_chunks",
            });
            expect(fake.state.ensureCalls).toEqual([3072]);
            expect(fake.state.deleteCalls).toHaveLength(0);
            expect(fake.state.upsertCalls.length).toBeGreaterThanOrEqual(1);
            const upsertedTotal = fake.state.upsertCalls.reduce(
                (sum, call) => sum + call.points.length,
                0,
            );
            expect(upsertedTotal).toBe(result.chunksCreated);
        });

        it("re-running is idempotent: point ids dedup (UUID v5)", async () => {
            const fake = makeFakeStoreModule();
            const args = {
                apiKey: "test-key",
                db: SOURCE_DB,
                batchSize: 100,
                model: "gemini-embedding-001",
                dryRun: false,
                qdrantUrl: "http://test:6333",
                collection: "rule_chunks",
                vectorSize: 3072,
                recreate: false,
            };
            const r1 = await runVectorCreate(args, { createStore: fake.createStore });
            const sizeAfterFirst = fake.state.points.size;
            const r2 = await runVectorCreate(args, { createStore: fake.createStore });
            expect(r1.chunksCreated).toBe(r2.chunksCreated);
            expect(fake.state.points.size).toBe(sizeAfterFirst);
        });

        it("recreate=true triggers deleteCollection exactly once", async () => {
            const fake = makeFakeStoreModule();
            await runVectorCreate(
                {
                    apiKey: "test-key",
                    db: SOURCE_DB,
                    batchSize: 100,
                    model: "gemini-embedding-001",
                    dryRun: false,
                    qdrantUrl: "http://test:6333",
                    collection: "rule_chunks",
                    vectorSize: 3072,
                    recreate: true,
                },
                { createStore: fake.createStore },
            );
            expect(fake.state.deleteCalls).toEqual(["rule_chunks"]);
        });

        it("dry-run returns chunk count without upserting", async () => {
            const fake = makeFakeStoreModule();
            const result = await runVectorCreate(
                {
                    apiKey: "test-key",
                    db: SOURCE_DB,
                    batchSize: 100,
                    model: "gemini-embedding-001",
                    dryRun: true,
                    qdrantUrl: "http://test:6333",
                    collection: "rule_chunks",
                    vectorSize: 3072,
                    recreate: false,
                },
                { createStore: fake.createStore },
            );
            expect(result.chunksCreated).toBeGreaterThan(0);
            expect(result.apiCalls).toBe(0);
            expect(fake.state.upsertCalls).toHaveLength(0);
            expect(fake.state.ensureCalls).toHaveLength(0);
        });
    });
});
