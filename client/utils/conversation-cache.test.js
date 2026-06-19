import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
    CONVERSATION_CACHE,
    cacheConversationList,
    cacheConversationMessages,
    getCachedConversationIds,
    invalidateConversationCache,
    isConversationCached,
} from "./conversation-cache.js";

describe("conversation-cache", () => {
    /** @type {Map<string, Response>} */
    let store;
    /** @type {unknown} */
    let savedCaches;

    beforeEach(() => {
        store = new Map();
        savedCaches = Reflect.get(globalThis, "caches");
        // happy-dom does NOT provide `caches`; mimic the SW cache with an
        // in-memory store that supports match/put/delete (the three Cache
        // methods conversation-cache.js calls).
        const cacheStub = {
            match: async (/** @type {string | Request} */ req) => {
                const url = typeof req === "string" ? req : req.url;
                return store.get(url);
            },
            put: async (/** @type {string | Request} */ req, /** @type {Response} */ res) => {
                const url = typeof req === "string" ? req : req.url;
                store.set(url, res.clone());
            },
            delete: async (/** @type {string | Request} */ req) => {
                const url = typeof req === "string" ? req : req.url;
                return store.delete(url);
            },
        };
        const stub = {
            open: async () => cacheStub,
            match: async (/** @type {string | Request} */ req) => {
                const url = typeof req === "string" ? req : req.url;
                return store.get(url);
            },
        };
        globalThis.caches = /** @type {CacheStorage} */ (/** @type {unknown} */ (stub));
    });

    afterEach(() => {
        if (savedCaches === undefined) {
            // @ts-expect-error — restoring test stub state; delete isn't in the lib type
            delete globalThis.caches;
        } else {
            globalThis.caches = /** @type {CacheStorage} */ (savedCaches);
        }
    });

    it("exposes the canonical cache name used by the service worker", () => {
        expect(CONVERSATION_CACHE).toBe("pwa-v1-api-data");
    });

    it("resolves false when conversation is not cached", async () => {
        expect(await isConversationCached("missing")).toBe(false);
    });

    it("cacheConversationMessages makes the conversation cached", async () => {
        await cacheConversationMessages("conv-1", [{ id: "m1", role: "user", content: "hi" }]);
        expect(await isConversationCached("conv-1")).toBe(true);
    });

    it("cacheConversationList writes the list payload to /api/conversations", async () => {
        await cacheConversationList([{ id: "conv-x", title: "X" }]);
        const res = store.get("/api/conversations");
        expect(res).toBeTruthy();
        const json = await res?.json();
        expect(json.data).toHaveLength(1);
        expect(json.data[0].id).toBe("conv-x");
    });

    it("invalidateConversationCache drops the list", async () => {
        await cacheConversationList([{ id: "conv-x" }]);
        await invalidateConversationCache();
        expect(store.has("/api/conversations")).toBe(false);
    });

    it("invalidateConversationCache drops a specific conversation's messages", async () => {
        await cacheConversationMessages("conv-1", [{ id: "m1" }]);
        await invalidateConversationCache({ conversationId: "conv-1" });
        expect(await isConversationCached("conv-1")).toBe(false);
    });

    it("bulk lookup returns cached ids after page-side writes", async () => {
        await cacheConversationMessages("a", []);
        await cacheConversationMessages("c", []);
        const set = await getCachedConversationIds(["a", "b", "c", "d"]);
        expect(set.has("a")).toBe(true);
        expect(set.has("c")).toBe(true);
        expect(set.has("b")).toBe(false);
        expect(set.has("d")).toBe(false);
        expect(set.size).toBe(2);
    });

    it("treats absent `caches` global as 'everything cached'", async () => {
        delete (
            /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis)).caches
        );
        expect(await isConversationCached("anything")).toBe(true);
        const set = await getCachedConversationIds(["a", "b", "c"]);
        expect(set.size).toBe(3);
    });

    it("cache write no-ops silently when `caches` is absent", async () => {
        delete (
            /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis)).caches
        );
        await cacheConversationMessages("x", []);
        await cacheConversationList([]);
        await invalidateConversationCache();
    });
});
