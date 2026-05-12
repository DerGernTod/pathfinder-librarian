import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { BaseElement } from "../components/base-element.js";
import { tokens } from "../styles/tokens.js";
import { getCurrentUser, logout } from "../utils/auth-client.js";
import "./login-page.js";
import "./main-page.js";

/** @typedef {import("../../shared/types.js").AuthUser} AuthUser */

// ::view-transition-* pseudo-elements live on <html>, outside any shadow root,
// so they cannot be reached from Lit's static styles. Inject once at module load.
const _vtStyle = document.createElement("style");
_vtStyle.textContent = `
    @keyframes vt-slide-out-down {
        from { opacity: 1; transform: translateY(0); }
        to   { opacity: 0; transform: translateY(20px); }
    }
    @keyframes vt-slide-in-from-above {
        from { opacity: 0; transform: translateY(-20px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes vt-fade-out {
        from { opacity: 1; }
        to   { opacity: 0; }
    }
    @keyframes vt-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
    }
    [data-view-transition="login"]::view-transition-old(root)  { animation: vt-slide-out-down      350ms ease-in-out both; }
    [data-view-transition="login"]::view-transition-new(root)  { animation: vt-slide-in-from-above 350ms ease-in-out both; }
    [data-view-transition="logout"]::view-transition-old(root) { animation: vt-slide-out-down      350ms ease-in-out both; }
    [data-view-transition="logout"]::view-transition-new(root) { animation: vt-slide-in-from-above 350ms ease-in-out both; }
    @media (prefers-reduced-motion: reduce) {
        [data-view-transition="login"]::view-transition-old(root),
        [data-view-transition="logout"]::view-transition-old(root)  { animation: vt-fade-out 350ms ease-in-out both; }
        [data-view-transition="login"]::view-transition-new(root),
        [data-view-transition="logout"]::view-transition-new(root)  { animation: vt-fade-in 350ms ease-in-out both; }
    }
`;
document.head.appendChild(_vtStyle);

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
        if (!("startViewTransition" in document)) {
            this.user = e.detail.user;
            return;
        }
        document.documentElement.dataset.viewTransition = "login";
        const transition = document.startViewTransition(async () => {
            this.user = e.detail.user;
            await this.updateComplete;
        });
        void transition.finished.then(() => {
            delete document.documentElement.dataset.viewTransition;
        });
    }

    async handleLogout() {
        await logout();
        if (!("startViewTransition" in document)) {
            this.user = null;
            return;
        }
        document.documentElement.dataset.viewTransition = "logout";
        const transition = document.startViewTransition(async () => {
            this.user = null;
            await this.updateComplete;
        });
        await transition.finished;
        delete document.documentElement.dataset.viewTransition;
    }
}

customElement("app-shell")(AppShell);
export { AppShell };
