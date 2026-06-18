import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
    CONVERSATION_CACHE,
    getCachedConversationIds,
    isConversationCached,
} from "./conversation-cache.js";

describe("conversation-cache", () => {
    /** @type {Set<string>} */
    let seeded;
    /** @type {unknown} */
    let savedCaches;

    beforeEach(() => {
        seeded = new Set();
        savedCaches = Reflect.get(globalThis, "caches");
        // happy-dom does NOT provide `caches`; mimic the SW cache with a stub.
        const stub = {
            open: async () => ({
                match: async (/** @type {string | Request} */ req) => {
                    const url = typeof req === "string" ? req : req.url;
                    const id = /\/api\/conversations\/([^/]+)\/messages$/.exec(url)?.[1];
                    if (id && seeded.has(id)) {
                        return new Response("{}", { status: 200 });
                    }
                    return undefined;
                },
            }),
            match: async () => undefined,
        };
        // The full DOM `CacheStorage` interface is much larger; we only stub the
        // two methods conversation-cache.js calls.
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

    it("resolves true when conversation is cached", async () => {
        seeded.add("conv-1");
        expect(await isConversationCached("conv-1")).toBe(true);
    });

    it("resolves false when conversation is not cached", async () => {
        expect(await isConversationCached("missing")).toBe(false);
    });

    it("bulk lookup returns only cached ids", async () => {
        seeded.add("a").add("c");
        const set = await getCachedConversationIds(["a", "b", "c", "d"]);
        expect(set).toBeInstanceOf(Set);
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
        expect(set.has("a")).toBe(true);
    });
});
