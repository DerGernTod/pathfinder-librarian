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

    it("renders input field with placeholder", async () => {
        const el = createInput();
        await el.updateComplete;
        const input = /** @type {HTMLInputElement} */ (el.querySelector("input[type='text']"));
        expect(input).toBeTruthy();
        expect(input.placeholder).toBe("Ask about rules, lore, or mechanics...");
    });

    it("renders send button", async () => {
        const el = createInput();
        await el.updateComplete;
        const button = el.querySelector("button[type='submit']");
        expect(button).toBeTruthy();
    });

    it("dispatches send-message on form submit with text", async () => {
        const el = createInput();
        await el.updateComplete;

        el.value = "Hello";
        el.requestUpdate();
        await el.updateComplete;

        const input = /** @type {HTMLInputElement} */ (el.querySelector("input"));
        input.value = "Hello";
        fireEvent.input(input);
        await el.updateComplete;

        /** @type {any} */
        let detail = null;
        el.addEventListener(
            "send-message",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        const form = /** @type {HTMLFormElement} */ (el.querySelector("form"));
        fireEvent.submit(form);
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

        const input = /** @type {HTMLInputElement} */ (el.querySelector("input"));
        input.value = "Test";
        fireEvent.input(input);
        await el.updateComplete;

        const form = /** @type {HTMLFormElement} */ (el.querySelector("form"));
        fireEvent.submit(form);
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

        const form = /** @type {HTMLFormElement} */ (el.querySelector("form"));
        fireEvent.submit(form);
        expect(dispatched).toBe(false);
    });

    it("renders disclaimer text", async () => {
        const el = createInput();
        await el.updateComplete;
        expect(getByText(el, /Pathfinder Librarian can make mistakes/)).toBeTruthy();
    });
});
