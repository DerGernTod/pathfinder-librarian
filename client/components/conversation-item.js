import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { conversationContext } from "../stores/conversation-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

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
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.25rem;
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
            .item.disabled {
                opacity: 0.4;
                cursor: not-allowed;
                pointer-events: none;
            }
            .item-title {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }
            .kebab {
                border: none;
                background: none;
                color: inherit;
                cursor: pointer;
                font-size: 1rem;
                padding: 0 0.125rem;
                line-height: 1;
                flex-shrink: 0;
                opacity: 0;
                transition: opacity 0.15s ease;
            }
            .item:hover .kebab,
            .item.active .kebab {
                opacity: 1;
            }
            @media (hover: none) {
                .kebab {
                    opacity: 1;
                }
            }
            .menu {
                background: var(--popover, var(--background));
                border: 1px solid var(--border);
                border-radius: 0.375rem;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                padding: 0.25rem 0;
                min-width: 8rem;
                inset: auto;
                margin: 0;
            }
            .menu-item {
                display: block;
                width: 100%;
                border: none;
                background: none;
                color: var(--foreground);
                cursor: pointer;
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                text-align: left;
                white-space: nowrap;
            }
            .menu-item:hover {
                background: var(--accent);
                color: var(--secondary-foreground);
            }
        `,
    ];

    static properties = {
        conversation: { type: Object },
        loading: { type: Boolean },
        disabled: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {Conversation} */
        this.conversation = { id: "", title: "" };
        /** @type {boolean} */
        this.loading = false;
        /** @type {boolean} */
        this.disabled = false;
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
        const classes = [active ? "active" : "", this.disabled ? "disabled" : ""]
            .filter(Boolean)
            .join(" ");
        return html`
            <div
                class="item ${classes}"
                aria-disabled=${this.disabled ? "true" : "false"}
                tabindex=${this.disabled ? "-1" : "0"}
                title=${this.disabled ? "Unavailable offline — not cached" : ""}
                @click=${() => this.handleClick()}
            >
                <span class="item-title">
                    ${this.loading
                        ? html`<sl-spinner style="font-size: 0.75rem;"></sl-spinner>`
                        : nothing}
                    ${this.conversation.title}
                </span>
                ${this.disabled
                    ? nothing
                    : html`<button
                          class="kebab"
                          aria-label="Conversation actions"
                          @click=${(/** @type {Event} */ e) => this.handleKebabClick(e)}
                      >
                          ⋯
                      </button>`}
            </div>
            <div
                class="menu"
                popover="auto"
                @click=${(/** @type {Event} */ e) => this.handleMenuAction(e)}
            >
                <button class="menu-item" data-action="archive">📦 Archive</button>
            </div>
        `;
    }

    handleClick() {
        if (this.disabled) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent("select", {
                detail: { id: this.conversation.id },
                bubbles: true,
                composed: true,
            }),
        );
    }

    /** @param {Event} e */
    handleKebabClick(e) {
        e.stopPropagation();
        const menu = /** @type {HTMLElement & { togglePopover?: () => void }} */ (
            this.shadowRoot?.querySelector(".menu")
        );
        if (!menu) {
            return;
        }
        const btn = /** @type {HTMLElement} */ (e.currentTarget);
        const rect = btn.getBoundingClientRect();
        menu.style.position = "fixed";
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.left = `${Math.max(4, rect.right - 128)}px`;
        menu.togglePopover?.();
    }

    /** @param {Event} e */
    handleMenuAction(e) {
        const target = /** @type {HTMLElement} */ (e.target);
        const item = target.closest("[data-action]");
        if (!item) {
            return;
        }
        const action = item.getAttribute("data-action");
        const menu = /** @type {HTMLElement & { hidePopover?: () => void } } */ (
            this.shadowRoot?.querySelector(".menu")
        );
        menu?.hidePopover?.();
        if (action === "archive") {
            this.handleArchive();
        }
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
