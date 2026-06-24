/**
 * Typed context variable accessors for Hono route handlers.
 * Hono's c.get() returns unknown when Variables aren't typed on the router instance,
 * so these helpers provide the correct types via JSDoc casts.
 */

/**
 * @param {import("hono").Context} c
 * @returns {import("bun:sqlite").Database}
 */
export function getDb(c) {
    return /** @type {import("bun:sqlite").Database} */ (c.get("db"));
}

/**
 * @param {import("hono").Context} c
 * @returns {string}
 */
export function getUserId(c) {
    return /** @type {string} */ (c.get("userId"));
}

/**
 * @param {import("hono").Context} c
 * @returns {string}
 */
export function getSessionId(c) {
    return /** @type {string} */ (c.get("sessionId"));
}

/**
 * @param {import("hono").Context} c
 * @returns {import("../utils/vector-store.js").VectorStore | null}
 */
export function getVectorStore(c) {
    return /** @type {import("../utils/vector-store.js").VectorStore | null} */ (
        c.get("vectorStore")
    );
}
