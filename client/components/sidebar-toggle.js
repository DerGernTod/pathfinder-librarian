import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

class SidebarToggle extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            .toggle-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 2rem;
                background: transparent;
                border: none;
                color: var(--muted-foreground);
                cursor: pointer;
                border-radius: 0.375rem;
                transition: all 0.2s ease;
            }
            .toggle-btn:hover {
                background: var(--secondary);
                color: var(--foreground);
            }
            .icon {
                width: 1.25rem;
                height: 1.25rem;
                transition: transform 0.3s ease;
            }
        `,
    ];

    static properties = {
        expanded: { type: Boolean },
    };

    constructor() {
        super();
        this.expanded = true;
    }

    render() {
        // Arrow icons with correct semantics: → for collapse, ← for expand
        const iconPath = this.expanded ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7";
        const ariaLabel = this.expanded ? "Collapse sidebar" : "Expand sidebar";

        return html`
            <button @click=${this.handleClick} class="toggle-btn" aria-label=${ariaLabel}>
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d=${iconPath}
                    />
                </svg>
            </button>
        `;
    }

    handleClick() {
        this.dispatchEvent(
            new CustomEvent("toggle-sidebar", {
                bubbles: true,
                composed: true,
            }),
        );
    }
}

const element = customElement("sidebar-toggle")(SidebarToggle);
export { element as SidebarToggle };
