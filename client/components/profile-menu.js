import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/dropdown/dropdown.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/menu/menu.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/menu-item/menu-item.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/divider/divider.js?deps=lit@3.3.2";

/** @typedef {import("../../shared/types.js").Mode} Mode */

class ProfileMenu extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                display: block;
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
                border: none;
                cursor: pointer;
                padding: 0;
            }
            .avatar:hover {
                box-shadow: 0 0 0 3px hsla(262, 83%, 58%, 0.3);
            }
            sl-dropdown::part(panel) {
                min-height: 2rem;
                max-height: none;
                overflow: visible;
            }
            sl-menu-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
        `,
    ];

    static properties = {
        mode: { type: String },
    };

    constructor() {
        super();
        /** @type {Mode} */
        this.mode = "gm";
    }

    render() {
        return html`
            <sl-dropdown placement="top-start" distance="4" hoist>
                <button class="avatar" slot="trigger" aria-label="User menu">
                    ${this.initials}
                </button>
                <sl-menu>
                    <sl-menu-item @click=${this.handleSettings}> ⚙️ Settings </sl-menu-item>
                    <sl-divider></sl-divider>
                    <sl-menu-item @click=${this.handleLogout}> 🚪 Logout </sl-menu-item>
                </sl-menu>
            </sl-dropdown>
        `;
    }

    get initials() {
        const sidebarProfile = /** @type {HTMLElement & { initials?: string }} */ (
            this.closest("sidebar-profile")
        );
        if (sidebarProfile) {
            return sidebarProfile.initials || "U";
        }
        return "U";
    }

    handleSettings() {
        this.dispatchEvent(
            new CustomEvent("open-settings", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    handleLogout() {
        this.dispatchEvent(
            new CustomEvent("logout", {
                bubbles: true,
                composed: true,
            }),
        );
    }
}

customElement("profile-menu")(ProfileMenu);
export { ProfileMenu };
