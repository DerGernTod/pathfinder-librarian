/// <reference lib="webworker" />
/**
 * Pathfinder Librarian service worker.
 *
 * Vanilla install/activate/fetch handlers — no Workbox, no build step.
 * Four runtime caches (no precache list to maintain) under a versioned
 * `pwa-v1-` prefix so activation can drop stale entries.
 *
 * Strategies (per modern-web-guidance):
 *   - `pwa-v1-pages`    NetworkFirst   for HTML navigations (falls back to cached /index.html)
 *   - `pwa-v1-static`   StaleWhileRevalidate for same-origin static assets
 *   - `pwa-v1-cdn`      StaleWhileRevalidate for cross-origin CDN imports (esm.sh, jsdelivr, Google Fonts)
 *   - `pwa-v1-api-data` StaleWhileRevalidate for GET /api/conversations and /api/conversations/:id/messages
 *
 * Non-GET requests are always passed through (never cached).
 */

// sw is a classic script; `self` is the ServiceWorkerGlobalScope at runtime.
// `typeof caches !== "undefined"` keeps imports tooling-friendly.

/** @typedef {ServiceWorkerGlobalScope & typeof globalThis} SWGlobal */

const CACHE_VERSION = "pwa-v1";
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CDN_CACHE = `${CACHE_VERSION}-cdn`;
const API_CACHE = `${CACHE_VERSION}-api-data`;

const CDN_HOSTS = new Set([
    "esm.sh",
    "cdn.jsdelivr.net",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
]);

const STATIC_DESTINATIONS = new Set(["script", "style", "font", "image"]);

const MAX_CDN_ENTRIES = 60;

/**
 * Trims a cache to its most-recent `maxEntries` entries by last-used order.
 * @param {string} cacheName
 * @param {number} maxEntries
 * @returns {Promise<void>}
 */
async function trimCache(cacheName, maxEntries) {
    if (typeof caches === "undefined") {
        return;
    }
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        if (keys.length <= maxEntries) {
            return;
        }
        // Drop oldest (FIFO — keys are returned in insertion order).
        const drop = keys.slice(0, keys.length - maxEntries);
        await Promise.all(drop.map((req) => cache.delete(req)));
    } catch {
        // Cache maintenance is best-effort.
    }
}

/**
 * StaleWhileRevalidate: serve cached copy immediately, fetch fresh in
 * background, and update the cache when the fresh response is cacheable.
 *
 * @param {Request} request
 * @param {string} cacheName
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(request, cacheName) {
    if (typeof caches === "undefined") {
        return fetch(request);
    }
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const networkFetch = fetch(request)
        .then((response) => {
            // Only cache basic (same-origin or valid CORS) 200/0 responses.
            if (response && (response.ok || response.status === 0) && response.type !== "opaque") {
                cache.put(request, response.clone()).catch(() => {});
            } else if (response && response.type === "opaque" && response.status === 0) {
                // Opaque responses from CORS-less CDNs: cache as 0.
                cache.put(request, response.clone()).catch(() => {});
            }
            return response;
        })
        .catch(() => undefined);
    if (cached) {
        // Background revalidate; serve stale immediately.
        void networkFetch;
        return cached;
    }
    const fresh = await networkFetch;
    return fresh ?? Response.error();
}

/**
 * NetworkFirst: try network, fall back to cache, lastly the precached
 * app shell at `/`.
 *
 * The cached entry for the navigation URL itself may be missing (e.g.
 * on a deep link the user has never visited online), so we always fall
 * back to the precached `/` shell — the SPA router then rehydrates the
 * deep-linked route client-side.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
    if (typeof caches === "undefined") {
        return fetch(request);
    }
    try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(request, fresh.clone()).catch(() => {});
        }
        return fresh;
    } catch {
        const cache = await caches.open(PAGES_CACHE);
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        // Fall back to the precached app shell so deep links still load
        // the SPA client-side.
        const shell = await cache.match("/");
        if (shell) {
            return shell;
        }
        throw new Error("offline and no cached page available");
    }
}

self.addEventListener("install", (event) => {
    const extendable = /** @type {ExtendableEvent} */ (/** @type {unknown} */ (event));
    // Precache the app shell so offline navigation can fall back to it.
    // Without this, the first navigation (which the SW does not yet
    // control) is never cached, and reloads while offline fail with
    // ERR_FAILED even though API data is cached.
    //
    // The shell HTML references /index.js as a classic module script; if
    // we only cache `/`, an offline reload loads the HTML but then fails
    // to load /index.js and the page stays blank. Pre-fetch both so the
    // entry point can boot offline.
    extendable.waitUntil(
        (async () => {
            if (typeof caches === "undefined") {
                return;
            }
            try {
                const cache = await caches.open(PAGES_CACHE);
                await Promise.all([cache.add("/"), cache.add("/index.js")]);
            } catch {
                // Best-effort — don't fail install if the precache misses
                // (e.g. offline at install time).
            }
            const sw = /** @type {SWGlobal} */ (/** @type {unknown} */ (self));
            void sw.skipWaiting?.();
        })(),
    );
});

