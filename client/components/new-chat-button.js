import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

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
                padding: 0.75rem;
                font-size: 0.875rem;
                color: var(--muted-foreground);
                background: transparent;
                cursor: pointer;
                transition:
                    all var(--transition-speed),
                    background-color var(--accent-transition-speed);
            }
            .btn.collapsed {
                width: 2.5rem;
                height: 2.5rem;
                padding: 0.5rem;
                margin-bottom: 0.5rem;
            }
            .btn:hover {
                background: var(--secondary);
                color: var(--secondary-foreground);
            }
            .btn-text {
                display: block;
            }
            .btn.collapsed .btn-text {
                display: none;
            }
            .btn-icon {
                width: 1rem;
                height: 1rem;
            }
            .btn.collapsed .btn-icon {
                width: 1.25rem;
                height: 1.25rem;
            }
        `,
    ];

    constructor() {
        super();
        this.collapsed = false;
    }

    render() {
        return html`
            <button @click=${this.handleClick} class="btn ${this.collapsed ? "collapsed" : ""}">
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
