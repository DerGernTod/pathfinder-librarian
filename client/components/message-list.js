import "../components/chat-message.js";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/spinner/spinner.js?deps=lit@3.3.2";
import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { messagesContext } from "../stores/messages-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

/**
 * @customElement message-list
 */
class MessageList extends BaseElement {
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
            @media (max-width: 767px) {
                .messages {
                    padding: 1rem 0.75rem;
                    gap: 0.75rem;
                }
            }
        `,
    ];

    constructor() {
        super();
        /** @type {import("../stores/messages-store.js").MessagesState} */
        this._msgState = { messages: [], responding: false };
    }

    connectedCallback() {
        super.connectedCallback();
        new ContextConsumer(this, {
            context: messagesContext,
            callback: /** @param {import("../stores/messages-store.js").MessagesState} v */ (v) => {
                this._msgState = v;
            },
            subscribe: true,
        });
    }

    render() {
        return html`
            <div class="messages">
                ${this._msgState.messages
                    .toReversed()
                    .map((msg) => html` <chat-message .message=${msg}></chat-message> `)}
                ${this._msgState.responding
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
