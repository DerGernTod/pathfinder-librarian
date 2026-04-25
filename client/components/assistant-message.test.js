import "./assistant-message.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { getByText } from "@testing-library/dom";

describe("assistant-message", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /** @param {any} msg */
    function createAssistantMessage(msg) {
        /** @type {any} */
        const el = document.createElement("assistant-message");
        el.message = msg;
        document.body.appendChild(el);
        return el;
    }

    it("renders avatar", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "paragraph", text: "Hello" }],
        });
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".assistant-avatar")).toBeTruthy();
        expect(getByText(el.shadowRoot, "🤖")).toBeTruthy();
    });

    it("renders paragraph block", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "paragraph", text: "Plain paragraph" }],
        });
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Plain paragraph")).toBeTruthy();
    });

    it("renders italic paragraph block", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "paragraph", text: "Italic text", italic: true }],
        });
        await el.updateComplete;
        const p = getByText(el.shadowRoot, "Italic text");
        expect(p.classList.contains("italic")).toBe(true);
    });

    it("renders callout block with title and text", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "callout", title: "Important Note", text: "Details here" }],
        });
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Important Note")).toBeTruthy();
        expect(getByText(el.shadowRoot, "Details here")).toBeTruthy();
    });

    it("renders list block with items", async () => {
        const el = createAssistantMessage({
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
        expect(getByText(el.shadowRoot, "Item A:")).toBeTruthy();
        expect(getByText(el.shadowRoot, "Detail A")).toBeTruthy();
        expect(getByText(el.shadowRoot, "Item B:")).toBeTruthy();
    });

    it("renders stat-block block as nested element", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "stat-block", title: "Orc", data: { name: "Orc" } }],
        });
        await el.updateComplete;
        const nested = el.shadowRoot.querySelector("stat-block");
        expect(nested).toBeTruthy();
        expect(nested.title).toBe("Orc");
    });

    it("renders inline segments with highlights", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [
                {
                    type: "paragraph",
                    segments: [
                        { text: "Normal text " },
                        { text: "highlighted", highlight: true },
                        { text: " more text" },
                    ],
                },
            ],
        });
        await el.updateComplete;
        const strong = el.shadowRoot.querySelector(".highlight");
        expect(strong).toBeTruthy();
        expect(strong.textContent).toBe("highlighted");
    });

    it("renders empty when message is undefined", async () => {
        const el = createAssistantMessage(undefined);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".assistant-message")).toBeNull();
    });

    it("applies player data-mode attribute", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            mode: "player",
            blocks: [{ type: "paragraph", text: "Test" }],
        });
        await el.updateComplete;
        const container = el.shadowRoot.querySelector(".assistant-message");
        expect(container.getAttribute("data-mode")).toBe("player");
    });
});
