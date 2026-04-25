/** @typedef {import("../../shared/types.js").Mode} Mode */

import "./mode-toggle.js";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

class ChatHeader extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
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
            <header class="header">
                <div class="title-section">
                    <span class="title">Pathfinder 2e</span>
                    <span class="subtitle">Rules Assistant</span>
                </div>
                <mode-toggle .mode=${this.mode} @mode-change=${this.handleModeChange}></mode-toggle>
            </header>
        `;
    }

    /**
     * @param {CustomEvent<{ mode: Mode }>} e
     */
    handleModeChange(e) {
        this.mode = e.detail.mode;
        this.dispatchEvent(
            new CustomEvent("mode-change", {
                detail: { mode: e.detail.mode },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

const element = customElement("chat-header")(ChatHeader);
export { element as ChatHeader };
