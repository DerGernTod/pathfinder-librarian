import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").UserMessage} UserMessageType */

/**
 * @customElement user-message
 * @property {UserMessageType} message - The user message to display, containing the content and mode (GM or Player) for styling.
 */
class UserMessage extends LitElement {
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
            @media (max-width: 767px) {
                .user-bubble {
                    max-width: 85%;
                }
            }
        `,
    ];

    static properties = {
        message: { type: Object },
    };

    constructor() {
        super();
        /** @type {UserMessageType | undefined} */
        this.message = undefined;
    }

    render() {
        if (!this.message) {
            return html``;
        }
        return html`
            <div class="user-message" data-mode=${this.message.mode ?? "gm"}>
                <div class="user-bubble">
                    <p class="user-text">${this.message.content}</p>
                </div>
            </div>
        `;
    }
}

const element = customElement("user-message")(UserMessage);
export { element as UserMessage };
