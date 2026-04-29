import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */

/**
 * @customElement conversation-item
 * @property {Conversation} conversation - The conversation to display in the item.
 * @property {boolean} active - Whether this conversation is currently active/selected.
 * @fires select - Fired when the user clicks on the conversation item, with the conversation ID in the event detail.
 */
class ConversationItem extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                display: block;
            }
            .item {
                border-radius: 0.375rem;
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                color: var(--muted-foreground);
                line-height: 1.25rem;
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                transition:
                    all var(--transition-speed),
                    background-color var(--accent-transition-speed);
            }
            .item:hover {
                color: var(--foreground);
            }
            .item.active {
                background: var(--accent);
                color: var(--secondary-foreground);
            }
        `,
    ];

    static properties = {
        conversation: { type: Object },
        active: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {Conversation} */
        this.conversation = { id: "", title: "" };
        /** @type {boolean} */
        this.active = false;
    }

    render() {
        return html`
            <div class="item ${this.active ? "active" : ""}" @click=${() => this.handleClick()}>
                ${this.conversation.title}
            </div>
        `;
    }

    handleClick() {
        this.dispatchEvent(
            new CustomEvent("select", {
                detail: { id: this.conversation.id },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

const element = customElement("conversation-item")(ConversationItem);
export { element as ConversationItem };
