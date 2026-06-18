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
 *
 * Lives in chat-header so it is always visible on every breakpoint (the
 * sidebar is hidden by default on phone, so a sidebar-anchored indicator
 * would be invisible exactly when the user needs it most — next to the
 * disabled send button).
 */
class OfflineIndicator extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                display: inline-flex;
                align-items: center;
            }
            /* When online, the host is display:none so it does not
               contribute to the header flex gap (otherwise an empty
               inline-flex child would shift the new-chat icon and
               mode-toggle by the gap width). */
            :host([online]) {
                display: none;
            }
            .offline-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                font-size: 0.7rem;
                font-weight: 600;
                padding: 0.2rem 0.5rem;
                border-radius: 9999px;
                background: hsla(48, 96%, 53%, 0.18);
                color: hsl(48, 96%, 65%);
                border: 1px solid hsla(48, 96%, 53%, 0.4);
                line-height: 1rem;
                white-space: nowrap;
            }
            .offline-badge .icon {
                width: 0.7rem;
                height: 0.7rem;
                flex-shrink: 0;
            }
            @media (max-width: 767px) {
                .offline-badge {
                    font-size: 0.65rem;
                    padding: 0.125rem 0.375rem;
                    gap: 0.2rem;
                }
                .offline-badge .icon {
                    width: 0.625rem;
                    height: 0.625rem;
                }
                .offline-badge .label {
                    display: none;
                }
            }
        `,
    ];

    static properties = {
        online: { type: Boolean, reflect: true },
    };

    constructor() {
        super();
        /** @type {boolean} */
        this.online = true;
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
            <span class="label">Offline</span>
        </span>`;
    }
}

const element = customElement("offline-indicator")(OfflineIndicator);
export { element as OfflineIndicator };
