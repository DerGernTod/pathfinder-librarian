/**
 * Page-side Cache API query helpers for offline conversation availability.
 *
 * The service worker (`client/sw.js`) populates the `pwa-v1-api-data` cache
 * with `GET /api/conversations/:id/messages` responses via StaleWhileRevalidate.
 * This module lets session-list / conversation-menu query which conversations
 * have a cached copy so they can disable offline-only items.
 */

/** Name of the cache the SW writes conversation reads into. */
const CONVERSATION_CACHE = "pwa-v1-api-data";

/**
 * Build the cache-key URL for a conversation's messages endpoint.
 * @param {string} convId
 * @returns {string}
 */
function messagesUrl(convId) {
    return `/api/conversations/${convId}/messages`;
}

/**
 * Resolves to true if the given conversation's messages are in the
 * `pwa-v1-api-data` cache. If the Cache API is unavailable (happy-dom,
 * very old browsers), resolves to `true` so we never falsely disable items.
 *
 * @param {string} convId
 * @returns {Promise<boolean>}
 */
export async function isConversationCached(convId) {
    if (typeof caches === "undefined") {
        return true;
    }
    try {
        const cache = await caches.open(CONVERSATION_CACHE);
        const hit = await cache.match(messagesUrl(convId));
        return !!hit;
    } catch {
        return true;
    }
}

/**
 * Bulk variant of {@link isConversationCached}. Resolves to the Set of ids
 * from `ids` whose messages response is currently cached. When the Cache API
 * is unavailable, returns a Set containing every id (everything treated as
 * cached → nothing disabled).
 *
 * @param {Iterable<string>} ids
 * @returns {Promise<Set<string>>}
 */
export async function getCachedConversationIds(ids) {
    const all = new Set(/** @type {Iterable<string>} */ (ids));
    if (typeof caches === "undefined") {
        return all;
    }
    try {
        const cache = await caches.open(CONVERSATION_CACHE);
        /** @type {Set<string>} */
        const cached = new Set();
        await Promise.all(
            Array.from(all).map(async (id) => {
                try {
                    const hit = await cache.match(messagesUrl(id));
                    if (hit) {
                        cached.add(id);
                    }
                } catch {
                    // Treat lookup errors as "available" so we never over-disable.
                    cached.add(id);
                }
            }),
        );
        return cached;
    } catch {
        return all;
    }
}

export { CONVERSATION_CACHE };
