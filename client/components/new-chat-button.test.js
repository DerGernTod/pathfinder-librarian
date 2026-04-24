import "./new-chat-button.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent, getByText } from "@testing-library/dom";

describe("new-chat-button", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    function createButton(collapsed = false) {
        /** @type {any} */
        const el = document.createElement("new-chat-button");
        el.collapsed = collapsed;
        document.body.appendChild(el);
        return el;
    }

    it("renders button with text when not collapsed", async () => {
        const el = createButton(false);
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "New Chat")).toBeTruthy();
    });

    it("renders plus icon svg", async () => {
        const el = createButton();
        await el.updateComplete;
        const svg = el.shadowRoot.querySelector("svg");
        expect(svg).toBeTruthy();
    });

    it("dispatches new-chat on click", async () => {
        const el = createButton();
        await el.updateComplete;

        let dispatched = false;
        el.addEventListener("new-chat", () => {
            dispatched = true;
        });

        fireEvent.click(getByText(el.shadowRoot, "New Chat"));
        expect(dispatched).toBe(true);
    });

    // NEW: Tests for collapsed state
    it("renders collapsed state correctly", async () => {
        const el = createButton(true);
        await el.updateComplete;
        const btn = el.shadowRoot.querySelector("button");
        expect(btn.classList.contains("collapsed")).toBe(true);
    });

    it("hides text label when collapsed", async () => {
        const el = createButton(true);
        await el.updateComplete;
        const text = el.shadowRoot.querySelector(".btn-text");
        expect(getComputedStyle(text).display).toBe("none");
    });

    it("increases icon size when collapsed", async () => {
        const el = createButton(true);
        await el.updateComplete;
        const icon = el.shadowRoot.querySelector(".btn-icon");
        expect(getComputedStyle(icon).width).toBe("20px");
        expect(getComputedStyle(icon).height).toBe("20px");
    });
});
