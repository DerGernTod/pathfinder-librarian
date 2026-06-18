/** @typedef {import("../../shared/types.js").Mode} Mode */

import "./mode-toggle.js";
import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { uiContext } from "../stores/ui-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

/**
 * @customElement chat-header
 * @fires mode-change - Fired when the user changes the mode using the mode toggle.
 */
class ChatHeader extends BaseElement {
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
        `,
    ];

    constructor() {
        super();
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
    }

    render() {
        const offline = this._uiState.online === false;
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
        `;
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

const element = customElement("chat-header")(ChatHeader);
export { element as ChatHeader };
