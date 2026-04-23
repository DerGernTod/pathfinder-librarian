import "./new-chat-button.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent, getByText } from "@testing-library/dom";

describe("new-chat-button", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    function createButton() {
        /** @type {any} */
        const el = document.createElement("new-chat-button");
        document.body.appendChild(el);
        return el;
    }

    it("renders button with text", async () => {
        const el = createButton();
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
});
