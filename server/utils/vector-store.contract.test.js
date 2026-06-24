import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { createVectorStore } from "./vector-store.js";

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "rule_chunks_contract";

/**
 * Real-wire round-trip test against a live Qdrant. Skipped locally when
 * QDRANT_URL is unset (so `bun run test` stays green on dev machines and in
 * non-test CI jobs). Runs in CI via the `qdrant` service container.
 */
describe.skipIf(!QDRANT_URL)("vector-store contract (live Qdrant)", () => {
    if (!QDRANT_URL) {
        return;
    }

    /** @type {ReturnType<typeof createVectorStore>} */
    let store;

    beforeAll(async () => {
        // Other test files mock `globalThis.fetch` directly. bun:test's
        // `mock.restore()` does NOT revert manual `globalThis.fetch` assignments,
        // so the mock leaks across files in the same process and the qdrant client
        // would see a plain object instead of a real Response (whose `.headers`
        // accessor is undefined) — every request would throw
        // "undefined is not an object (evaluating 'response.headers.get')".
        // `Bun.fetch` is the un-mockable original; restore it before constructing
        // the store so the qdrant client captures a real fetch.
        const realFetch = /** @type {{ fetch?: typeof fetch } | undefined} */ (
            /** @type {unknown} */ (globalThis.Bun)
        )?.fetch;
        if (realFetch) {
            globalThis.fetch = realFetch;
        }
        store = createVectorStore({
            url: QDRANT_URL,
            collection: QDRANT_COLLECTION,
        });
    });

    afterAll(async () => {
        if (store && store.client) {
            try {
                await store.client.deleteCollection(QDRANT_COLLECTION);
            } catch {
                // Best-effort teardown.
            }
        }
    });

    it("creates the collection when absent and reports available", async () => {
        const ok = await store.ensureCollection(8);
        expect(ok).toBe(true);
        expect(store.isAvailable()).toBe(true);
    });

    it("idempotent: a second ensureCollection() does not re-create", async () => {
        const ok = await store.ensureCollection(8);
        expect(ok).toBe(true);
        expect(store.isAvailable()).toBe(true);
    });

    it("upserts and searches returning nearer vector first", async () => {
        await store.upsertChunks([
            {
                id: "contract-a",
                ruleItemId: "ri-a",
                ruleItemName: "Alpha",
                ruleItemType: "spell",
                compendiumSource: "Test",
                chunkIndex: 0,
                text: "alpha text",
                embedding: [1, 0, 0, 0, 0, 0, 0, 0],
            },
            {
                id: "contract-b",
                ruleItemId: "ri-b",
                ruleItemName: "Beta",
                ruleItemType: "spell",
                compendiumSource: null,
                chunkIndex: 0,
                text: "beta text",
                embedding: [0, 1, 0, 0, 0, 0, 0, 0],
            },
        ]);

        const results = await store.search([1, 0, 0, 0, 0, 0, 0, 0], { topN: 2 });
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].chunk.ruleItemId).toBe("ri-a");
        expect(results[0].chunk.ruleItemName).toBe("Alpha");
        expect(results[0].chunk.compendiumSource).toBe("Test");
        expect(results[0].score).toBeGreaterThan(0);
    });

    it("re-upserting the same ids keeps point count stable", async () => {
        if (!store.client) {
            expect(store.client).not.toBeNull();
            return;
        }
        const before = await store.client.getCollection(store.collectionName);
        const beforeCount = before.points_count ?? 0;

        await store.upsertChunks([
            {
                id: "contract-a",
                ruleItemId: "ri-a",
                ruleItemName: "Alpha",
                ruleItemType: "spell",
                compendiumSource: "Test",
                chunkIndex: 0,
                text: "alpha text updated",
                embedding: [1, 0, 0, 0, 0, 0, 0, 0],
            },
        ]);

        if (!store.client) {
            return;
        }
        const after = await store.client.getCollection(store.collectionName);
        const afterCount = after.points_count ?? 0;
        expect(afterCount).toBe(beforeCount);
    });

    it("getChunksByRuleItemId returns matching chunks sorted by chunk_index", async () => {
        await store.upsertChunks([
            {
                id: "contract-c1",
                ruleItemId: "ri-c",
                ruleItemName: "Gamma",
                ruleItemType: "spell",
                compendiumSource: null,
                chunkIndex: 1,
                text: "gamma part 1",
                embedding: [0, 0, 1, 0, 0, 0, 0, 0],
            },
            {
                id: "contract-c0",
                ruleItemId: "ri-c",
                ruleItemName: "Gamma",
                ruleItemType: "spell",
                compendiumSource: null,
                chunkIndex: 0,
                text: "gamma part 0",
                embedding: [0, 0, 1, 0, 0, 0, 0, 0],
            },
        ]);
        const chunks = await store.getChunksByRuleItemId("ri-c");
        expect(chunks.length).toBeGreaterThanOrEqual(2);
        const indices = chunks.map((c) => c.chunkIndex);
        const sorted = [...indices].sort((a, b) => a - b);
        expect(indices).toEqual(sorted);
    });
});
