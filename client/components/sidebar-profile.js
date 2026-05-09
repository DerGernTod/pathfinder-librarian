import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { modeContext } from "../stores/mode-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import "./profile-menu.js";
import { BaseElement } from "./base-element.js";

/** @typedef {import("../../shared/types.js").AuthUser} AuthUser */

/**
 * @customElement sidebar-profile
 * @property {string} name - The name of the user to display in the profile section.
 * @property {string} subtitle - The subtitle or role of the user.
 * @property {string} initials - The initials of the user to display in the avatar.
 * @property {boolean} collapsed - Whether the sidebar is currently collapsed, which affects the profile's appearance.
 */
class SidebarProfile extends BaseElement {
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
                justify-content: start;
                transition: all 0.5s ease;
            }
            .profile.collapsed {
                grid-template-columns: 100% 0fr;
                gap: 0;
                padding-top: 1rem;
                padding-left: 0.2rem;
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
        collapsed: { type: Boolean },
        user: { type: Object },
    };

    constructor() {
        super();
        /** @type {string} */
        this.name = "";
        /** @type {string} */
        this.subtitle = "";
        /** @type {string} */
        this.initials = "";
        /** @type {boolean} */
        this.collapsed = false;
        /** @type {AuthUser | null} */
        this.user = null;
        /** @type {import("../stores/mode-store.js").ModeState} */
        this._modeState = { mode: "gm" };
    }

    connectedCallback() {
        super.connectedCallback();
        new ContextConsumer(this, {
            context: modeContext,
            callback: /** @param {import("../stores/mode-store.js").ModeState} v */ (v) => {
                this._modeState = v;
            },
            subscribe: true,
        });
    }

    /**
     * @param {Map<string, unknown>} changedProperties
     */
    willUpdate(changedProperties) {
        // Sync user object properties to individual properties when user changes
        if (changedProperties.has("user") && this.user) {
            this.name = this.user.name || "";
            this.subtitle = this.user.subtitle || "";
            this.initials = this.user.initials || "";
        }
    }

    render() {
        return html`
            <div
                class="profile ${this.collapsed ? "collapsed" : ""}"
                aria-label=${this.collapsed ? `${this.name} - ${this.subtitle}` : ""}
            >
                <profile-menu></profile-menu>
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
