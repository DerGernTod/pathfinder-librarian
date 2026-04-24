import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/card/card.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/details/details.js?deps=lit@3.3.2";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

class StatBlock extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                margin-top: 1rem;
            }
            sl-details::part(base) {
                background: transparent;
                border: none;
                border-radius: 0;
            }
            sl-details::part(header) {
                padding: 0;
            }
            sl-details::part(summary) {
                font-size: 0.875rem;
                font-weight: 500;
                color: var(--muted-foreground);
            }
            sl-details::part(summary):hover {
                color: var(--foreground);
            }
            sl-details::part(summary-icon) {
                color: var(--muted-foreground);
            }
            sl-card::part(base) {
                background: var(--background);
                border: 1px solid var(--border-lighter);
                border-radius: 0.5rem;
            }
            sl-card::part(body) {
                padding: 1rem;
            }
            .stat-pre {
                font-family: monospace;
                font-size: 0.75rem;
                color: #4ade80;
                overflow-x: auto;
            }
        `,
    ];

    static properties = {
        title: { type: String },
        data: { type: Object },
    };

    constructor() {
        super();
        this.title = "";
        this.data = {};
    }

    render() {
        return html`
            <sl-details summary="View ${this.title} Stat Block">
                <sl-card style="width: 100%;">
                    <pre class="stat-pre">${JSON.stringify(this.data, null, 2)}</pre>
                </sl-card>
            </sl-details>
        `;
    }
}

const element = customElement("stat-block")(StatBlock);
export { element as StatBlock };
