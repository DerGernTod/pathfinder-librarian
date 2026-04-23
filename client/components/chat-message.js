import "./stat-block.js";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/card/card.js?deps=lit@3.3.2";
import { LitElement, css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").Message} Message */
/** @typedef {import("../../shared/types.js").UserMessage} UserMessage */
/** @typedef {import("../../shared/types.js").AssistantMessage} AssistantMessage */
/** @typedef {import("../../shared/types.js").MessageBlock} MessageBlock */
/** @typedef {import("../../shared/types.js").Segment} Segment */

class ChatMessage extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            .user-message {
                display: flex;
                justify-content: flex-end;
                --accent: hsl(262, 83%, 58%);
            }
            .user-message[data-mode="player"] {
                --accent: hsl(25, 83%, 48%);
            }
            .user-bubble {
                max-width: 70%;
                color: white;
                padding: 0.75rem 1rem;
                border-radius: 1rem;
                border-bottom-right-radius: 0.125rem;
                box-shadow:
                    0 10px 15px -3px rgba(0, 0, 0, 0.1),
                    0 4px 6px -4px rgba(0, 0, 0, 0.1);
                background: var(--accent);
            }
            .user-text {
                font-size: 0.875rem;
                line-height: 1.625;
            }
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
            .italic {
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
            .callout-text {
                color: var(--muted-foreground);
            }
            .list {
                list-style: disc;
                padding-left: 1.25rem;
                color: var(--muted-foreground);
            }
            .list > * + * {
                margin-top: 0.5rem;
            }
            .highlight {
                color: var(--foreground);
                font-weight: 700;
            }
        `,
    ];

    static properties = {
        message: { type: Object },
    };

    constructor() {
        super();
        /** @type {Message | undefined} */
        this.message = undefined;
    }

    render() {
        if (!this.message) {
            return nothing;
        }
        return this.message.role === "user"
            ? this.renderUserMessage(this.message)
            : this.renderAssistantMessage(this.message);
    }

    /**
     * @param {UserMessage} msg
     */
    renderUserMessage(msg) {
        return html`
            <div class="user-message" data-mode=${msg.mode ?? "gm"}>
                <div class="user-bubble">
                    <p class="user-text">${msg.content}</p>
                </div>
            </div>
        `;
    }

    /**
     * @param {AssistantMessage} msg
     */
    renderAssistantMessage(msg) {
        return html`
            <div class="assistant-message" data-mode=${msg.mode ?? "gm"}>
                <div class="assistant-avatar">🤖</div>
                <div class="assistant-content">
                    <div class="assistant-bubble">
                        <div class="bubble-content">
                            ${msg.blocks.map((block) => this.renderBlock(block))}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * @param {MessageBlock} block
     */
    renderBlock(block) {
        switch (block.type) {
            case "paragraph":
                return html`
                    <p class="${block.italic ? "italic" : ""}">
                        ${this.renderInline(block.segments ?? block.text)}
                    </p>
                `;
            case "callout":
                return html`
                    <sl-card class="callout-card" style="width: 100%;">
                        <p class="callout-title">${block.title}</p>
                        <p class="callout-text">
                            ${this.renderInline(block.segments ?? block.text)}
                        </p>
                    </sl-card>
                `;
            case "stat-block":
                return html` <stat-block .title=${block.title} .data=${block.data}></stat-block> `;
            case "list":
                return html`
                    <ul class="list">
                        ${block.items.map(
                            (item) => html`
                                <li>
                                    <strong class="highlight">${item.title}</strong>
                                    ${this.renderInline(item.segments ?? item.text)}
                                </li>
                            `,
                        )}
                    </ul>
                `;
            default:
                return nothing;
        }
    }

    /**
     * @param {Segment[] | string | undefined} inline
     */
    renderInline(inline) {
        if (!inline) {
            return nothing;
        }
        if (typeof inline === "string") {
            return inline;
        }
        return inline.map((seg) =>
            seg.highlight ? html`<strong class="highlight">${seg.text}</strong>` : seg.text,
        );
    }
}

const element = customElement("chat-message")(ChatMessage);
export { element as ChatMessage };
