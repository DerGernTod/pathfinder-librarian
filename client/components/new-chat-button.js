import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/**
 * @customElement new-chat-button
 * @property {boolean} collapsed - Whether the sidebar is currently collapsed, which affects the button's appearance.
 * @fires new-chat - Fired when the user clicks the button to start a new chat.
 */
class NewChatButton extends LitElement {
    static properties = {
        collapsed: { type: Boolean },
    };

    static styles = [
        tokens,
        baseStyles,
        css`
            .btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                width: 100%;
                border-radius: 0.375rem;
                border: 1px dashed hsla(240, 5%, 64.9%, 0.5);
                padding: 0.5rem;
                font-size: 0.875rem;
                color: var(--muted-foreground);
                background: transparent;
                cursor: pointer;
                transition:
                    width 0.3s ease,
                    height 0.3s ease,
                    background-color var(--accent-transition-speed);
            }
            .btn:hover {
                background: var(--secondary);
                color: var(--secondary-foreground);
            }
            .btn-text {
                display: block;
                opacity: 1;
                transition: opacity 0.3s ease;
                white-space: nowrap;
            }
            .btn.collapsed .btn-text {
                opacity: 0;
                pointer-events: none;
                position: absolute;
            }
            .btn-icon {
                width: 1rem;
                height: 1.125rem;
                transition:
                    width 0.3s ease,
                    height 0.3s ease;
            }
        `,
    ];

    constructor() {
        super();
        this.collapsed = false;
    }

    render() {
        return html`
            <button
                @click=${this.handleClick}
                class="btn ${this.collapsed ? "collapsed" : ""}"
                aria-label=${this.collapsed ? "New Chat" : ""}
            >
                <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                    />
                </svg>
                <span class="btn-text">New Chat</span>
            </button>
        `;
    }

    handleClick() {
        this.dispatchEvent(new CustomEvent("new-chat", { bubbles: true, composed: true }));
    }
}

const element = customElement("new-chat-button")(NewChatButton);
export { element as NewChatButton };
