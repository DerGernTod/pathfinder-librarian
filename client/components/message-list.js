import "../components/chat-message.js";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/spinner/spinner.js?deps=lit@3.3.2";
import { LitElement, css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").Message} Message */

class MessageList extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                display: flex;
                flex: 1;
                min-height: 0;
            }
            .messages {
                flex: 1;
                flex-direction: column-reverse;
                display: flex;
                gap: 1rem;
                overflow-y: auto;
                padding: 1.5rem;
            }
            .messages::before {
                content: "";
                margin-top: auto;
            }
            .messages::-webkit-scrollbar {
                width: 6px;
            }
            .messages::-webkit-scrollbar-track {
                background: transparent;
            }
            .messages::-webkit-scrollbar-thumb {
                background: var(--border-lighter);
                border-radius: 3px;
            }
            .loading {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: var(--muted-foreground);
            }
            .loading-text {
                font-size: 0.875rem;
            }
        `,
    ];

    static properties = {
        messages: { type: Array },
        loading: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {Message[]} */
        this.messages = [];
        /** @type {boolean} */
        this.loading = false;
    }

    render() {
        return html`
            <div class="messages">
                ${this.messages.toReversed().map((msg) => html` <chat-message .message=${msg}></chat-message> `)}
                ${this.loading
                    ? html`
                          <div class="loading">
                              <sl-spinner style="font-size: 1rem;"></sl-spinner>
                              <span class="loading-text">Thinking...</span>
                          </div>
                      `
                    : nothing}
            </div>
        `;
    }
}

const element = customElement("message-list")(MessageList);
export { element as MessageList };
