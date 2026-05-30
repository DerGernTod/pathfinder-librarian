import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { conversationContext } from "../stores/conversation-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/dropdown/dropdown.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/menu/menu.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/menu-item/menu-item.js?deps=lit@3.3.2";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */

/**
 * @customElement conversation-item
 * @property {Conversation} conversation - The conversation to display in the item.
 * @fires select - Fired when the user clicks on the conversation item, with the conversation ID in the event detail.
 * @fires archive-conversation - Fired when the user clicks the archive action.
 */
class ConversationItem extends BaseElement {
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
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.25rem;
                position: relative;
            }
            .item:hover {
                color: var(--foreground);
            }
            .item.active {
                background: var(--accent);
                color: var(--secondary-foreground);
            }
            .item-title {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }
            .kebab {
                opacity: 0;
                border: none;
                background: none;
                color: inherit;
                cursor: pointer;
                font-size: 1rem;
                padding: 0 0.125rem;
                line-height: 1;
                flex-shrink: 0;
                transition: opacity 0.15s ease;
            }
            .item:hover .kebab,
            .item.active .kebab {
                opacity: 1;
            }
            .item.active .kebab {
                display: none;
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
                <span class="item-title">
                    ${this.loading
                        ? html`<sl-spinner style="font-size: 0.75rem;"></sl-spinner>`
                        : nothing}
                    ${this.conversation.title}
                </span>
                ${!active
                    ? html`<sl-dropdown
                          placement="bottom-end"
                          distance="4"
                          hoist
                          @click=${(/** @type {Event} */ e) => e.stopPropagation()}
                      >
                          <button
                              class="kebab"
                              slot="trigger"
                              aria-label="Conversation actions"
                              @click=${(/** @type {Event} */ e) => e.stopPropagation()}
                          >
                              ⋯
                          </button>
                          <sl-menu>
                              <sl-menu-item @click=${() => this.handleArchive()}>
                                  📦 Archive
                              </sl-menu-item>
                          </sl-menu>
                      </sl-dropdown>`
                    : nothing}
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

    handleArchive() {
        this.dispatchEvent(
            new CustomEvent("archive-conversation", {
                detail: { id: this.conversation.id },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

const element = customElement("conversation-item")(ConversationItem);
export { element as ConversationItem };
