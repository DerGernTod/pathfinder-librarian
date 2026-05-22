import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/textarea/textarea.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/tooltip/tooltip.js?deps=lit@3.3.2";
import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { messagesContext } from "../stores/messages-store.js";
import { modeContext } from "../stores/mode-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { client } from "../utils/rpc-client.js";
import { BaseElement } from "./base-element.js";

/**
 * @template T
 * @typedef {InputEvent & { currentTarget: T }} TargetedInputEvent
 */

/**
 * @customElement chat-input
 * @property {string} value - The current value of the chat input.
 * @fires send-message - Fired when the user submits a message, with the message text in the event detail.
 */
class ChatInput extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                flex-shrink: 0;
            }
            .wrapper {
                padding: 1rem;
                border-top: 1px solid var(--border);
            }
            .input-row {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                max-width: 56rem;
                margin: 0 auto;
                background: var(--secondary);
                border-radius: 0.75rem;
                border: 1px solid var(--border);
                padding: 0.5rem 1rem;
                transition: box-shadow 0.5s ease;
            }
            .input-row:focus-within {
                outline: none;
                box-shadow: 0 0 0 1px var(--accent);
            }
            .textarea-flex {
                flex: 1;
            }
            sl-textarea::part(base) {
                background: transparent;
                border: none;
                box-shadow: none;
            }
            sl-textarea::part(textarea) {
                background: transparent;
                font-size: 0.875rem;
                line-height: 1.25rem;
                padding: 0;
                color: var(--foreground);
            }
            sl-textarea::part(textarea)::placeholder {
                color: var(--muted-foreground);
            }
            .send-btn {
                color: white;
                border-radius: 0.5rem;
                padding: 0.5rem;
                border: none;
                cursor: pointer;
                background: var(--accent);
                transition:
                    opacity var(--transition-speed),
                    background-color var(--accent-transition-speed);
            }
            .send-btn:hover {
                opacity: 0.9;
            }
            .send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .send-icon {
                width: 1rem;
                height: 1rem;
                display: block;
            }
            .disclaimer {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                text-align: center;
                margin-top: 0.5rem;
                line-height: 1rem;
            }
            .api-warning-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 1.25rem;
                height: 1.25rem;
                flex-shrink: 0;
                color: hsl(48, 96%, 53%);
                cursor: help;
            }
            .api-warning-icon svg {
                width: 1rem;
                height: 1rem;
            }
        `,
    ];

    static properties = {
        value: { type: String },
        _apiKeyStatus: { type: Object },
    };

    clearValue() {
        this.value = "";
    }

    updated() {
        const slTextarea = this.shadowRoot?.querySelector("sl-textarea");
        if (slTextarea && slTextarea.value !== this.value) {
            slTextarea.value = this.value;
        }
    }

    constructor() {
        super();
        this.value = "";
        this._apiKeyStatus = { available: true, reason: "ok" };
        /** @type {import("../stores/mode-store.js").ModeState} */
        this._modeState = { mode: "gm" };
        /** @type {import("../stores/messages-store.js").MessagesState} */
        this._msgState = { messages: [], responding: false };
        this._handleSelectConversation = () => {
            this.clearValue();
            const textarea = this.shadowRoot?.querySelector("sl-textarea");
            textarea?.focus();
        };
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener("select-conversation", this._handleSelectConversation);
        new ContextConsumer(this, {
            context: modeContext,
            callback: /** @param {import("../stores/mode-store.js").ModeState} v */ (v) => {
                this._modeState = v;
            },
            subscribe: true,
        });
        new ContextConsumer(this, {
            context: messagesContext,
            callback: /** @param {import("../stores/messages-store.js").MessagesState} v */ (v) => {
                this._msgState = v;
            },
            subscribe: true,
        });
        void this._fetchApiKeyStatus();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener("select-conversation", this._handleSelectConversation);
    }

    render() {
        return html`
            <div class="wrapper">
                <div class="input-row" data-mode=${this._modeState.mode}>
                    ${!this._apiKeyStatus.available
                        ? html`
                              <sl-tooltip
                                  content="${this._apiKeyStatusReasonText()}"
                                  placement="top"
                                  trigger="click hover"
                              >
                                  <span
                                      class="api-warning-icon"
                                      aria-label="${this._apiKeyStatusReasonText()}"
                                  >
                                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                                          />
                                      </svg>
                                  </span>
                              </sl-tooltip>
                          `
                        : ""}
                    <sl-textarea
                        .value=${this.value}
                        @sl-input=${this.handleInput}
                        @keydown=${this.handleKeydown}
                        placeholder="Ask about rules, lore, or mechanics..."
                        resize="auto"
                        rows="1"
                        class="textarea-flex"
                        autofocus
                        data-test="composer-input"
                    ></sl-textarea>
                    ${this._msgState.responding
                        ? html`
                              <button @click=${this.handleStop} class="send-btn stop">Stop</button>
                          `
                        : html`
                              <button @click=${this.handleSubmit} class="send-btn">
                                  <svg
                                      class="send-icon"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                  >
                                      <path
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                          stroke-width="2"
                                          d="M5 12h14M12 5l7 7-7 7"
                                      />
                                  </svg>
                              </button>
                          `}
                </div>
                <p class="disclaimer">
                    Pathfinder Librarian can make mistakes. Verify critical mechanics with the PRD.
                </p>
            </div>
        `;
    }

    /**
     * @param {TargetedInputEvent<HTMLTextAreaElement>} e
     */
    handleInput(e) {
        this.value = e.currentTarget.value;
    }

    /**
     * @param {KeyboardEvent} e
     */
    handleKeydown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this.handleSubmit();
        }
    }

    handleSubmit() {
        if (this._msgState.responding) {
            return;
        }
        const text = this.value.trim();
        if (!text) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent("send-message", { detail: { text }, bubbles: true, composed: true }),
        );
        this.value = "";
    }

    handleStop() {
        this.dispatchEvent(new CustomEvent("stop-message", { bubbles: true, composed: true }));
    }

    /**
     * @returns {string}
     */
    _apiKeyStatusReasonText() {
        switch (this._apiKeyStatus.reason) {
            case "not_set":
                return "API key not configured";
            case "empty":
                return "API key is empty";
            default:
                return "Google API key issue — using mock responses";
        }
    }

    async _fetchApiKeyStatus() {
        try {
            const res = await client.api.auth["api-key-status"].$get();
            if (res.ok) {
                const data = await res.json();
                this._apiKeyStatus = data.data;
            }
        } catch {
            // Silently ignore — default to available=true
        }
    }
}

const element = customElement("chat-input")(ChatInput);
export { element as ChatInput };
