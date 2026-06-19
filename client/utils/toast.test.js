import { describe, expect, it, mock } from "bun:test";

import { showToast } from "./toast.js";

describe("toast helper", () => {
    /**
     * @returns {{ captured: { variant: string, message: string, duration: number } | null, off: () => void }}
     */
    function subscribe() {
        /** @type {{ variant: string, message: string, duration: number } | null} */
        let captured = null;
        const listener = (/** @type {Event} */ e) => {
            const ev =
                /** @type {CustomEvent<{ variant: string, message: string, duration: number }>} */ (
                    /** @type {unknown} */ (e)
                );
            captured = ev.detail;
        };
        window.addEventListener("app-toast", listener);
        return {
            get captured() {
                return captured;
            },
            off: () => window.removeEventListener("app-toast", listener),
        };
    }

    it("dispatches an app-toast window event with the given payload", () => {
        const sub = subscribe();
        try {
            showToast("warning", "You're offline", 2500);
            expect(sub.captured).not.toBeNull();
            expect(sub.captured?.variant).toBe("warning");
            expect(sub.captured?.message).toBe("You're offline");
            expect(sub.captured?.duration).toBe(2500);
        } finally {
            sub.off();
        }
    });

    it("defaults duration to 3000ms", () => {
        const sub = subscribe();
        try {
            showToast("success", "ok");
            expect(sub.captured?.duration).toBe(3000);
        } finally {
            sub.off();
        }
    });

    it("does not throw when window is undefined", () => {
        // oxlint-disable-next-line no-explicit-any -- intentional env swap for test
        const saved = /** @type {any} */ (/** @type {unknown} */ (globalThis.window));
        // @ts-expect-error — testing absent-window branch
        delete globalThis.window;
        const fn = mock(() => showToast("warning", "noop"));
        try {
            expect(fn).not.toThrow();
        } finally {
            globalThis.window = /** @type {Window & typeof globalThis} */ (saved);
        }
    });
});
