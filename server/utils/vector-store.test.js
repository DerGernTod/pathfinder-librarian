import { mock } from "bun:test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { uuidV5FromName } from "../../scripts/lib/vector-math.js";

/**
 * In-memory fake QdrantClient. Implements the subset of the Qdrant REST API
 * used by server/utils/vector-store.js so unit tests exercise the wrapper
 * without hitting the network.
 */
function createFakeClient() {
    /** @type {Map<string, { config: Record<string, unknown>, points: Map<string, { vector: number[], payload: Record<string, unknown> }>, indexes: Set<string> }>} */
    const collections = new Map();
    const calls = {
        collectionExists: /** @type {string[]} */ ([]),
        createCollection:
            /** @type {Array<{ name: string, config: Record<string, unknown> }>} */ ([]),
        createPayloadIndex: /** @type {Array<{ name: string, field: string }>} */ ([]),
        search: /** @type {Array<{ name: string, opts: Record<string, unknown> }>} */ ([]),
        scroll: /** @type {Array<{ name: string, opts: Record<string, unknown> }>} */ ([]),
        upsert: /** @type {Array<{ name: string, opts: Record<string, unknown> }>} */ ([]),
        deleteCollection: /** @type {string[]} */ ([]),
    };
    let shouldThrow = /** @type {null | (() => Error)} */ (null);

    const client = {
        calls,
        setThrow(/** @type {null | (() => Error)} */ fn) {
            shouldThrow = fn;
        },
        reset() {
            collections.clear();
            calls.collectionExists.length = 0;
            calls.createCollection.length = 0;
            calls.createPayloadIndex.length = 0;
            calls.search.length = 0;
            calls.scroll.length = 0;
            calls.upsert.length = 0;
            calls.deleteCollection.length = 0;
            shouldThrow = null;
        },
        async collectionExists(/** @type {string} */ name) {
            calls.collectionExists.push(name);
            if (shouldThrow) {
                throw shouldThrow();
            }
            return { exists: collections.has(name) };
        },
        async createCollection(
            /** @type {string} */ name,
            /** @type {Record<string, unknown>} */ config,
        ) {
            calls.createCollection.push({ name, config });
            collections.set(name, { config, points: new Map(), indexes: new Set() });
        },
        async createPayloadIndex(
            /** @type {string} */ name,
            /** @type {{ field_name: string }} */ opts,
        ) {
            calls.createPayloadIndex.push({ name, field: opts.field_name });
            const c = collections.get(name);
            if (c) {
                c.indexes.add(opts.field_name);
            }
            return { status: "completed" };
        },
        async search(/** @type {string} */ name, /** @type {Record<string, unknown>} */ opts) {
            calls.search.push({ name, opts });
            const c = collections.get(name);
            if (!c) {
                return [];
            }
            const vector = /** @type {number[]} */ (opts.vector);
            const limit = /** @type {number} */ (opts.limit);
            const threshold = /** @type {number} */ (opts.score_threshold ?? 0);
            const scored = [];
            for (const [id, point] of c.points) {
                const score = dotCos(vector, point.vector);
                if (score >= threshold) {
                    scored.push({ id, score, payload: point.payload });
                }
            }
            scored.sort((a, b) => b.score - a.score);
            return scored.slice(0, limit);
        },
        async scroll(/** @type {string} */ name, /** @type {Record<string, unknown>} */ opts) {
            calls.scroll.push({ name, opts });
            const c = collections.get(name);
            if (!c) {
                return { points: [], next_page_offset: null };
            }
            /** @type {{ must?: Array<{ key: string, match: { value: string } }> }} */
            const filter = /** @type {unknown} */ (opts.filter) ?? {};
            const must = filter.must ?? [];
            const points = [];
            for (const [, point] of c.points) {
                const matches = must.every((m) => point.payload[m.key] === m.match.value);
                if (matches) {
                    points.push({ id: "irrelevant", payload: point.payload });
                }
            }
            return { points, next_page_offset: null };
        },
        async upsert(/** @type {string} */ name, /** @type {Record<string, unknown>} */ opts) {
            calls.upsert.push({ name, opts });
            let c = collections.get(name);
            if (!c) {
                c = { config: {}, points: new Map(), indexes: new Set() };
                collections.set(name, c);
            }
            const points =
                /** @type {Array<{ id: string, vector: number[], payload: Record<string, unknown> }>} */ (
                    opts.points
                );
            for (const p of points) {
                c.points.set(p.id, { vector: p.vector, payload: p.payload });
            }
            return { operation_id: 0, status: opts.wait ? "completed" : "acknowledged" };
        },
        async deleteCollection(/** @type {string} */ name) {
            calls.deleteCollection.push(name);
            collections.delete(name);
        },
        pointCount(/** @type {string} */ name) {
            const c = collections.get(name);
            return c ? c.points.size : 0;
        },
    };
    return client;
}

