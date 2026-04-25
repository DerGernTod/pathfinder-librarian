import "./mode-toggle.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent, getByText } from "@testing-library/dom";

describe("mode-toggle", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /** @param {string} mode */
    function createToggle(mode = "player") {
        /** @type {any} */
        const el = document.createElement("mode-toggle");
        el.mode = mode;
        document.body.appendChild(el);
        return el;
    }

    it("renders both mode buttons", async () => {
        const el = createToggle();
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Player Mode", { exact: false })).toBeTruthy();
        expect(getByText(el.shadowRoot, "GM Mode", { exact: false })).toBeTruthy();
    });

    it("player button active when mode is player", async () => {
        const el = createToggle("player");
        await el.updateComplete;
        const playerBtn = /** @type {HTMLElement} */ (
            getByText(el.shadowRoot, "Player Mode", { exact: false }).closest("button")
        );
        expect(playerBtn.classList.contains("active")).toBe(true);
    });

    it("gm button active when mode is gm", async () => {
        const el = createToggle("gm");
        await el.updateComplete;
        const gmBtn = /** @type {HTMLElement} */ (
            getByText(el.shadowRoot, "GM Mode", { exact: false }).closest("button")
        );
        expect(gmBtn.classList.contains("active")).toBe(true);
    });

    it("dispatches mode-change on player button click", async () => {
        const el = createToggle("gm");
        await el.updateComplete;

        /** @type {any} */
        let detail = null;
        el.addEventListener(
            "mode-change",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        fireEvent.click(getByText(el.shadowRoot, "Player Mode", { exact: false }));
        expect(detail).toBeTruthy();
        if (detail) {
            expect(detail.mode).toBe("player");
        }
    });

    it("dispatches mode-change on gm button click", async () => {
        const el = createToggle("player");
        await el.updateComplete;

        /** @type {any} */
        let detail = null;
        el.addEventListener(
            "mode-change",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        fireEvent.click(getByText(el.shadowRoot, "GM Mode", { exact: false }));
        expect(detail).toBeTruthy();
        if (detail) {
            expect(detail.mode).toBe("gm");
        }
    });
});
