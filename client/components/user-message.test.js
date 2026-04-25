import "./user-message.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { getByText } from "@testing-library/dom";

describe("user-message", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /** @param {any} msg */
    function createUserMessage(msg) {
        /** @type {any} */
        const el = document.createElement("user-message");
        el.message = msg;
        document.body.appendChild(el);
        return el;
    }

    it("renders user message content", async () => {
        const el = createUserMessage({
            id: "1",
            role: "user",
            content: "Hello world",
            mode: "gm",
        });
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Hello world")).toBeTruthy();
    });

    it("has user-message class", async () => {
        const el = createUserMessage({
            id: "1",
            role: "user",
            content: "Hi",
            mode: "gm",
        });
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".user-message")).toBeTruthy();
    });

    it("applies player data-mode attribute", async () => {
        const el = createUserMessage({
            id: "1",
            role: "user",
            content: "Test",
            mode: "player",
        });
        await el.updateComplete;
        const container = el.shadowRoot.querySelector(".user-message");
        expect(container.getAttribute("data-mode")).toBe("player");
    });

    it("applies gm data-mode attribute by default", async () => {
        const el = createUserMessage({
            id: "1",
            role: "user",
            content: "Test",
        });
        await el.updateComplete;
        const container = el.shadowRoot.querySelector(".user-message");
        expect(container.getAttribute("data-mode")).toBe("gm");
    });

    it("renders empty when message is undefined", async () => {
        const el = createUserMessage(undefined);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".user-message")).toBeNull();
    });
});