/** Naive cosine similarity. */
function dotCos(/** @type {number[]} */ a, /** @type {number[]} */ b) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) {
        return 0;
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

let fakeClient = createFakeClient();

await mock.module("@qdrant/js-client-rest", () => ({
    QdrantClient: class {
        constructor(/** @type {Record<string, unknown>} */ _opts) {
            instantiationCount++;
            return fakeClient;
        }
    },
}));

let instantiationCount = 0;

const { createVectorStore } = await import("./vector-store.js");

describe("vector-store", () => {
    const origUrl = process.env.QDRANT_URL;
    const origCollection = process.env.QDRANT_COLLECTION;
    const origDisabled = process.env.QDRANT_DISABLED;
    const origSize = process.env.QDRANT_VECTOR_SIZE;

    beforeEach(() => {
        fakeClient.reset();
        instantiationCount = 0;
        delete process.env.QDRANT_URL;
        delete process.env.QDRANT_COLLECTION;
        delete process.env.QDRANT_DISABLED;
        delete process.env.QDRANT_VECTOR_SIZE;
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
        if (origDisabled !== undefined) {
            process.env.QDRANT_DISABLED = origDisabled;
        } else {
            delete process.env.QDRANT_DISABLED;
        }
        if (origSize !== undefined) {
            process.env.QDRANT_VECTOR_SIZE = origSize;
        } else {
            delete process.env.QDRANT_VECTOR_SIZE;
        }
    });

    describe("createVectorStore (no URL)", () => {
        it("isAvailable() returns false and constructs no client", () => {
            const store = createVectorStore();
            expect(store.client).toBeNull();
            expect(store.isAvailable()).toBe(false);
            expect(instantiationCount).toBe(0);
        });

        it("search() short-circuits to [] without connection attempts", async () => {
            const store = createVectorStore();
            const results = await store.search([1, 2, 3], { topN: 5 });
            expect(results).toEqual([]);
            expect(fakeClient.calls.search).toHaveLength(0);
        });

        it("getChunksByRuleItemId short-circuits to [] without connection attempts", async () => {
            const store = createVectorStore();
            const results = await store.getChunksByRuleItemId("ri1");
            expect(results).toEqual([]);
            expect(fakeClient.calls.scroll).toHaveLength(0);
        });

        it("upsertChunks returns { upserted: 0 } when no client", async () => {
            const store = createVectorStore();
            const result = await store.upsertChunks([
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "boom",
                    embedding: [1, 0, 0],
                },
            ]);
            expect(result).toEqual({ upserted: 0 });
        });

        it("QDRANT_DISABLED=1 forces no-client even with a URL", () => {
            process.env.QDRANT_URL = "http://example:6333";
            process.env.QDRANT_DISABLED = "1";
            const store = createVectorStore();
            expect(store.client).toBeNull();
            expect(store.isAvailable()).toBe(false);
            expect(instantiationCount).toBe(0);
        });
    });

    describe("ensureCollection (existence-check at boot)", () => {
        it("creates the collection with Cosine + int8 quantization when absent and vectorSize given", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            const ok = await store.ensureCollection(8);
            expect(ok).toBe(true);
            expect(store.isAvailable()).toBe(true);
            expect(fakeClient.calls.createCollection).toHaveLength(1);
            const created = fakeClient.calls.createCollection[0];
            expect(created.name).toBe("rule_chunks");
            expect(created.config.vectors).toEqual({ size: 8, distance: "Cosine" });
            expect(created.config.quantization_config).toEqual({
                scalar: { type: "int8", quantile: 0.99, always_ram: true },
            });
            expect(created.config.on_disk_payload).toBe(true);
            expect(fakeClient.calls.createPayloadIndex).toHaveLength(3);
        });

        it("is idempotent when collection exists (no re-create)", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(8);
            const ok2 = await store.ensureCollection(8);
            expect(ok2).toBe(true);
            expect(fakeClient.calls.createCollection).toHaveLength(1);
            expect(fakeClient.calls.collectionExists).toHaveLength(1);
        });

        it("does NOT create a collection at boot (no vectorSize, no env)", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            const ok = await store.ensureCollection();
            expect(ok).toBe(false);
            expect(store.isAvailable()).toBe(false);
            expect(fakeClient.calls.createCollection).toHaveLength(0);
        });

        it("uses QDRANT_VECTOR_SIZE env when no arg passed", async () => {
            process.env.QDRANT_VECTOR_SIZE = "768";
            const store = createVectorStore({ url: "http://example:6333" });
            const ok = await store.ensureCollection();
            expect(ok).toBe(true);
            expect(fakeClient.calls.createCollection[0].config.vectors).toEqual({
                size: 768,
                distance: "Cosine",
            });
        });

        it("sets available=false and re-throws when client throws", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            fakeClient.setThrow(() => new Error("boom"));
            const initPromise = store.ensureCollection(8);
            /** @type {unknown} */
            let caught = null;
            try {
                await initPromise;
            } catch (/** @type {unknown} */ e) {
                caught = e;
            }
            expect(caught).toBeInstanceOf(Error);
            expect(String(caught)).toBe("Error: boom");
            expect(store.isAvailable()).toBe(false);
            const results = await store.search([1, 2, 3]);
            expect(results).toEqual([]);
        });

        it("does not spurious-log search when init already failed (clarify #6)", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            fakeClient.setThrow(() => new Error("init down"));
            const initPromise = store.ensureCollection(8);
            try {
                await initPromise;
            } catch {
                // expected rejection
            }
            expect(store.isAvailable()).toBe(false);
            /** @type {import("bun:test").Mock<() => void>} */
            const warnSpy = mock(() => {});
            const originalWarn = console.warn;
            console.warn = warnSpy;
            try {
                const r1 = await store.search([1, 2, 3]);
                const r2 = await store.search([4, 5, 6]);
                expect(r1).toEqual([]);
                expect(r2).toEqual([]);
                expect(warnSpy).not.toHaveBeenCalled();
            } finally {
                console.warn = originalWarn;
            }
        });

        it("lazy-init search swallows ensureCollection throw silently (clarify #6)", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            fakeClient.setThrow(() => new Error("lazy init down"));
            /** @type {import("bun:test").Mock<() => void>} */
            const warnSpy = mock(() => {});
            const originalWarn = console.warn;
            console.warn = warnSpy;
            try {
                const r1 = await store.search([1, 2, 3]);
                const r2 = await store.search([4, 5, 6]);
                expect(r1).toEqual([]);
                expect(r2).toEqual([]);
                expect(warnSpy).not.toHaveBeenCalled();
            } finally {
                console.warn = originalWarn;
            }
        });
    });

    describe("search", () => {
        it("queries Qdrant with limit EXACTLY equal to topN (no over-fetch)", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            await store.upsertChunks([
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "boom",
                    embedding: [1, 0, 0],
                },
            ]);
            await store.search([1, 0, 0], { topN: 7, threshold: 0.0 });
            const lastCall = fakeClient.calls.search.at(-1);
            expect(lastCall?.opts.limit).toBe(7);
        });

        it("returns hits sorted desc with mapped camelCase payloads", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            await store.upsertChunks([
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: "Core",
                    chunkIndex: 0,
                    text: "boom",
                    embedding: [0.9, 0.1, 0],
                },
                {
                    id: "c2",
                    ruleItemId: "ri2",
                    ruleItemName: "Shield",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "block",
                    embedding: [0.1, 0.9, 0],
                },
            ]);
            const results = await store.search([1, 0, 0], { topN: 5, threshold: 0.0 });
            expect(results.length).toBe(2);
            expect(results[0].chunk.ruleItemName).toBe("Fireball");
            expect(results[0].chunk.compendiumSource).toBe("Core");
            expect(results[0].chunk.ruleItemType).toBe("spell");
            expect(results[0].score).toBeGreaterThan(results[1].score);
        });

        it("filters by score_threshold", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            await store.upsertChunks([
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "boom",
                    embedding: [0.9, 0.1, 0],
                },
                {
                    id: "c2",
                    ruleItemId: "ri2",
                    ruleItemName: "Shield",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "block",
                    embedding: [0.1, 0.9, 0],
                },
            ]);
            const results = await store.search([1, 0, 0], { topN: 5, threshold: 0.95 });
            expect(results).toHaveLength(1);
            expect(results[0].chunk.ruleItemName).toBe("Fireball");
        });

        it("passes through filter when provided", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            await store.upsertChunks([
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "boom",
                    embedding: [1, 0, 0],
                },
            ]);
            const filter = { must: [{ key: "rule_item_type", match: { value: "spell" } }] };
            await store.search([1, 0, 0], { topN: 5, filter });
            expect(fakeClient.calls.search.at(-1)?.opts.filter).toEqual(filter);
        });

        it("skips hits with null payload", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            await store.upsertChunks([
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "boom",
                    embedding: [1, 0, 0],
                },
            ]);
            // Inject a null-payload point directly via the fake client
            const c = fakeClient;
            await c.upsert("rule_chunks", {
                wait: true,
                points: [{ id: uuidV5FromName("bad"), vector: [0.9, 0.1, 0], payload: null }],
            });
            const results = await store.search([1, 0, 0], { topN: 5 });
            const ids = results.map((r) => r.chunk.id);
            expect(ids).not.toContain("bad");
        });

        it("returns [] on search failure without throwing", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            fakeClient.setThrow(() => new Error("search down"));
            const results = await store.search([1, 0, 0]);
            expect(results).toEqual([]);
        });
    });

    describe("getChunksByRuleItemId", () => {
        it("returns chunks for the rule item sorted by chunk_index", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            await store.upsertChunks([
                {
                    id: "c2",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 1,
                    text: "part 2",
                    embedding: [0, 1, 0],
                },
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "part 1",
                    embedding: [1, 0, 0],
                },
                {
                    id: "c3",
                    ruleItemId: "ri2",
                    ruleItemName: "Shield",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "block",
                    embedding: [0, 0, 1],
                },
            ]);
            const chunks = await store.getChunksByRuleItemId("ri1");
            expect(chunks).toHaveLength(2);
            expect(chunks[0].chunkIndex).toBe(0);
            expect(chunks[1].chunkIndex).toBe(1);
            expect(chunks.map((c) => c.text)).toEqual(["part 1", "part 2"]);
        });

        it("filters by rule_item_id and excludes other items", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            await store.upsertChunks([
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "fire",
                    embedding: [1, 0, 0],
                },
                {
                    id: "c2",
                    ruleItemId: "ri2",
                    ruleItemName: "Shield",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "shield",
                    embedding: [0, 1, 0],
                },
            ]);
            const filter = fakeClient.calls.scroll;
            const chunks = await store.getChunksByRuleItemId("ri1");
            expect(chunks).toHaveLength(1);
            expect(filter.at(-1)?.opts.filter).toEqual({
                must: [{ key: "rule_item_id", match: { value: "ri1" } }],
            });
        });
    });

    describe("upsertChunks", () => {
        it("derives deterministic UUID v5 ids (idempotent)", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            const chunk = {
                id: "00000000-0000-4000-8000-000000000020-chunk-0",
                ruleItemId: "ri1",
                ruleItemName: "Fireball",
                ruleItemType: "spell",
                compendiumSource: null,
                chunkIndex: 0,
                text: "boom",
                embedding: [1, 0, 0],
            };
            await store.upsertChunks([chunk]);
            expect(fakeClient.pointCount("rule_chunks")).toBe(1);
            await store.upsertChunks([chunk]);
            expect(fakeClient.pointCount("rule_chunks")).toBe(1);
            const upsertCall = fakeClient.calls.upsert[0];
            const points = /** @type {Array<{ id: string }>} */ (upsertCall.opts.points);
            expect(points[0].id).toBe(uuidV5FromName(chunk.id));
        });

        it("calls upsert with wait: true", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            await store.upsertChunks([
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "boom",
                    embedding: [1, 0, 0],
                },
            ]);
            expect(fakeClient.calls.upsert[0].opts.wait).toBe(true);
        });

        it("validates payload shape via Zod (throws on missing field)", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            const badChunk = /** @type {import("./vector-store.js").VectorChunkForUpsert} */ (
                /** @type {unknown} */ ({
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemType: "spell",
                    chunkIndex: 0,
                    text: "boom",
                    embedding: [1, 0, 0],
                })
            );
            expect(store.upsertChunks([badChunk])).rejects.toThrow();
        });

        it("maps compendiumSource null to null payload", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            await store.upsertChunks([
                {
                    id: "c1",
                    ruleItemId: "ri1",
                    ruleItemName: "Fireball",
                    ruleItemType: "spell",
                    compendiumSource: null,
                    chunkIndex: 0,
                    text: "boom",
                    embedding: [1, 0, 0],
                },
            ]);
            const payload = /** @type {{ payload: Record<string, unknown> }[]} */ (
                fakeClient.calls.upsert[0].opts.points
            )[0].payload;
            expect(payload.compendium_source).toBeNull();
            expect(payload.chunk_id).toBe("c1");
        });
    });

    describe("isAvailable contract", () => {
        it("returns false before any ensureCollection() when client present", () => {
            const store = createVectorStore({ url: "http://example:6333" });
            expect(store.isAvailable()).toBe(false);
        });

        it("returns true only after successful ensureCollection()", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection(3);
            expect(store.isAvailable()).toBe(true);
        });

        it("returns false when ensureCollection reports unavailable", async () => {
            const store = createVectorStore({ url: "http://example:6333" });
            await store.ensureCollection();
            expect(store.isAvailable()).toBe(false);
        });
    });
});
