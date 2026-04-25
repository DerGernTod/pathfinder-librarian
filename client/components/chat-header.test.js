import "./chat-header.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { getByText } from "@testing-library/dom";

describe("chat-header", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /** @param {string} mode */
    function createHeader(mode = "player") {
        /** @type {any} */
        const el = document.createElement("chat-header");
        el.mode = mode;
        document.body.appendChild(el);
        return el;
    }

    it("renders title", async () => {
        const el = createHeader();
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Pathfinder 2e")).toBeTruthy();
    });

    it("renders subtitle", async () => {
        const el = createHeader();
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Rules Assistant")).toBeTruthy();
    });

    it("renders mode-toggle child", async () => {
        const el = createHeader();
        await el.updateComplete;
        const toggle = el.shadowRoot.querySelector("mode-toggle");
        expect(toggle).toBeTruthy();
    });

    it("passes mode to mode-toggle", async () => {
        const el = createHeader("gm");
        await el.updateComplete;
        const toggle = /** @type {any} */ (el.shadowRoot.querySelector("mode-toggle"));
        expect(toggle.mode).toBe("gm");
    });

    it("dispatches mode-change when mode-toggle fires mode-change", async () => {
        const el = createHeader("player");
        await el.updateComplete;

        /** @type {any} */
        let detail = null;
        el.addEventListener(
            "mode-change",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        const toggle = /** @type {any} */ (el.shadowRoot.querySelector("mode-toggle"));
        toggle.dispatchEvent(
            new CustomEvent("mode-change", {
                detail: { mode: "gm" },
                bubbles: true,
                composed: true,
            }),
        );

        await el.updateComplete;
        expect(detail).toBeTruthy();
        if (detail) {
            expect(detail.mode).toBe("gm");
        }
    });

    it("updates own mode when mode-toggle fires mode-change", async () => {
        const el = createHeader("player");
        await el.updateComplete;

        const toggle = /** @type {any} */ (el.shadowRoot.querySelector("mode-toggle"));
        toggle.dispatchEvent(
            new CustomEvent("mode-change", {
                detail: { mode: "gm" },
                bubbles: true,
                composed: true,
            }),
        );

        await el.updateComplete;
        expect(el.mode).toBe("gm");
    });
});
