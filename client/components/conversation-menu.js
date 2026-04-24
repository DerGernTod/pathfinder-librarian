// @ts-expect-error Side-effect import from esm.sh has no type declarations
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/icon-button/icon-button.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/menu/menu.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/menu-item/menu-item.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/dropdown/dropdown.js?deps=lit@3.3.2";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */
/** @typedef {import("../../shared/types.js").Mode} Mode */

class ConversationMenu extends LitElement {
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
        `,
    ];

    static properties = {
        /** @type {Conversation[]} */
        conversations: { type: Array },
        /** @type {string} */
        activeId: { type: String },
        /** @type {Mode} */
        mode: { type: String },
    };

    constructor() {
        super();
        this.conversations = [];
        this.activeId = "";
        this.mode = "gm";
    }

    render() {
        return html`
            <sl-dropdown placement="right-start">
                <sl-icon-button
                    class="menu-trigger"
                    slot="trigger"
                    name="list"
                    label="Recent conversations"
                ></sl-icon-button>
                <sl-menu>
                    <p
                        style="padding: 0.5rem 0.75rem; margin: 0; font-size: 0.75rem; color: var(--muted-foreground); font-weight: 500;"
                    >
                        Recent
                    </p>
                    ${this.conversations
                        .slice(0, 5)
                        .map(
                            (conv) => html`
                                <sl-menu-item
                                    value=${conv.id}
                                    .checked=${conv.id === this.activeId}
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
