import "./chat-input.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent, getByText } from "@testing-library/dom";

describe("chat-input", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    function createInput() {
        /** @type {any} */
        const el = document.createElement("chat-input");
        document.body.appendChild(el);
        return el;
    }

    it("renders sl-textarea with placeholder", async () => {
        const el = createInput();
        await el.updateComplete;
        const textarea = el.shadowRoot.querySelector("sl-textarea");
        expect(textarea).toBeTruthy();
        expect(textarea.getAttribute("placeholder")).toBe("Ask about rules, lore, or mechanics...");
    });

    it("renders send button", async () => {
        const el = createInput();
        await el.updateComplete;
        const button = el.shadowRoot.querySelector("button");
        expect(button).toBeTruthy();
    });

    it("dispatches send-message on button click with text", async () => {
        const el = createInput();
        await el.updateComplete;

        el.value = "Hello";
        el.requestUpdate();
        await el.updateComplete;

        /** @type {any} */
        let detail = null;
        el.addEventListener(
            "send-message",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        const button = /** @type {HTMLElement} */ (el.shadowRoot.querySelector("button"));
        fireEvent.click(button);
        expect(detail).toBeTruthy();
        if (detail) {
            expect(detail.text).toBe("Hello");
        }
    });

    it("clears value after submit", async () => {
        const el = createInput();
        await el.updateComplete;

        el.value = "Test";
        el.requestUpdate();
        await el.updateComplete;

        const button = /** @type {HTMLElement} */ (el.shadowRoot.querySelector("button"));
        fireEvent.click(button);
        await el.updateComplete;

        expect(el.value).toBe("");
    });

    it("does not dispatch send-message for empty input", async () => {
        const el = createInput();
        await el.updateComplete;

        let dispatched = false;
        el.addEventListener("send-message", () => {
            dispatched = true;
        });

        const button = /** @type {HTMLElement} */ (el.shadowRoot.querySelector("button"));
        fireEvent.click(button);
        expect(dispatched).toBe(false);
    });

    it("does not dispatch send-message when disabled", async () => {
        const el = createInput();
        el.disabled = true;
        await el.updateComplete;

        el.value = "Hello";
        el.requestUpdate();
        await el.updateComplete;

        let dispatched = false;
        el.addEventListener("send-message", () => {
            dispatched = true;
        });

        const button = /** @type {HTMLElement} */ (el.shadowRoot.querySelector("button"));
        fireEvent.click(button);
        expect(dispatched).toBe(false);
    });

    it("applies disabled attribute to textarea", async () => {
        const el = createInput();
        el.disabled = true;
        await el.updateComplete;

        const textarea = el.shadowRoot.querySelector("sl-textarea");
        expect(textarea).toBeTruthy();
        expect(textarea.hasAttribute("disabled")).toBe(true);
    });

    it("applies disabled attribute to button", async () => {
        const el = createInput();
        el.disabled = true;
        await el.updateComplete;

        const button = el.shadowRoot.querySelector("button");
        expect(button).toBeTruthy();
        expect(button.hasAttribute("disabled")).toBe(true);
    });

    it("renders disclaimer text", async () => {
        const el = createInput();
        await el.updateComplete;
        expect(getByText(el.shadowRoot, /Pathfinder Librarian can make mistakes/)).toBeTruthy();
    });
});
