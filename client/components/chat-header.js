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
 * @customElement chat-header
 * @fires mode-change - Fired when the user changes the mode using the mode toggle.
 */
class ChatHeader extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                flex-shrink: 0;
            }
            @media (max-width: 767px) {
                :host {
                    flex-shrink: 100;
                    min-height: 0;
                    overflow: hidden;
                }
            }
            .header {
                height: 3.5rem;
                border-bottom: 1px solid var(--border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 1.5rem;
                flex-shrink: 0;
            }
            .title-section {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .title {
                font-size: 1.125rem;
                font-weight: 600;
                background: linear-gradient(to right, #c084fc, #f472b6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            .subtitle {
                font-size: 0.875rem;
                color: var(--muted-foreground);
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
        `,
    ];

    constructor() {
        super();
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
            <header class="header">
                <div class="title-section">
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
                    <span class="title">Pathfinder 2e</span>
                    ${this._uiState.breakpoint !== "phone"
                        ? html`<span class="subtitle">Rules Assistant</span>`
                        : nothing}
                </div>
                <mode-toggle @mode-change=${this.handleModeChange}></mode-toggle>
            </header>
        `;
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

const element = customElement("chat-header")(ChatHeader);
export { element as ChatHeader };
