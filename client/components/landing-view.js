/** @typedef {import("../../shared/types.js").Mode} Mode */

import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/textarea/textarea.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/tooltip/tooltip.js?deps=lit@3.3.2";
import "./mode-toggle.js";
import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { modeContext } from "../stores/mode-store.js";
import { uiContext } from "../stores/ui-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { client } from "../utils/rpc-client.js";
import { showToast } from "../utils/toast.js";
import { BaseElement } from "./base-element.js";

/**
 * @customElement landing-view
 * @property {boolean} submitting - When true, disables the input and button to prevent double-submission.
 * @fires landing-submit - Fired when the user submits a prompt. Detail: { text: string }
 */
class LandingView extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
                overflow: hidden;
            }
            .landing-header {
                height: 3.5rem;
                flex-shrink: 0;
                border-bottom: 1px solid var(--border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 1.5rem;
                flex-shrink: 0;
            }
            .header-left {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .hamburger-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2rem;
                height: 2rem;
                background: transparent;
                border: none;
                color: var(--muted-foreground);
                cursor: pointer;
                border-radius: 0.375rem;
                padding: 0;
                flex-shrink: 0;
            }
            .hamburger-btn:hover {
                background: var(--secondary);
                color: var(--foreground);
            }
            .hamburger-icon {
                width: 1.25rem;
                height: 1.25rem;
            }
            .new-chat-icon-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2rem;
                height: 2rem;
                background: transparent;
                border: none;
                color: var(--muted-foreground);
                cursor: pointer;
                border-radius: 0.375rem;
                padding: 0;
                flex-shrink: 0;
            }
            .new-chat-icon-btn:hover {
                background: var(--secondary);
                color: var(--foreground);
            }
            .new-chat-icon {
                width: 1.125rem;
                height: 1.125rem;
            }
            @media (min-width: 768px) {
                .hamburger-btn {
                    display: none;
                }
            }
            .landing-welcome {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                max-width: 40rem;
                margin: 0 auto;
                width: 100%;
            }
            .landing-welcome h1 {
                font-size: 1.875rem;
                font-weight: 700;
                margin-bottom: 0.5rem;
            }
            .landing-welcome p {
                color: var(--muted-foreground);
                font-size: 1rem;
                margin-bottom: 2rem;
            }
            .landing-input-row {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                width: 100%;
                max-width: 36rem;
                background: var(--secondary);
                border-radius: 0.75rem;
                border: 1px solid var(--border);
                padding: 0.75rem 1rem;
            }
            .landing-input-row:focus-within {
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
                font-size: 1.125rem;
                line-height: 1.5rem;
                padding: 0;
                color: var(--foreground);
                max-height: 40vh;
                overflow-y: auto;
            }
            sl-textarea::part(textarea)::placeholder {
                color: var(--muted-foreground);
            }
            .landing-send-btn {
                color: white;
                border-radius: 0.5rem;
                padding: 0.5rem;
                border: none;
                cursor: pointer;
                background: var(--accent);
            }
            .send-icon {
                width: 1rem;
                height: 1rem;
                display: block;
            }
            .landing-send-btn:hover {
                opacity: 0.9;
            }
            .landing-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .disclaimer {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                text-align: center;
                margin-top: 0.75rem;
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
            :focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }
            @media (max-width: 767px) {
                .landing-header {
                    flex-shrink: 100;
                    min-height: 0;
                    overflow: hidden;
                }
                .landing-welcome {
                    padding: 1.5rem 1rem;
                }
                .landing-welcome h1 {
                    font-size: 1.5rem;
                }
                .landing-welcome p {
                    font-size: 0.875rem;
                    margin-bottom: 1.5rem;
                }
                .landing-input-row {
                    padding: 0.5rem 0.75rem;
                }
            }
        `,
    ];

    static properties = {
        submitting: { type: Boolean },
        _text: { type: String, state: true },
        _apiKeyStatus: { type: Object, state: true },
    };

    firstUpdated() {}

    updated() {
        const slTextarea = this.shadowRoot?.querySelector("sl-textarea");
        if (slTextarea && slTextarea.value !== this._text) {
            slTextarea.value = this._text;
        }
    }

    focusInput() {
        const root = this.shadowRoot;
        if (!root) {
            return;
        }
        const textarea = root.querySelector("sl-textarea");
        if (textarea) {
            textarea.focus();
        }
    }

    clearText() {
        this._text = "";
    }

    constructor() {
        super();
        /** @type {boolean} */
        this.submitting = false;
        /** @type {string} */
        this._text = "";
        this._apiKeyStatus = { available: true, reason: "ok" };
        /** @type {import("../stores/mode-store.js").ModeState} */
        this._modeState = { mode: "player" };
        /** @type {import("../stores/ui-store.js").UIState} */
        this._uiState = {
            sidebarExpanded: true,
            settingsOpen: false,
            archiveOpen: false,
            breakpoint: "desktop",
            online: true,
        };
    }

    connectedCallback() {
        super.connectedCallback();
        new ContextConsumer(this, {
            context: uiContext,
            callback: /** @param {import("../stores/ui-store.js").UIState} v */ (v) => {
                this._uiState = v;
            },
            subscribe: true,
        });
        new ContextConsumer(this, {
            context: modeContext,
            callback: /** @param {import("../stores/mode-store.js").ModeState} v */ (v) => {
                this._modeState = v;
            },
            subscribe: true,
        });
        void this._fetchApiKeyStatus();
    }

    render() {
        const offline = this._uiState.online === false;
        const sendDisabled = offline || this.submitting;
        return html`
            <header class="landing-header">
                <div class="header-left">
                    ${this._uiState.breakpoint === "phone"
                        ? html`<button
                              class="hamburger-btn"
                              @click=${this.handleMenuToggle}
                              aria-label="Open sidebar"
                          >
                              <svg
                                  class="hamburger-icon"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                              >
                                  <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M4 6h16M4 12h16M4 18h16"
                                  />
                              </svg>
                          </button>`
                        : nothing}
                </div>
                <div style="display:flex;align-items:center;gap:0.25rem;">
                    ${this._uiState.breakpoint === "phone"
                        ? html`<button
                              class="new-chat-icon-btn"
                              @click=${this.handleNewChat}
                              aria-label="New chat"
                              aria-disabled=${offline ? "true" : "false"}
                              tabindex=${offline ? "-1" : "0"}
                              title=${offline ? "Unavailable offline" : ""}
                          >
                              <svg
                                  class="new-chat-icon"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                              >
                                  <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M12 4v16m8-8H4"
                                  />
                              </svg>
                          </button>`
                        : nothing}
                    <mode-toggle></mode-toggle>
                </div>
            </header>
            <section role="region" aria-label="Welcome" class="landing-welcome" part="welcome">
                <h1 part="title">Pathfinder Librarian</h1>
                <p part="subtitle">Ask about rules, lore, or mechanics...</p>
                <div class="landing-input-row" part="input-row" data-mode=${this._modeState.mode}>
                    ${this._apiKeyStatus && !this._apiKeyStatus.available
                        ? html`<sl-tooltip
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
                          </sl-tooltip>`
                        : ""}
                    <sl-textarea
                        .value=${this._text}
                        @sl-input=${this._handleInput}
                        @keydown=${this._handleKeydown}
                        placeholder="Ask about rules, lore, or mechanics..."
                        resize="auto"
                        rows="1"
                        class="textarea-flex"
                        aria-label="Type your first prompt"
                        data-test="landing-input"
                        ?disabled=${this.submitting}
                        part="input"
                    ></sl-textarea>
                    <button
                        aria-label="Send prompt"
                        class="landing-send-btn"
                        data-test="landing-send"
                        ?disabled=${sendDisabled}
                        title=${offline ? "Unavailable offline" : ""}
                        @click=${this._handleSubmit}
                        part="send"
                    >
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
                </div>
                <p class="disclaimer" part="hint">
                    Pathfinder Librarian can make mistakes. Verify critical mechanics with the PRD.
                </p>
            </section>
        `;
    }

    /**
     * @param {CustomEvent & { currentTarget: HTMLElement & { value: string } }} e
     */
    _handleInput(e) {
        this._text = e.currentTarget.value;
    }

    /**
     * @param {KeyboardEvent} e
     */
    _handleKeydown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (this._uiState.online === false) {
                // Offline: preventDefault only — no shake, no submit.
                return;
            }
            this._handleSubmit();
        }
    }

    _handleSubmit() {
        if (this._uiState.online === false) {
            return;
        }
        if (this.submitting) {
            return;
        }
        const text = this._text.trim();
        if (!text) {
            return;
        }

        this.dispatchEvent(
            new CustomEvent("landing-submit", {
                detail: { text },
                bubbles: true,
                composed: true,
            }),
        );
        this._text = "";
    }

    _apiKeyStatusReasonText() {
        const reason = this._apiKeyStatus?.reason;
        switch (reason) {
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

    handleMenuToggle() {
        this.dispatchEvent(
            new CustomEvent("toggle-sidebar", {
                detail: { expanded: true },
                bubbles: true,
                composed: true,
            }),
        );
    }

    handleNewChat() {
        if (this._uiState.online === false) {
            showToast("warning", "You're offline — new chats are unavailable.", 3000);
            return;
        }
        this.dispatchEvent(
            new CustomEvent("new-chat", {
                bubbles: true,
                composed: true,
            }),
        );
    }
}

customElement("landing-view")(LandingView);
export { LandingView };
