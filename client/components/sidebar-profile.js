import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").Mode} Mode */

class SidebarProfile extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            .profile {
                border-top: 1px solid var(--border);
                padding-top: 1rem;
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            .avatar {
                width: 2rem;
                height: 2rem;
                border-radius: 9999px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
                font-weight: 700;
                color: white;
                background: var(--accent);
                transition:
                    background 0.5s ease,
                    color 0.5s ease,
                    box-shadow 0.5s ease;
            }
            .name {
                font-size: 0.875rem;
                font-weight: 500;
                line-height: 1;
            }
            .subtitle {
                font-size: 0.75rem;
                line-height: 1rem;
                color: var(--muted-foreground);
                margin-top: 0.25rem;
            }
        `,
    ];

    static properties = {
        name: { type: String },
        subtitle: { type: String },
        initials: { type: String },
        mode: { type: String },
    };

    constructor() {
        super();
        /** @type {string} */
        this.name = "";
        /** @type {string} */
        this.subtitle = "";
        /** @type {string} */
        this.initials = "";
        /** @type {Mode} */
        this.mode = "gm";
    }

    render() {
        return html`
            <div class="profile">
                <div class="avatar">${this.initials}</div>
                <div>
                    <p class="name">${this.name}</p>
                    <p class="subtitle">${this.subtitle}</p>
                </div>
            </div>
        `;
    }
}

const element = customElement("sidebar-profile")(SidebarProfile);
export { element as SidebarProfile };
