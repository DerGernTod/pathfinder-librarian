/** @typedef {import("../../shared/types.js").Mode} Mode */

import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

class ModeToggle extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            .mode-toggle {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                background: var(--secondary);
                border-radius: 0.5rem;
                padding: 0.25rem;
                border: 1px solid var(--border);
            }
            .mode-btn {
                padding: 0.375rem 0.75rem;
                font-size: 0.75rem;
                font-weight: 500;
                border-radius: 0.375rem;
                border: none;
                cursor: pointer;
                transition:
                    all var(--transition-speed),
                    background-color var(--accent-transition-speed);
                background: transparent;
                line-height: 1rem;
            }
            .mode-btn.active {
                color: white;
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                background: var(--accent);
            }
            .mode-btn.inactive {
                color: var(--muted-foreground);
            }
            .mode-btn.inactive:hover {
                color: var(--foreground);
            }
        `,
    ];

    static properties = {
        mode: { type: String },
    };

    constructor() {
        super();
        /** @type {Mode} */
        this.mode = "player";
    }

    render() {
        return html`
            <div class="mode-toggle">
                <button
                    @click=${() => this.setMode("player")}
                    class="mode-btn ${this.mode === "player" ? "active" : "inactive"}"
                >
                    ⚔️ Player Mode
                </button>
                <button
                    @click=${() => this.setMode("gm")}
                    class="mode-btn ${this.mode === "gm" ? "active" : "inactive"}"
                >
                    📜 GM Mode
                </button>
            </div>
        `;
    }

    /**
     * @param {Mode} mode
     */
    setMode(mode) {
        this.mode = mode;
        this.dispatchEvent(
            new CustomEvent("mode-change", { detail: { mode }, bubbles: true, composed: true }),
        );
    }
}

const element = customElement("mode-toggle")(ModeToggle);
export { element as ModeToggle };
