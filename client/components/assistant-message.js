import "./stat-block.js";
import "./rule-detail-sheet.js";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/card/card.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/tag/tag.js?deps=lit@3.3.2";
import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";
import { marked } from "marked";

import "../utils/marked-extensions.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

/** @typedef {import("../../shared/types.js").AssistantMessage} AssistantMessageType */
/** @typedef {import("../../shared/types.js").MessageBlock} MessageBlock */

// Pricing tied to GEMINI_MODEL (gemini-2.5-flash) in shared/constants.js
const PRICING = {
    INPUT_PER_M_TOKENS: 0.15,
    OUTPUT_PER_M_TOKENS: 0.6,
    EMBED_PER_M_TOKENS: 0.002,
};

/**
 * @customElement assistant-message
 * @property {AssistantMessageType} message - The assistant message to display.
 */
class AssistantMessage extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            .assistant-message {
                display: flex;
                justify-content: flex-start;
                gap: 0.75rem;
                --accent: hsl(262, 83%, 58%);
            }
            .assistant-message[data-mode="player"] {
                --accent: hsl(25, 83%, 48%);
            }
            .assistant-avatar {
                width: 2rem;
                height: 2rem;
                border-radius: 9999px;
                background: var(--secondary);
                border: 1px solid var(--border);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                flex-shrink: 0;
                margin-top: 0.25rem;
            }
            .assistant-content {
                max-width: 80%;
            }
            .assistant-content > * + * {
                margin-top: 1rem;
            }
            .assistant-bubble {
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 1rem;
                border-top-left-radius: 0.125rem;
                padding: 0.75rem 1rem;
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            }
            .bubble-content {
                font-size: 0.875rem;
                line-height: 1.625;
                color: var(--foreground);
            }
            .bubble-content > * + * {
                margin-top: 0.75rem;
            }
            div.italic {
                font-style: italic;
                color: var(--muted-foreground);
            }
            .callout-card::part(base) {
                background: rgba(30, 30, 46, 0.5);
                border: 1px solid var(--border);
                border-radius: 0.375rem;
            }
            .callout-card::part(body) {
                padding: 0.75rem;
            }
            .callout-title {
                font-weight: 600;
                margin-bottom: 0.25rem;
                color: var(--accent);
            }
            /* Markdown content styling */
            .markdown-body {
                font-size: 0.875rem;
                line-height: 1.625;
                color: var(--foreground);
            }
            .markdown-body > * + * {
                margin-top: 0.75rem;
            }
            .markdown-body strong {
                color: var(--foreground);
                font-weight: 700;
            }
            .markdown-body em {
                font-style: italic;
                color: var(--muted-foreground);
            }
            .markdown-body code {
                font-family: ui-monospace, monospace;
                font-size: 0.8125rem;
                background: rgba(127, 127, 127, 0.15);
                padding: 0.125rem 0.375rem;
                border-radius: 0.25rem;
            }
            .markdown-body ul,
            .markdown-body ol {
                padding-left: 1.25rem;
                color: var(--muted-foreground);
            }
            .markdown-body ul {
                list-style: disc;
            }
            .markdown-body ol {
                list-style: decimal;
            }
            .markdown-body li > * + * {
                margin-top: 0.25rem;
            }
            .markdown-body blockquote {
                border-left: 3px solid var(--border);
                padding-left: 0.75rem;
                color: var(--muted-foreground);
                font-style: italic;
            }
            .markdown-body pre {
                background: rgba(30, 30, 46, 0.6);
                border: 1px solid var(--border);
                border-radius: 0.375rem;
                padding: 0.75rem;
                overflow-x: auto;
                font-size: 0.8125rem;
            }
            .markdown-body pre code {
                background: none;
                padding: 0;
            }
            .markdown-body p:empty {
                display: none;
            }
            .rule-detail-block {
                padding: 0.5rem 0;
            }
            .rule-detail-block .rule-detail-title {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.25rem;
            }
            .rule-detail-block .rule-detail-title strong {
                font-size: 0.9375rem;
                color: var(--foreground);
            }
            .rule-detail-description {
                font-size: 0.875rem;
                color: var(--muted-foreground);
                margin: 0.25rem 0;
            }
            .rule-detail-traits {
                display: flex;
                flex-wrap: wrap;
                gap: 0.375rem;
                margin-top: 0.25rem;
            }
            .assistant-bubble.ungrounded {
                border-color: hsl(45, 93%, 47%);
                background: hsla(45, 93%, 47%, 0.05);
            }
            .assistant-bubble.ungrounded .callout-card::part(base) {
                border-color: hsl(45, 93%, 47%);
            }
            .cost-indicator {
                display: flex;
                gap: 0.5rem;
                align-items: center;
                font-size: 0.6875rem;
                color: var(--muted-foreground);
                padding-left: 0.25rem;
                margin-top: 0.25rem;
                opacity: 0.7;
            }
            .cost-value {
                font-family: ui-monospace, monospace;
            }
            .dice-badge {
                display: inline-block;
                background: hsl(280 25% 18%);
                border: 1px solid hsl(280 45% 32%);
                border-radius: 0.25rem;
                padding: 0.05em 0.4em;
                font-size: 0.85em;
                font-weight: 600;
                color: hsl(280 75% 72%);
                white-space: nowrap;
            }
            .dc-badge {
                display: inline-block;
                background: hsl(200 25% 18%);
                border: 1px solid hsl(200 45% 32%);
                border-radius: 0.25rem;
                padding: 0.05em 0.4em;
                font-size: 0.85em;
                font-weight: 600;
                color: hsl(200 75% 72%);
                white-space: nowrap;
            }
            .condition-badge {
                display: inline-block;
                background: hsl(340 25% 18%);
                border: 1px solid hsl(340 45% 32%);
                border-radius: 0.25rem;
                padding: 0.05em 0.4em;
                font-size: 0.85em;
                font-weight: 600;
                color: hsl(340 75% 72%);
                white-space: nowrap;
            }
            .trait-badge {
                display: inline-block;
                background: hsl(160 25% 18%);
                border: 1px solid hsl(160 45% 32%);
                border-radius: 0.25rem;
                padding: 0.05em 0.4em;
                font-size: 0.85em;
                font-weight: 600;
                color: hsl(160 75% 72%);
                white-space: nowrap;
            }
            .action-icon {
                display: inline-block;
                font-weight: 700;
                color: hsl(45 85% 65%);
                vertical-align: middle;
            }
            @media (max-width: 767px) {
                .assistant-content {
                    max-width: 92%;
                }
            }
        `,
    ];

    static properties = {
        message: { type: Object },
    };

    constructor() {
        super();
        /** @type {AssistantMessageType | undefined} */
        this.message = undefined;
    }

    render() {
        if (!this.message) {
            return html``;
        }
        /** @type {MessageBlock[]} */
        const blocks =
            this.message.blocks ??
            /** @type {MessageBlock[]} */ (JSON.parse(this.message.blocksJson ?? "[]"));
        const ungrounded = this.message?.ragMeta?.resultCount === 0;
        return html`
            <div class="assistant-message" data-mode=${this.message.mode ?? "gm"}>
                <div class="assistant-avatar">🤖</div>
                <div class="assistant-content">
                    <div class="assistant-bubble ${ungrounded ? "ungrounded" : ""}">
                        <div class="bubble-content">
                            ${blocks.map((block) => this.renderBlock(block))}
                        </div>
                    </div>
                    ${this.renderCostIndicator()}
                </div>
            </div>
            <rule-detail-sheet></rule-detail-sheet>
        `;
    }

    renderCostIndicator() {
        const meta = this.message?.ragMeta;
        if (meta?.usage?.totalTokenCount === null || meta?.usage?.totalTokenCount === undefined) {
            return nothing;
        }
        const { promptTokenCount = 0, candidatesTokenCount = 0 } = meta.usage;
        const embedTokens = meta.embeddingTokens ?? 0;
        const inputCost = (promptTokenCount * PRICING.INPUT_PER_M_TOKENS) / 1_000_000;
        const outputCost = (candidatesTokenCount * PRICING.OUTPUT_PER_M_TOKENS) / 1_000_000;
        const embedCost = (embedTokens * PRICING.EMBED_PER_M_TOKENS) / 1_000_000;
        const totalCost = inputCost + outputCost + embedCost;
        // Format to appropriate precision
        const costStr = totalCost < 0.001 ? "<$0.001" : `$${totalCost.toFixed(4)}`;
        return html`
            <div class="cost-indicator" aria-label="Estimated generation cost">
                <span class="cost-label"
                    >${promptTokenCount + embedTokens} in → ${candidatesTokenCount} out</span
                >
                <span class="cost-value">${costStr}</span>
            </div>
        `;
    }

    /**
     * @param {MessageBlock} block
     */
    renderBlock(block) {
        switch (block.type) {
            case "text":
                return html`
                    <div class="${block.italic ? "italic" : ""}">
                        ${this.renderMarkdown(block.markdown)}
                    </div>
                `;
            case "callout":
                return html`
                    <sl-card class="callout-card" style="width: 100%;">
                        <p class="callout-title">${block.title}</p>
                        ${this.renderMarkdown(block.markdown)}
                    </sl-card>
                `;
            case "stat-block":
                return html`
                    <stat-block
                        .title=${block.title}
                        .data=${block.data}
                        .redacted=${block.redacted ?? false}
                    ></stat-block>
                `;
            case "rule-detail":
                return html`
                    <div class="rule-detail-block">
                        <div class="rule-detail-title">
                            <sl-tag size="small" variant="neutral">${block.category}</sl-tag>
                            <strong>${block.title}</strong>
                        </div>
                        ${block.description
                            ? html`<p class="rule-detail-description">${block.description}</p>`
                            : ""}
                        ${block.traits?.length
                            ? html`<div class="rule-detail-traits">
                                  ${block.traits.map(
                                      (t) => html`<sl-tag size="small">${t}</sl-tag>`,
                                  )}
                              </div>`
                            : ""}
                    </div>
                `;
            default:
                return nothing;
        }
    }

    /**
     * @param {string} md
     * @returns {import("lit-html").TemplateResult}
     */
    renderMarkdown(md) {
        const htmlString = marked.parse(md, { breaks: true, gfm: true });
        return html`<div class="markdown-body" .innerHTML=${htmlString}></div>`;
    }
}

const element = customElement("assistant-message")(AssistantMessage);
export { element as AssistantMessage };
