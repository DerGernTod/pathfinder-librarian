import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { BaseElement } from "../components/base-element.js";
import { tokens } from "../styles/tokens.js";
import { getCurrentUser, logout } from "../utils/auth-client.js";
import "./login-page.js";
import "./main-page.js";

/** @typedef {import("../../shared/types.js").AuthUser} AuthUser */

class AppShell extends BaseElement {
    static styles = [
        tokens,
        css`
            :host {
                display: block;
                height: 100vh;
            }
        `,
    ];

    static properties = {
        user: { type: Object },
        loading: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {AuthUser | null} */
        this.user = null;
        /** @type {boolean} */
        this.loading = true;
    }

    async firstUpdated() {
        super.firstUpdated();
        await this.ready;
        try {
            const result = await getCurrentUser();
            if (result) {
                this.user = result;
            }
        } catch {
            // not logged in
        } finally {
            this.loading = false;
        }
    }

    render() {
        if (this.loading) {
            return nothing;
        }

        if (this.user) {
            return html`
                <main-page
                    .user=${this.user}
                    @user-logged-out=${() => this.handleLogout()}
                ></main-page>
            `;
        }

        return html` <login-page @login-success=${this.handleLoginSuccess}></login-page> `;
    }

    /** @param {CustomEvent<{ user: AuthUser }>} e */
    handleLoginSuccess(e) {
        this.user = e.detail.user;
    }

    async handleLogout() {
        await logout();
        this.user = null;
    }
}

customElement("app-shell")(AppShell);
export { AppShell };
