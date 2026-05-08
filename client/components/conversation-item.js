import { ContextConsumer } from "@lit/context";
import { LitElement, css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { conversationContext } from "../stores/conversation-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */

/**
 * @customElement conversation-item
 * @property {Conversation} conversation - The conversation to display in the item.
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
        loading: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {Conversation} */
        this.conversation = { id: "", title: "" };
        /** @type {boolean} */
        this.loading = false;
        /** @type {import("../stores/conversation-store.js").ConversationState} */
        this._convState = { conversations: [], activeConversationId: "", loading: true };
    }

    connectedCallback() {
        super.connectedCallback();
        new ContextConsumer(this, {
            context: conversationContext,
            callback:
                /** @param {import("../stores/conversation-store.js").ConversationState} v */ (
                    v,
                ) => {
                    this._convState = v;
                },
            subscribe: true,
        });
    }

    render() {
        const active = this._convState.activeConversationId === this.conversation.id;
        return html`
            <div class="item ${active ? "active" : ""}" @click=${() => this.handleClick()}>
                ${this.loading
                    ? html`<sl-spinner style="font-size: 0.75rem;"></sl-spinner>`
                    : nothing}
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
