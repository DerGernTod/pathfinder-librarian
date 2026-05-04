/**
 * Lightweight client-side router using URLPattern + History API.
 *
 * Fires a "route-changed" CustomEvent on `window` when the route changes
 * (pushState, replaceState, popstate, or initial load). Does NOT use
 * hash-based routing. All paths are real paths managed via the History API.
 *
 * @typedef {{ pattern: string, params: Record<string, string>, pathname: string }} RouteChangeDetail
 */

class Router {
    constructor() {
        /** @type {Map<string, { pattern: URLPattern, handler: string }>} */
        this._routes = new Map();
        /** @type {boolean} */
        this._started = false;
        /** @type {RouteChangeDetail | null} */
        this._currentMatch = null;

        this._onPopState = this._onPopState.bind(this);
    }

    /**
     * Register a route pattern with a handler name.
     * @param {string} pathPattern - URL pattern (e.g. "/conversations/:conversationId")
     * @param {string} handler - Identifier for the matched route
     */
    defineRoute(pathPattern, handler) {
        this._routes.set(handler, {
            pattern: new URLPattern({ pathname: pathPattern }),
            handler,
        });
    }

    /**
     * Navigate to a path, updating browser history and firing route-changed.
     * @param {string} path - URL path to navigate to
     * @param {{ replace?: boolean }} [opts]
     */
    navigate(path, opts) {
        const replace = opts?.replace ?? false;
        if (replace) {
            history.replaceState(null, "", path);
        } else {
            history.pushState(null, "", path);
        }
        this._dispatch(path);
    }

    /**
     * Start listening for popstate and dispatch the initial route.
     * Idempotent — calling multiple times has no effect.
     */
    start() {
        if (this._started) {
            return;
        }
        this._started = true;
        window.addEventListener("popstate", this._onPopState);
        // Dispatch for the initial URL
        this._dispatch(window.location.pathname);
    }

    /**
     * Get params from the current URL match, or null if no route matches.
     * @returns {Record<string, string> | null}
     */
    getCurrentParams() {
        if (!this._currentMatch) {
            return null;
        }
        return { ...this._currentMatch.params };
    }

    /**
     * Navigate back in browser history.
     */
    goBack() {
        history.back();
    }

    /**
     * Try to match a pathname against registered routes and dispatch if matched.
     * @param {string} pathname
     */
    _dispatch(pathname) {
        for (const [, route] of this._routes) {
            const match = route.pattern.exec({ pathname });
            if (match) {
                /** @type {Record<string, string>} */
                const params = {};
                for (const [key, value] of Object.entries(match.pathname.groups)) {
                    if (value !== undefined) {
                        params[key] = value;
                    }
                }
                this._currentMatch = { pattern: route.handler, params, pathname };
                window.dispatchEvent(
                    new CustomEvent("route-changed", {
                        detail: { pattern: route.handler, params, pathname },
                    }),
                );
                return;
            }
        }
        // No match — clear the current match
        this._currentMatch = null;
    }

    /**
     * Handle browser popstate events (back/forward navigation).
     */
    _onPopState() {
        this._dispatch(window.location.pathname);
    }
}

/** @type {Router} Singleton router instance */
const router = new Router();

// Register Phase 1 routes
router.defineRoute("/conversations/:conversationId", "conversation");

export { Router, router };
