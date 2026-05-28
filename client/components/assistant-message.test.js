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

    it("passes redacted flag to stat-block component", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [
                {
                    type: "stat-block",
                    title: "Orc",
                    data: { name: "Orc" },
                    redacted: true,
                },
            ],
        });
        await el.updateComplete;
        const nested = el.shadowRoot.querySelector("stat-block");
        expect(nested).toBeTruthy();
        expect(nested.redacted).toBe(true);
    });

    it("stat-block defaults redacted to false when not provided", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [
                {
                    type: "stat-block",
                    title: "Orc",
                    data: { name: "Orc" },
                },
            ],
        });
        await el.updateComplete;
        const nested = el.shadowRoot.querySelector("stat-block");
        expect(nested).toBeTruthy();
        expect(nested.redacted).toBe(false);
    });

    it("redacted stat-block renders limited view", async () => {
        const el = createAssistantMessage({
            id: "1",
            role: "assistant",
            blocks: [
                {
                    type: "stat-block",
                    title: "Orc",
                    data: { name: "Orc Warrior", traits: ["Orc"] },
                    redacted: true,
                },
            ],
        });
        await el.updateComplete;
        const nested = el.shadowRoot.querySelector("stat-block");
        await nested.updateComplete;
        const callout = nested.shadowRoot.querySelector(".redacted-callout");
        expect(callout).toBeTruthy();
        expect(callout.textContent).toContain("Limited information");
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

    describe("rich game component badges", () => {
        it("renders dice badge in text block", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [
                    {
                        type: "text",
                        markdown: "Deal :dice{2d6 fire} damage.",
                    },
                ],
            });
            await el.updateComplete;
            const badge = el.shadowRoot.querySelector(".dice-badge");
            expect(badge).toBeTruthy();
            expect(badge.textContent).toBe("2d6 fire");
        });

        it("renders DC badge in text block", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [
                    {
                        type: "text",
                        markdown: "Succeed at :dc{15} Fortitude.",
                    },
                ],
            });
            await el.updateComplete;
            const badge = el.shadowRoot.querySelector(".dc-badge");
            expect(badge).toBeTruthy();
            expect(badge.textContent).toBe("DC 15");
        });

        it("renders condition badge in text block", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [
                    {
                        type: "text",
                        markdown: "Target becomes :condition{Stunned 1}.",
                    },
                ],
            });
            await el.updateComplete;
            const badge = el.shadowRoot.querySelector(".condition-badge");
            expect(badge).toBeTruthy();
            expect(badge.textContent).toBe("Stunned 1");
        });

        it("renders trait badge in text block", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [
                    {
                        type: "text",
                        markdown: "Has :trait{Dragon} trait.",
                    },
                ],
            });
            await el.updateComplete;
            const badge = el.shadowRoot.querySelector(".trait-badge");
            expect(badge).toBeTruthy();
            expect(badge.textContent).toBe("Dragon");
        });

        it("renders action icon in text block", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [
                    {
                        type: "text",
                        markdown: "Costs :action{2} actions.",
                    },
                ],
            });
            await el.updateComplete;
            const icon = el.shadowRoot.querySelector(".action-icon");
            expect(icon).toBeTruthy();
            expect(icon.getAttribute("data-actions")).toBe("2");
        });

        it("renders mixed badges in a callout", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [
                    {
                        type: "callout",
                        title: "Effect",
                        markdown:
                            "Deal :dice{2d6 fire} on failed :dc{20} save, causing :condition{Stunned 1}. Has :trait{Fire}.",
                    },
                ],
            });
            await el.updateComplete;
            const callout = el.shadowRoot.querySelector(".callout-card");
            expect(callout.querySelector(".dice-badge")).toBeTruthy();
            expect(callout.querySelector(".dc-badge")).toBeTruthy();
            expect(callout.querySelector(".condition-badge")).toBeTruthy();
            expect(callout.querySelector(".trait-badge")).toBeTruthy();
        });

        it("does NOT produce badges for plain text without wrapper syntax", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [
                    {
                        type: "text",
                        markdown: "Roll 2d6 damage against DC 15.",
                    },
                ],
            });
            await el.updateComplete;
            expect(el.shadowRoot.querySelector(".dice-badge")).toBeNull();
            expect(el.shadowRoot.querySelector(".dc-badge")).toBeNull();
        });
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

    describe("cost indicator", () => {
        it("renders cost indicator when ragMeta.usage is present with totalTokenCount > 0", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: {
                    resultCount: 2,
                    usage: {
                        promptTokenCount: 500,
                        candidatesTokenCount: 200,
                        totalTokenCount: 700,
                    },
                    embeddingTokens: 50,
                },
            });
            await el.updateComplete;
            const indicator = el.shadowRoot.querySelector(".cost-indicator");
            expect(indicator).toBeTruthy();
            expect(indicator.textContent).toContain("550 in → 200 out");
        });

        it("renders no cost indicator when ragMeta.usage is undefined", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: { resultCount: 2 },
            });
            await el.updateComplete;
            const indicator = el.shadowRoot.querySelector(".cost-indicator");
            expect(indicator).toBeNull();
        });

        it("renders no cost indicator when ragMeta is undefined", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
            });
            await el.updateComplete;
            const indicator = el.shadowRoot.querySelector(".cost-indicator");
            expect(indicator).toBeNull();
        });

        it("renders no cost indicator when totalTokenCount is null", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: {
                    resultCount: 1,
                    usage: {
                        promptTokenCount: 100,
                        candidatesTokenCount: 50,
                        totalTokenCount: null,
                    },
                },
            });
            await el.updateComplete;
            const indicator = el.shadowRoot.querySelector(".cost-indicator");
            expect(indicator).toBeNull();
        });

        it("renders no cost indicator when totalTokenCount is undefined", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: {
                    resultCount: 1,
                    usage: { promptTokenCount: 100, candidatesTokenCount: 50 },
                },
            });
            await el.updateComplete;
            const indicator = el.shadowRoot.querySelector(".cost-indicator");
            expect(indicator).toBeNull();
        });

        it("renders cost indicator when totalTokenCount is 0", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: {
                    resultCount: 1,
                    usage: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
                    embeddingTokens: 0,
                },
            });
            await el.updateComplete;
            const indicator = el.shadowRoot.querySelector(".cost-indicator");
            expect(indicator).toBeTruthy();
            expect(indicator.textContent).toContain("0 in → 0 out");
        });

        it("formats cost correctly for small values (<$0.001)", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: {
                    resultCount: 1,
                    usage: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
                },
            });
            await el.updateComplete;
            const costValue = el.shadowRoot.querySelector(".cost-value");
            expect(costValue).toBeTruthy();
            expect(costValue.textContent).toContain("<$0.001");
        });

        it("formats cost correctly for larger values", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: {
                    resultCount: 3,
                    usage: {
                        promptTokenCount: 5000,
                        candidatesTokenCount: 2000,
                        totalTokenCount: 7000,
                    },
                },
            });
            await el.updateComplete;
            const costValue = el.shadowRoot.querySelector(".cost-value");
            expect(costValue).toBeTruthy();
            // inputCost = 5000 * 0.15 / 1M = 0.00075
            // outputCost = 2000 * 0.60 / 1M = 0.0012
            // total = 0.00195 → "$0.0019"
            expect(costValue.textContent).toContain("$0.0019");
        });

        it("shows token counts in cost label", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: {
                    resultCount: 2,
                    usage: {
                        promptTokenCount: 100,
                        candidatesTokenCount: 50,
                        totalTokenCount: 150,
                    },
                    embeddingTokens: 25,
                },
            });
            await el.updateComplete;
            const costLabel = el.shadowRoot.querySelector(".cost-label");
            expect(costLabel).toBeTruthy();
            expect(costLabel.textContent).toContain("125 in → 50 out");
        });

        it("cost indicator is not shown for mock responses (no usage data)", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Mock response" }],
                ragMeta: { resultCount: 0 },
            });
            await el.updateComplete;
            const indicator = el.shadowRoot.querySelector(".cost-indicator");
            expect(indicator).toBeNull();
        });

        it("cost indicator includes embedding tokens in input count", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: {
                    resultCount: 1,
                    usage: {
                        promptTokenCount: 200,
                        candidatesTokenCount: 100,
                        totalTokenCount: 300,
                    },
                    embeddingTokens: 75,
                },
            });
            await el.updateComplete;
            const costLabel = el.shadowRoot.querySelector(".cost-label");
            expect(costLabel.textContent).toContain("275 in → 100 out");
        });

        it("cost indicator has aria-label for accessibility", async () => {
            const el = createAssistantMessage({
                id: "1",
                role: "assistant",
                blocks: [{ type: "text", markdown: "Response" }],
                ragMeta: {
                    resultCount: 1,
                    usage: {
                        promptTokenCount: 100,
                        candidatesTokenCount: 50,
                        totalTokenCount: 150,
                    },
                },
            });
            await el.updateComplete;
            const indicator = el.shadowRoot.querySelector(".cost-indicator");
            expect(indicator).toBeTruthy();
            expect(indicator.getAttribute("aria-label")).toBe("Estimated generation cost");
        });
    });
});
