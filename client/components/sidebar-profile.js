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
                display: grid;
                grid-template-columns: 2rem 1fr;
                align-items: center;
                gap: 0.75rem;
                overflow: hidden;
                position: relative;
            }
            .profile.collapsed {
                grid-template-columns: 2rem 0fr;
                gap: 0;
                padding-top: 1rem;
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
            .text-container {
                overflow: hidden;
                opacity: 1;
                transition: opacity 0.3s ease;
            }
            .profile.collapsed .text-container {
                opacity: 0;
                pointer-events: none;
            }
            .name {
                font-size: 0.875rem;
                font-weight: 500;
                line-height: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .subtitle {
                font-size: 0.75rem;
                line-height: 1rem;
                color: var(--muted-foreground);
                margin-top: 0.25rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `,
    ];

    static properties = {
        name: { type: String },
        subtitle: { type: String },
        initials: { type: String },
        mode: { type: String },
        collapsed: { type: Boolean },
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
        /** @type {boolean} */
        this.collapsed = false;
    }

    render() {
        return html`
            <div
                class="profile ${this.collapsed ? "collapsed" : ""}"
                aria-label=${this.collapsed ? `${this.name} - ${this.subtitle}` : ""}
            >
                <div class="avatar">${this.initials}</div>
                <div class="text-container">
                    <p class="name">${this.name}</p>
                    <p class="subtitle">${this.subtitle}</p>
                </div>
            </div>
        `;
    }
}

const element = customElement("sidebar-profile")(SidebarProfile);
export { element as SidebarProfile };
