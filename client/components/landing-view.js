/** @typedef {import("../../shared/types.js").Mode} Mode */

import "./mode-toggle.js";
import { ContextConsumer } from "@lit/context";
import { LitElement, css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { uiContext } from "../stores/ui-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/**
 * @customElement landing-view
 * @property {boolean} submitting - When true, disables the input and button to prevent double-submission.
 * @fires landing-submit - Fired when the user submits a prompt. Detail: { text: string }
 */
class LandingView extends LitElement {
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
            .landing-prompt {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                font-size: 1.125rem;
                line-height: 1.5rem;
                color: var(--foreground);
            }
            .landing-prompt:focus-visible {
                outline: none;
            }
            .landing-prompt::placeholder {
                color: var(--muted-foreground);
            }
            .landing-send-btn {
                color: white;
                border-radius: 0.5rem;
                padding: 0.5rem 1rem;
                border: none;
                cursor: pointer;
                background: var(--accent);
                font-size: 0.875rem;
            }
            .landing-send-btn:hover {
                opacity: 0.9;
            }
            .landing-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .landing-hint {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                margin-top: 0.75rem;
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
                .landing-prompt {
                    font-size: 1rem;
                }
            }
        `,
    ];

    static properties = {
        submitting: { type: Boolean },
        _text: { type: String, state: true },
    };

    constructor() {
        super();
        /** @type {boolean} */
        this.submitting = false;
        /** @type {string} */
        this._text = "";
        /** @type {import("../stores/ui-store.js").UIState} */
        this._uiState = { sidebarExpanded: true, settingsOpen: false, breakpoint: "desktop" };
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
    }

    render() {
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
                <mode-toggle @mode-change=${this.handleModeChange}></mode-toggle>
            </header>
            <section role="region" aria-label="Welcome" class="landing-welcome" part="welcome">
                <h1 part="title">Pathfinder Librarian</h1>
                <p part="subtitle">Ask about rules, lore, or mechanics...</p>
                <div class="landing-input-row" part="input-row">
                    <input
                        aria-label="Type your first prompt"
                        data-test="landing-input"
                        class="landing-prompt"
                        .value=${this._text}
                        ?disabled=${this.submitting}
                        @input=${this._handleInput}
                        @keydown=${this._handleKeydown}
                        placeholder="e.g. How does flanking work?"
                        part="input"
                    />
                    <button
                        aria-label="Send prompt"
                        class="landing-send-btn"
                        data-test="landing-send"
                        ?disabled=${this.submitting}
                        @click=${this._handleSubmit}
                        part="send"
                    >
                        Send
                    </button>
                </div>
                <p class="landing-hint" part="hint">Press Enter to send</p>
            </section>
        `;
    }

    /**
     * @param {InputEvent & { currentTarget: HTMLInputElement }} e
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
            this._handleSubmit();
        }
    }

    _handleSubmit() {
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

    /**
     * @param {CustomEvent<{ mode: Mode }>} e
     */
    handleModeChange(e) {
        this.dispatchEvent(
            new CustomEvent("mode-change", {
                detail: { mode: e.detail.mode },
                bubbles: true,
                composed: true,
            }),
        );
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
}

customElement("landing-view")(LandingView);
export { LandingView };
