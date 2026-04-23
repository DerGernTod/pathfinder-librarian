import "./chat-header.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent, getByText } from "@testing-library/dom";

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
        expect(getByText(el, "Pathfinder 2e")).toBeTruthy();
    });

    it("renders subtitle", async () => {
        const el = createHeader();
        await el.updateComplete;
        expect(getByText(el, "Rules Assistant")).toBeTruthy();
    });

    it("renders both mode buttons", async () => {
        const el = createHeader();
        await el.updateComplete;
        expect(getByText(el, "Player Mode", { exact: false })).toBeTruthy();
        expect(getByText(el, "GM Mode", { exact: false })).toBeTruthy();
    });

    it("player button active when mode is player", async () => {
        const el = createHeader("player");
        await el.updateComplete;
        const playerBtn = /** @type {HTMLElement} */ (
            getByText(el, "Player Mode", { exact: false }).closest("button")
        );
        expect(playerBtn.classList.contains("bg-primary")).toBe(true);
    });

    it("gm button active when mode is gm", async () => {
        const el = createHeader("gm");
        await el.updateComplete;
        const gmBtn = /** @type {HTMLElement} */ (
            getByText(el, "GM Mode", { exact: false }).closest("button")
        );
        expect(gmBtn.classList.contains("bg-primary")).toBe(true);
    });

    it("dispatches mode-change on player button click", async () => {
        const el = createHeader("gm");
        await el.updateComplete;

        /** @type {any} */
        let detail = null;
        el.addEventListener(
            "mode-change",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        fireEvent.click(getByText(el, "Player Mode", { exact: false }));
        expect(detail).toBeTruthy();
        if (detail) {
            expect(detail.mode).toBe("player");
        }
    });

    it("dispatches mode-change on gm button click", async () => {
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

        fireEvent.click(getByText(el, "GM Mode", { exact: false }));
        expect(detail).toBeTruthy();
        if (detail) {
            expect(detail.mode).toBe("gm");
        }
    });
});
