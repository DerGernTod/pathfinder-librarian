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
            blocks: [{ type: "text", markdown: "Hello" }],
        });
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".assistant-avatar")).toBeTruthy();
        expect(getByText(el.shadowRoot, "🤖")).toBeTruthy();
    });

    it("renders text block with markdown", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "text", markdown: "Plain text" }],
        });
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Plain text")).toBeTruthy();
    });

    it("renders italic text block", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "text", markdown: "Italic text", italic: true }],
        });
        await el.updateComplete;
        const italicDiv = el.shadowRoot.querySelector("div.italic");
        expect(italicDiv).toBeTruthy();
        expect(getByText(italicDiv, "Italic text")).toBeTruthy();
    });

    it("renders callout block with title and markdown", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "callout", title: "Important Note", markdown: "Details here" }],
        });
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Important Note")).toBeTruthy();
        expect(getByText(el.shadowRoot, "Details here")).toBeTruthy();
    });

    it("renders markdown list in text block", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [
                {
                    type: "text",
                    markdown: "- **Item A:** Detail A\n- **Item B:** Detail B",
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

    it("renders bold text via markdown", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [
                {
                    type: "text",
                    markdown: "Normal text **highlighted** more text",
                },
            ],
        });
        await el.updateComplete;
        const strong = el.shadowRoot.querySelector(".markdown-body strong");
        expect(strong).toBeTruthy();
        expect(strong.textContent).toBe("highlighted");
    });

    it("renders empty when message is undefined", async () => {
        const el = createAssistantMessage(undefined);
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".assistant-message")).toBeNull();
    });

    it("renders rule-detail block with title, category, and description", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [
                {
                    type: "rule-detail",
                    title: "Enfeebled",
                    category: "condition",
                    description: "You take a status penalty to Strength-based rolls.",
                },
            ],
        });
        await el.updateComplete;
        const block = el.shadowRoot.querySelector(".rule-detail-block");
        expect(block).toBeTruthy();
        expect(getByText(el.shadowRoot, "Enfeebled")).toBeTruthy();
        expect(getByText(el.shadowRoot, "condition")).toBeTruthy();
        expect(
            getByText(el.shadowRoot, "You take a status penalty to Strength-based rolls."),
        ).toBeTruthy();
    });

    it("renders rule-detail block with trait tags", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [
                {
                    type: "rule-detail",
                    title: "Humanoid",
                    category: "trait",
                    traits: ["Human", "Shapechanger"],
                },
            ],
        });
        await el.updateComplete;
        const traitsContainer = el.shadowRoot.querySelector(".rule-detail-traits");
        expect(traitsContainer).toBeTruthy();
        const tags = traitsContainer.querySelectorAll("sl-tag");
        expect(tags.length).toBe(2);
        expect(tags[0].textContent).toBe("Human");
        expect(tags[1].textContent).toBe("Shapechanger");
    });

    it("renders rule-detail-sheet component", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "text", markdown: "Hello" }],
        });
        await el.updateComplete;
        const sheet = el.shadowRoot.querySelector("rule-detail-sheet");
        expect(sheet).toBeTruthy();
    });

    it("applies player data-mode attribute", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            mode: "player",
            blocks: [{ type: "text", markdown: "Test" }],
        });
        await el.updateComplete;
        const container = el.shadowRoot.querySelector(".assistant-message");
        expect(container.getAttribute("data-mode")).toBe("player");
    });

    it("renders code blocks via markdown", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [{ type: "text", markdown: "Use `DC 15` for the check." }],
        });
        await el.updateComplete;
        const code = el.shadowRoot.querySelector(".markdown-body code");
        expect(code).toBeTruthy();
        expect(code.textContent).toBe("DC 15");
    });

    describe("ungrounded styling", () => {
        it("applies ungrounded class when ragMeta.resultCount is 0", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [
                    {
                        type: "callout",
                        title: "⚠ No Database Match",
                        markdown: "This answer is based on general knowledge.",
                    },
                    { type: "text", markdown: "Some answer" },
                ],
                ragMeta: { resultCount: 0 },
            });
            await el.updateComplete;
            const bubble = el.shadowRoot.querySelector(".assistant-bubble");
            expect(bubble.classList.contains("ungrounded")).toBe(true);
        });

        it("does NOT apply ungrounded class when ragMeta is undefined", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Normal answer" }],
            });
            await el.updateComplete;
            const bubble = el.shadowRoot.querySelector(".assistant-bubble");
            expect(bubble.classList.contains("ungrounded")).toBe(false);
        });

        it("does NOT apply ungrounded class when ragMeta.resultCount > 0", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Grounded answer" }],
                ragMeta: { resultCount: 3 },
            });
            await el.updateComplete;
            const bubble = el.shadowRoot.querySelector(".assistant-bubble");
            expect(bubble.classList.contains("ungrounded")).toBe(false);
        });
    });
});
