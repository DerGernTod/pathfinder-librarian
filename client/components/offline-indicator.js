import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { uiContext } from "../stores/ui-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

/**
 * @customElement offline-indicator
 * @property {boolean} online - When false, the user is offline (badge shown).
 * @property {boolean} collapsed - When true (sidebar collapsed), renders as a small dot.
 */
class OfflineIndicator extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            /* Absolute positioning so this element does NOT enter the
               .profile grid flow in sidebar-profile (reviewer point #4). */
            :host {
                position: absolute;
                top: 0.25rem;
                right: 0.25rem;
                z-index: 1;
            }
            .offline-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                font-size: 0.65rem;
                font-weight: 600;
                padding: 0.125rem 0.375rem;
                border-radius: 9999px;
                background: hsla(48, 96%, 53%, 0.18);
                color: hsl(48, 96%, 65%);
                border: 1px solid hsla(48, 96%, 53%, 0.4);
                line-height: 1rem;
                white-space: nowrap;
            }
            .offline-badge .icon {
                width: 0.625rem;
                height: 0.625rem;
                flex-shrink: 0;
            }
            .offline-dot {
                display: inline-block;
                width: 0.5rem;
                height: 0.5rem;
                border-radius: 9999px;
                background: hsl(48, 96%, 53%);
                box-shadow: 0 0 0 2px hsla(48, 96%, 53%, 0.25);
            }
        `,
    ];

    static properties = {
        online: { type: Boolean },
        collapsed: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {boolean} */
        this.online = true;
        /** @type {boolean} */
        this.collapsed = false;
        /** @type {import("../stores/ui-store.js").UIState} */
        this._uiState = {
            sidebarExpanded: true,
            settingsOpen: false,
            archiveOpen: false,
            breakpoint: "desktop",
            online: true,
        };
    }

    connectedCallback() {
        super.connectedCallback();
        new ContextConsumer(this, {
            context: uiContext,
            callback: /** @param {import("../stores/ui-store.js").UIState} v */ (v) => {
                this._uiState = v;
                this.online = v.online !== false;
            },
            subscribe: true,
        });
    }

    render() {
        if (this.online !== false) {
            return nothing;
        }
        const title = "You're offline — only cached conversations are available.";
        if (this.collapsed) {
            return html`<span
                class="offline-dot"
                role="status"
                aria-live="polite"
                title=${title}
            ></span>`;
        }
        return html`<span class="offline-badge" role="status" aria-live="polite" title=${title}>
            <svg
                class="icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
            </svg>
            Offline
        </span>`;
    }
}

const element = customElement("offline-indicator")(OfflineIndicator);
export { element as OfflineIndicator };
