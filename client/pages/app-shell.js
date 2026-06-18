// Shoelace side-effect import for sl-alert — REQUIRED before rendering
// `<sl-alert>` (reviewer point #3: inline-URL pattern per AGENTS.md).
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/alert/alert.js?deps=lit@3.3.2";
import { css } from "lit-element";
import { html } from "lit-html";
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
        _toastCount: { type: Number, state: true },
    };

    constructor() {
        super();
        /** @type {AuthUser | null} */
        this.user = null;
        /** @type {boolean} */
        this.loading = true;
        /** @type {number} */
        this._toastCount = 0;
        // online/offline transition toasts — descope candidate but implemented
        // per PLAN.md §"Transition toasts". Bound in connectedCallback.
        /** @type {(() => void) | null} */
        this._toastOnlineHandler = null;
        /** @type {(() => void) | null} */
        this._toastOfflineHandler = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._toastOfflineHandler = () =>
            this._notify("warning", "You're offline. Some actions are disabled.", 4000);
        this._toastOnlineHandler = () => this._notify("success", "Back online.", 3000);
        window.addEventListener("offline", this._toastOfflineHandler);
        window.addEventListener("online", this._toastOnlineHandler);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._toastOfflineHandler) {
            window.removeEventListener("offline", this._toastOfflineHandler);
        }
        if (this._toastOnlineHandler) {
            window.removeEventListener("online", this._toastOnlineHandler);
        }
    }

    /**
     * @param {"success" | "warning" | "danger" | "primary" | "neutral"} variant
     * @param {string} message
     * @param {number} duration
     */
    _notify(variant, message, duration) {
        const host = /** @type {HTMLElement | null} */ (
            this.shadowRoot?.querySelector("#toast-outlet")
        );
        if (!host) {
            return;
        }
        const alert = /** @type {HTMLElement & { toast?: (host: HTMLElement) => unknown }} */ (
            document.createElement("sl-alert")
        );
        alert.setAttribute("variant", variant);
        alert.setAttribute("duration", String(duration));
        alert.setAttribute("closable", "true");
        alert.innerHTML = message;
        host.appendChild(alert);
        if (typeof alert.toast === "function") {
            alert.toast(host);
        }
        this._toastCount++;
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
            return html`<div id="toast-outlet"></div>`;
        }

        if (this.user) {
            return html`
                <main-page
                    .user=${this.user}
                    @user-logged-out=${() => this.handleLogout()}
                ></main-page>
                <div id="toast-outlet"></div>
            `;
        }

        return html`
            <login-page @login-success=${this.handleLoginSuccess}></login-page>
            <div id="toast-outlet"></div>
        `;
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
