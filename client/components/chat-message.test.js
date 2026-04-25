import { beforeEach, describe, expect, it } from "bun:test";

import "./chat-message.js";
import { getByText } from "@testing-library/dom";

describe("chat-message", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /** @param {any} msg */
    function createMessage(msg) {
        /** @type {any} */
        const el = document.createElement("chat-message");
        el.message = msg;
        document.body.appendChild(el);
        return el;
    }

    it("renders user message via user-message child", async () => {
        const el = createMessage({ id: "1", role: "user", content: "Hello world" });
        await el.updateComplete;
        const userMsg = el.shadowRoot.querySelector("user-message");
        expect(userMsg).toBeTruthy();
        await /** @type {any} */ (userMsg).updateComplete;
        expect(getByText(userMsg.shadowRoot, "Hello world")).toBeTruthy();
    });

    it("user message child has user-message class", async () => {
        const el = createMessage({ id: "1", role: "user", content: "Hi" });
        await el.updateComplete;
        const userMsg = el.shadowRoot.querySelector("user-message");
        await /** @type {any} */ (userMsg).updateComplete;
        expect(userMsg.shadowRoot.querySelector(".user-message")).toBeTruthy();
    });

    it("renders assistant message via assistant-message child", async () => {
        const el = createMessage({
            id: "2",
            role: "assistant",
            blocks: [{ type: "paragraph", text: "Response text" }],
        });
        await el.updateComplete;
        const assistantMsg = el.shadowRoot.querySelector("assistant-message");
        expect(assistantMsg).toBeTruthy();
        await /** @type {any} */ (assistantMsg).updateComplete;
        expect(getByText(assistantMsg.shadowRoot, "Response text")).toBeTruthy();
        expect(assistantMsg.shadowRoot.querySelector(".assistant-message")).toBeTruthy();
    });

    it("renders paragraph block", async () => {
        const el = createMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "paragraph", text: "Plain paragraph" }],
        });
        await el.updateComplete;
        const assistantMsg = el.shadowRoot.querySelector("assistant-message");
        await /** @type {any} */ (assistantMsg).updateComplete;
        expect(getByText(assistantMsg.shadowRoot, "Plain paragraph")).toBeTruthy();
    });

    it("renders italic paragraph block", async () => {
        const el = createMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "paragraph", text: "Italic text", italic: true }],
        });
        await el.updateComplete;
        const assistantMsg = el.shadowRoot.querySelector("assistant-message");
        await /** @type {any} */ (assistantMsg).updateComplete;
        const p = getByText(assistantMsg.shadowRoot, "Italic text");
        expect(p.classList.contains("italic")).toBe(true);
    });

    it("renders callout block with title and text", async () => {
        const el = createMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "callout", title: "Important Note", text: "Details here" }],
        });
        await el.updateComplete;
        const assistantMsg = el.shadowRoot.querySelector("assistant-message");
        await /** @type {any} */ (assistantMsg).updateComplete;
        expect(getByText(assistantMsg.shadowRoot, "Important Note")).toBeTruthy();
        expect(getByText(assistantMsg.shadowRoot, "Details here")).toBeTruthy();
    });

    it("renders list block with items", async () => {
        const el = createMessage({
            id: "1",
            role: "assistant",
            blocks: [
                {
                    type: "list",
                    items: [
                        { title: "Item A:", text: "Detail A" },
                        { title: "Item B:", text: "Detail B" },
                    ],
                },
            ],
        });
        await el.updateComplete;
        const assistantMsg = el.shadowRoot.querySelector("assistant-message");
        await /** @type {any} */ (assistantMsg).updateComplete;
        expect(getByText(assistantMsg.shadowRoot, "Item A:")).toBeTruthy();
        expect(getByText(assistantMsg.shadowRoot, "Detail A")).toBeTruthy();
        expect(getByText(assistantMsg.shadowRoot, "Item B:")).toBeTruthy();
    });

    it("renders stat-block block as nested element", async () => {
        const el = createMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "stat-block", title: "Orc", data: { name: "Orc" } }],
        });
        await el.updateComplete;
        const assistantMsg = el.shadowRoot.querySelector("assistant-message");
        await /** @type {any} */ (assistantMsg).updateComplete;
        const nested = assistantMsg.shadowRoot.querySelector("stat-block");
        expect(nested).toBeTruthy();
        expect(nested.title).toBe("Orc");
    });

    it("renders nothing when message is undefined", async () => {
        const el = createMessage(undefined);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector("*")).toBeNull();
    });
});
