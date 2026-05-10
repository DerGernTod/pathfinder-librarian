import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/menu/menu.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/menu-item/menu-item.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/dropdown/dropdown.js?deps=lit@3.3.2";
import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { conversationContext } from "../stores/conversation-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

/**
 * @customElement conversation-menu
 * @fires select-conversation - Fired when the user selects a conversation from the menu, with the conversation ID in the event detail.
 */
class ConversationMenu extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            .menu-trigger {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2.5rem;
                height: 2.5rem;
                background: transparent;
                border: none;
                color: var(--muted-foreground);
                cursor: pointer;
                border-radius: 0.375rem;
                transition: all 0.2s ease;
                padding: 0;
            }
            .menu-trigger:hover {
                background: var(--secondary);
                color: var(--foreground);
            }
            .menu-icon {
                width: 1.25rem;
                height: 1.25rem;
            }
            sl-menu {
                max-width: 20rem;
            }
            sl-menu-item::part(base) {
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                color: var(--muted-foreground);
                line-height: 1.25rem;
                cursor: pointer;
                transition:
                    all var(--transition-speed),
                    background-color var(--accent-transition-speed);
            }
            sl-menu-item::part(base):hover {
                color: var(--foreground);
            }
            sl-menu-item.active::part(base) {
                background: var(--accent);
                color: var(--secondary-foreground);
            }
        `,
    ];

    constructor() {
        super();
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
        return html`
            <sl-dropdown placement="right-start">
                <button class="menu-trigger" slot="trigger" aria-label="Recent conversations">
                    <svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 6h16M4 12h16M4 18h16"
                        />
                    </svg>
                </button>
                <sl-menu>
                    <p
                        style="padding: 0.5rem 0.75rem; margin: 0; font-size: 0.75rem; color: var(--muted-foreground); font-weight: 500;"
                    >
                        Recent
                    </p>
                    ${this._convState.conversations
                        .slice(0, 5)
                        .map(
                            (conv) => html`
                                <sl-menu-item
                                    value=${conv.id}
                                    class=${conv.id === this._convState.activeConversationId
                                        ? "active"
                                        : ""}
                                    @click=${() => this.handleSelect(conv.id)}
                                >
                                    ${conv.title}
                                </sl-menu-item>
                            `,
                        )}
                </sl-menu>
            </sl-dropdown>
        `;
    }

    /** @param {string} id */
    handleSelect(id) {
        this.dispatchEvent(
            new CustomEvent("select-conversation", {
                detail: { id },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

const element = customElement("conversation-menu")(ConversationMenu);
export { element as ConversationMenu };
