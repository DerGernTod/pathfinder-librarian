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
                overflow-y: auto;
            }
            :host::-webkit-scrollbar {
                width: 6px;
            }
            :host::-webkit-scrollbar-track {
                background: transparent;
            }
            :host::-webkit-scrollbar-thumb {
                background: var(--border-lighter);
                border-radius: 3px;
            }
            .messages {
                flex: 1;
                flex-direction: column-reverse;
                display: flex;
                gap: 1rem;
                padding: 1.5rem;
                max-width: 56rem;
                margin-inline: auto;
                width: 100%;
            }
            .messages::before {
                content: "";
                margin-top: auto;
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
            .error-callout {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
                background: hsl(0, 70%, 15%);
                border: 1px solid hsl(0, 70%, 35%);
                border-radius: 0.5rem;
                color: hsl(0, 70%, 75%);
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

    renderResponding() {
        if (!this._msgState.responding) {
            return nothing;
        }
        if (this._msgState.retryInfo) {
            return renderRetry(this._msgState.retryInfo);
        }
        return renderThinking();
    }

    render() {
        return html`
            <div class="messages">
                ${this._msgState.error
                    ? html`
                          <div class="error-callout" role="alert">
                              <span aria-hidden="true">⚠</span>
                              <span>${this._msgState.error}</span>
                          </div>
                      `
                    : nothing}
                ${this.renderResponding()}
                ${this._msgState.messages
                    .toReversed()
                    .map((msg) => html` <chat-message .message=${msg}></chat-message> `)}
            </div>
        `;
    }
}

function renderThinking() {
    return html`
        <div class="loading">
            <sl-spinner style="font-size: 1rem;"></sl-spinner>
            <span class="loading-text">Thinking...</span>
        </div>
    `;
}

/**
 *
 * @param {import("../stores/messages-store.js").RetryInfo} retryInfo
 */
function renderRetry(retryInfo) {
    return html`
        <div class="loading">
            <sl-spinner style="font-size: 1rem;"></sl-spinner>
            <span class="loading-text">
                Service busy. Retrying in ${retryInfo.delay}s (attempt
                ${retryInfo.attempt}/${retryInfo.maxAttempts})... Press Stop to cancel.
            </span>
        </div>
    `;
}

const element = customElement("message-list")(MessageList);
export { element as MessageList };
