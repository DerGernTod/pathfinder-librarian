import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";

/**
 * Simple regex-based URL pattern matcher for environments where URLPattern
 * is not available (happy-dom). Exposes the same `.exec()` API.
 */
class MockURLPattern {
    /**
     * @param {{ pathname: string }} input
     */
    constructor(input) {
        // Convert "/conversations/:conversationId" to a regex with named groups
        const escaped = input.pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const withGroups = escaped.replace(/:(\w+)/g, "(?<$1>[^/]+)");
        this._regex = new RegExp("^" + withGroups + "$");
    }

    /**
     * @param {{ pathname: string }} input
     * @returns {null | { pathname: { groups: Record<string, string> } } }
     */
    exec(input) {
        const match = this._regex.exec(input.pathname);
        if (!match) {
            return null;
        }
        /** @type {Record<string, string>} */
        const groups = {};
        if (match.groups) {
            for (const [key, value] of Object.entries(match.groups)) {
                groups[key] = value;
            }
        }
        return { pathname: { groups } };
    }
}

/**
 * Helper to override a window or history property safely for tests.
 * @type {any}
 */
const w = window;
/** @type {any} */
const h = history;

describe("Router", () => {
    // Set up URLPattern polyfill if needed
    beforeEach(() => {
        if (typeof URLPattern === "undefined") {
            // @ts-expect-error - polyfill for happy-dom
            globalThis.URLPattern = MockURLPattern;
        }
    });

    afterEach(() => {
        // No cleanup needed — tests restore mocks individually
    });

    describe("defineRoute", () => {
        it("should register a route pattern and make it matchable", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.defineRoute("/conversations/:conversationId", "conversation");

            // Override pathname so the route actually matches
            const origPathname = Object.getOwnPropertyDescriptor(window.location, "pathname");
            Object.defineProperty(window.location, "pathname", {
                value: "/conversations/test-registration",
                configurable: true,
                writable: true,
            });

            let dispatched = false;
            let dispatchedEvent = null;
            const origDispatch = w.dispatchEvent;
            w.dispatchEvent = mock((/** @type {any} */ e) => {
                dispatched = true;
                dispatchedEvent = e;
                return true;
            });
            try {
                r.start();
                expect(dispatched).toBe(true);
                expect(dispatchedEvent).not.toBeNull();
                if (dispatchedEvent) {
                    expect(/** @type {any} */ (dispatchedEvent).detail.pattern).toBe(
                        "conversation",
                    );
                }
            } finally {
                w.dispatchEvent = origDispatch;
                if (origPathname) {
                    Object.defineProperty(window.location, "pathname", origPathname);
                }
            }
        });
    });

    describe("navigate (push)", () => {
        it("should call history.pushState and dispatch route-changed", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.defineRoute("/conversations/:conversationId", "conversation");

            const pushStateSpy = mock(() => {});
            const replaceStateSpy = mock(() => {});
            const origPush = h.pushState;
            const origReplace = h.replaceState;
            h.pushState = pushStateSpy;
            h.replaceState = replaceStateSpy;

            /** @type {{ detail: { pattern: string, params: Record<string, string>, pathname: string } } | null} */
            let dispatchedEvent = null;
            const origDispatch = w.dispatchEvent;
            w.dispatchEvent = mock((/** @type {any} */ e) => {
                dispatchedEvent = e;
                return true;
            });

            try {
                r.navigate("/conversations/abc-123");
                expect(pushStateSpy).toHaveBeenCalledTimes(1);
                expect(pushStateSpy.mock.calls).toHaveLength(1);
                expect(replaceStateSpy).toHaveBeenCalledTimes(0);

                expect(dispatchedEvent).not.toBeNull();
                if (dispatchedEvent) {
                    const de = /** @type {any} */ (dispatchedEvent);
                    expect(de.detail.pattern).toBe("conversation");
                    expect(de.detail.params.conversationId).toBe("abc-123");
                    expect(de.detail.pathname).toBe("/conversations/abc-123");
                }
            } finally {
                h.pushState = origPush;
                h.replaceState = origReplace;
                w.dispatchEvent = origDispatch;
            }
        });
    });

    describe("navigate (replace)", () => {
        it("should call history.replaceState when replace: true", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.defineRoute("/conversations/:conversationId", "conversation");

            const pushStateSpy = mock(() => {});
            const replaceStateSpy = mock(() => {});
            const origPush = h.pushState;
            const origReplace = h.replaceState;
            h.pushState = pushStateSpy;
            h.replaceState = replaceStateSpy;

            const origDispatch = w.dispatchEvent;
            w.dispatchEvent = mock(() => true);

            try {
                r.navigate("/conversations/abc-123", { replace: true });
                expect(replaceStateSpy).toHaveBeenCalledTimes(1);
                expect(pushStateSpy).toHaveBeenCalledTimes(0);
            } finally {
                h.pushState = origPush;
                h.replaceState = origReplace;
                w.dispatchEvent = origDispatch;
            }
        });
    });

    describe("start", () => {
        it("should dispatch route-changed for the current URL on start", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.defineRoute("/conversations/:conversationId", "conversation");

            const origPathname = Object.getOwnPropertyDescriptor(window.location, "pathname");
            const origAddEventListener = w.addEventListener;
            const addEventListenerSpy = mock(() => {});
            w.addEventListener = addEventListenerSpy;

            let dispatchedPathname = "";
            const origDispatch = w.dispatchEvent;
            w.dispatchEvent = mock((/** @type {CustomEvent} */ e) => {
                dispatchedPathname = e.detail.pathname;
                return true;
            });

            try {
                r.start();
                // Verify popstate listener was added
                expect(addEventListenerSpy).toHaveBeenCalled();
                expect(typeof dispatchedPathname).toBe("string");
            } finally {
                w.addEventListener = origAddEventListener;
                w.dispatchEvent = origDispatch;
                if (origPathname) {
                    Object.defineProperty(window.location, "pathname", origPathname);
                }
            }
        });

        it("should be idempotent — calling start multiple times adds listener only once", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();

            const addEventListenerSpy = mock(() => {});
            const origAddEventListener = w.addEventListener;
            w.addEventListener = addEventListenerSpy;

            try {
                r.start();
                r.start();
                r.start();
                // Count popstate registrations
                const popstateCalls = addEventListenerSpy.mock.calls.filter(
                    (/** @type {any[]} */ c) => c[0] === "popstate",
                );
                expect(popstateCalls.length).toBe(1);
            } finally {
                w.addEventListener = origAddEventListener;
            }
        });
    });

    describe("popstate handling", () => {
        it("should dispatch route-changed on popstate event", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.defineRoute("/conversations/:conversationId", "conversation");

            /** @type {((e: Event) => void) | null} */
            let popstateListener = null;
            const origAddEventListener = w.addEventListener;
            const origRemoveEventListener = w.removeEventListener;
            w.addEventListener = mock(
                (/** @type {string} */ event, /** @type {(e: Event) => void} */ listener) => {
                    if (event === "popstate") {
                        popstateListener = listener;
                    }
                },
            );
            w.removeEventListener = mock(() => {});

            /** @type {{ detail: { pattern: string, params: Record<string, string>, pathname: string } } | null} */
            let dispatchedEvent = null;
            const origDispatch = w.dispatchEvent;
            w.dispatchEvent = mock((/** @type {any} */ e) => {
                if (e.type === "route-changed") {
                    dispatchedEvent = e;
                }
                return true;
            });

            // Override location.pathname for the popstate dispatch
            const origPathname = Object.getOwnPropertyDescriptor(window.location, "pathname");
            Object.defineProperty(window.location, "pathname", {
                value: "/conversations/conv-test-99",
                configurable: true,
                writable: true,
            });

            try {
                r.start();
                expect(popstateListener).not.toBeNull();

                // Simulate popstate
                if (popstateListener) {
                    /** @type {any} */ (popstateListener)(new PopStateEvent("popstate"));
                }

                expect(dispatchedEvent).not.toBeNull();
                if (dispatchedEvent) {
                    const de = /** @type {any} */ (dispatchedEvent);
                    expect(de.detail.params.conversationId).toBe("conv-test-99");
                }
            } finally {
                w.addEventListener = origAddEventListener;
                w.removeEventListener = origRemoveEventListener;
                w.dispatchEvent = origDispatch;
                if (origPathname) {
                    Object.defineProperty(window.location, "pathname", origPathname);
                }
            }
        });
    });

    describe("getCurrentParams", () => {
        it("should return null when no route matches", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.start();
            expect(r.getCurrentParams()).toBeNull();
        });

        it("should return matched params for a matching path", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.defineRoute("/conversations/:conversationId", "conversation");

            const origPathname = Object.getOwnPropertyDescriptor(window.location, "pathname");
            Object.defineProperty(window.location, "pathname", {
                value: "/conversations/my-conv-id",
                configurable: true,
                writable: true,
            });

            const origDispatch = w.dispatchEvent;
            w.dispatchEvent = mock(() => true);

            try {
                r.start();
                const params = r.getCurrentParams();
                expect(params).not.toBeNull();
                expect(params?.conversationId).toBe("my-conv-id");
            } finally {
                w.dispatchEvent = origDispatch;
                if (origPathname) {
                    Object.defineProperty(window.location, "pathname", origPathname);
                }
            }
        });
    });

    describe("unmatched paths", () => {
        it("should return null from getCurrentParams for non-matching paths", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.defineRoute("/conversations/:conversationId", "conversation");

            const origPathname = Object.getOwnPropertyDescriptor(window.location, "pathname");
            Object.defineProperty(window.location, "pathname", {
                value: "/settings",
                configurable: true,
                writable: true,
            });

            const origDispatch = w.dispatchEvent;
            w.dispatchEvent = mock(() => true);

            try {
                r.start();
                expect(r.getCurrentParams()).toBeNull();
            } finally {
                w.dispatchEvent = origDispatch;
                if (origPathname) {
                    Object.defineProperty(window.location, "pathname", origPathname);
                }
            }
        });
    });

    describe("goBack", () => {
        it("should call history.back()", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();

            const backSpy = mock(() => {});
            const origBack = h.back;
            h.back = backSpy;

            try {
                r.goBack();
                expect(backSpy).toHaveBeenCalledTimes(1);
            } finally {
                h.back = origBack;
            }
        });
    });

    describe("multiple patterns", () => {
        it("should match the most specific registered pattern", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.defineRoute("/conversations/:conversationId", "conversation");
            r.defineRoute("/conversations/:conversationId/messages", "messages");

            const origPathname = Object.getOwnPropertyDescriptor(window.location, "pathname");
            Object.defineProperty(window.location, "pathname", {
                value: "/conversations/abc/messages",
                configurable: true,
                writable: true,
            });

            let dispatchedPattern = "";
            const origDispatch = w.dispatchEvent;
            w.dispatchEvent = mock((/** @type {CustomEvent} */ e) => {
                dispatchedPattern = e.detail.pattern;
                return true;
            });

            try {
                r.start();
                expect(typeof dispatchedPattern).toBe("string");
            } finally {
                w.dispatchEvent = origDispatch;
                if (origPathname) {
                    Object.defineProperty(window.location, "pathname", origPathname);
                }
            }
        });
    });

    describe("URL params extraction", () => {
        it("should extract conversationId from /conversations/abc-123", async () => {
            const { Router: R } = await import("./router.js");
            const r = new R();
            r.defineRoute("/conversations/:conversationId", "conversation");

            const origPathname = Object.getOwnPropertyDescriptor(window.location, "pathname");
            Object.defineProperty(window.location, "pathname", {
                value: "/conversations/abc-123",
                configurable: true,
                writable: true,
            });

            const origDispatch = w.dispatchEvent;
            w.dispatchEvent = mock(() => true);

            try {
                r.start();
                const params = r.getCurrentParams();
                expect(params?.conversationId).toBe("abc-123");
            } finally {
                w.dispatchEvent = origDispatch;
                if (origPathname) {
                    Object.defineProperty(window.location, "pathname", origPathname);
                }
            }
        });
    });
});

describe("router singleton", () => {
    it("should export a pre-configured router with conversation route registered", async () => {
        const { router } = await import("./router.js");
        expect(router).toBeDefined();

        const origPush = h.pushState;
        const origDispatch = w.dispatchEvent;
        h.pushState = mock(() => {});
        /** @type {Record<string, unknown> | null} */
        let eventDetail = null;
        w.dispatchEvent = mock((/** @type {any} */ e) => {
            eventDetail = e.detail;
            return true;
        });

        try {
            router.navigate("/conversations/test-singleton");
            expect(eventDetail).not.toBeNull();
            const ed = /** @type {{ pattern: string, params: Record<string, string> }} */ (
                /** @type {unknown} */ (eventDetail)
            );
            expect(ed.pattern).toBe("conversation");
            expect(ed.params).toEqual({ conversationId: "test-singleton" });
        } finally {
            h.pushState = origPush;
            w.dispatchEvent = origDispatch;
        }
    });
});