self.addEventListener("activate", (event) => {
    const extendable = /** @type {ExtendableEvent} */ (/** @type {unknown} */ (event));
    extendable.waitUntil(
        (async () => {
            if (typeof caches === "undefined") {
                return;
            }
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => !key.startsWith(`${CACHE_VERSION}-`))
                    .map((key) => caches.delete(key)),
            );
            // Claim all open clients so the SW controls the very first
            // navigation of a session. Without this, fetches on the page
            // that registered the SW bypass the SW entirely — meaning
            // viewed conversations are never cached and become
            // inaccessible once the user goes offline (the SW only
            // started intercepting on the *next* reload).
            const sw = /** @type {SWGlobal} */ (/** @type {unknown} */ (self));
            await sw.clients.claim();
        })(),
    );
});

self.addEventListener("fetch", (event) => {
    const fetchEvent = /** @type {FetchEvent} */ (/** @type {unknown} */ (event));
    const request = fetchEvent.request;

    // Never intercept non-GET/HEAD — modern-web-guidance: never cache POST/PUT/PATCH/DELETE.
    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    // 1) Navigations → NetworkFirst.
    if (request.mode === "navigate") {
        fetchEvent.respondWith(networkFirst(request));
        return;
    }

    // Only handle same-origin or known CDN hosts; anything else passes through.
    const sameOrigin = url.origin === self.location.origin;
    const isCdn = CDN_HOSTS.has(url.hostname);

    if (!sameOrigin && !isCdn) {
        return;
    }

    // 2) CDN imports → SWR with bounded cache.
    if (isCdn) {
        fetchEvent.respondWith(
            (async () => {
                const response = await staleWhileRevalidate(request, CDN_CACHE);
                void trimCache(CDN_CACHE, MAX_CDN_ENTRIES);
                return response;
            })(),
        );
        return;
    }

    // 3) Same-origin static assets → SWR.
    if (STATIC_DESTINATIONS.has(request.destination)) {
        fetchEvent.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
        return;
    }

    // 4) Read-only conversation API.
    //    - Conversation list (GET /api/conversations): StaleWhileRevalidate
    //      is fine because the page-side store invalidates on mutations.
    //    - Per-conversation messages (GET /api/conversations/:id/messages):
    //      NetworkFirst — these change on every submit, so always prefer the
    //      fresh network copy and only fall back to cache when truly offline.
    //    - Current user (GET /api/auth/me): NetworkFirst so a freshly
    //      updated user object wins, but offline reload can still
    //      authenticate the session from cache.
    //    POST messages, archived GETs, login/logout, version, devices are
    //    excluded by method (above) or path (below).
    if (url.pathname === "/api/conversations") {
        fetchEvent.respondWith(staleWhileRevalidate(request, API_CACHE));
        return;
    }
    if (/^\/api\/conversations\/[^/]+\/messages$/.test(url.pathname)) {
        fetchEvent.respondWith(networkFirstApi(request, API_CACHE));
        return;
    }
    if (url.pathname === "/api/auth/me") {
        fetchEvent.respondWith(networkFirstApi(request, API_CACHE));
        return;
    }

    // Everything else passes through.
});

/**
 * NetworkFirst variant for read-only API endpoints whose payload changes on
 * every mutation (e.g. message lists). Always tries the network; only falls
 * back to cache when the request throws (offline).
 *
 * @param {Request} request
 * @param {string} cacheName
 * @returns {Promise<Response>}
 */
async function networkFirstApi(request, cacheName) {
    if (typeof caches === "undefined") {
        return fetch(request);
    }
    try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok && fresh.type !== "opaque") {
            const cache = await caches.open(cacheName);
            cache.put(request, fresh.clone()).catch(() => {});
        }
        return fresh;
    } catch {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        return Response.error();
    }
}
