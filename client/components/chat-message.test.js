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

    it("renders user message content", async () => {
        const el = createMessage({ id: "1", role: "user", content: "Hello world" });
        await el.updateComplete;
        expect(getByText(el, "Hello world")).toBeTruthy();
    });

    it("user message right-aligned", async () => {
        const el = createMessage({ id: "1", role: "user", content: "Hi" });
        await el.updateComplete;
        expect(el.querySelector(".justify-end")).toBeTruthy();
    });

    it("renders assistant message with avatar", async () => {
        const el = createMessage({
            id: "2",
            role: "assistant",
            blocks: [{ type: "paragraph", text: "Response text" }],
        });
        await el.updateComplete;
        expect(getByText(el, "Response text")).toBeTruthy();
        expect(el.querySelector(".justify-start")).toBeTruthy();
    });

    it("renders paragraph block", async () => {
        const el = createMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "paragraph", text: "Plain paragraph" }],
        });
        await el.updateComplete;
        expect(getByText(el, "Plain paragraph")).toBeTruthy();
    });

    it("renders italic paragraph block", async () => {
        const el = createMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "paragraph", text: "Italic text", italic: true }],
        });
        await el.updateComplete;
        const p = getByText(el, "Italic text");
        expect(p.classList.contains("italic")).toBe(true);
    });

    it("renders callout block with title and text", async () => {
        const el = createMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "callout", title: "Important Note", text: "Details here" }],
        });
        await el.updateComplete;
        expect(getByText(el, "Important Note")).toBeTruthy();
        expect(getByText(el, "Details here")).toBeTruthy();
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
        expect(getByText(el, "Item A:")).toBeTruthy();
        expect(getByText(el, "Detail A")).toBeTruthy();
        expect(getByText(el, "Item B:")).toBeTruthy();
    });

    it("renders stat-block block as nested element", async () => {
        const el = createMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "stat-block", title: "Orc", data: { name: "Orc" } }],
        });
        await el.updateComplete;
        const nested = el.querySelector("stat-block");
        expect(nested).toBeTruthy();
        expect(nested.title).toBe("Orc");
    });

    it("renders nothing when message is undefined", async () => {
        const el = createMessage(undefined);
        await el.updateComplete;
        expect(el.shadowRoot).toBeFalsy();
        expect(el.children.length).toBe(0);
    });
});
