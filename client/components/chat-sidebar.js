import "./sidebar-toggle.js";
import "./new-chat-button.js";
import "./session-list.js";
import "./sidebar-profile.js";
import "./conversation-menu.js";
import { ContextConsumer } from "@lit/context";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { conversationContext } from "../stores/conversation-store.js";
import { modeContext } from "../stores/mode-store.js";
import { uiContext } from "../stores/ui-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/**
 * @customElement chat-sidebar
 * @property {import("../../shared/types.js").AuthUser | null} user - The authenticated user object.
 */
class ChatSidebar extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            .sidebar {
                width: 16rem;
                background: var(--secondary);
                border-right: 2px solid var(--accent-sidebar-border);
                display: flex;
                flex-direction: column;
                padding: 1rem;
                gap: 1rem;
                flex-shrink: 0;
                height: 100%;
                transition:
                    width 0.3s ease,
                    padding 0.3s ease;
            }
            .sidebar.collapsed {
                width: 3.5rem;
                padding: 1rem 0.5rem;
            }
            .toggle-container {
                display: flex;
                justify-content: flex-end;
            }
            .content-container {
                flex: 1;
                min-height: 0;
                position: relative;
            }
            .content {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                opacity: 1;
                transform: translateX(0);
                transition:
                    opacity 0.3s ease,
                    transform 0.3s ease;
            }
            .content.collapsed {
                opacity: 0;
                transform: translateX(-1rem);
                pointer-events: none;
            }
            .conversation-menu-wrapper {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: start;
                justify-content: center;
                opacity: 0;
                transform: translateX(1rem);
                transition:
                    opacity 0.3s ease,
                    transform 0.3s ease;
                pointer-events: none;
            }
            .conversation-menu-wrapper.visible {
                opacity: 1;
                transform: translateX(0);
                pointer-events: auto;
            }
            @media (max-width: 767px) {
                .sidebar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    z-index: 20;
                    transform: translateX(-100%);
                    transition: transform 0.3s ease;
                    box-shadow: none;
                }
                .sidebar.expanded-mobile {
                    transform: translateX(0);
                    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
                }
                .sidebar.collapsed {
                    transform: translateX(-100%);
                    width: 16rem;
                    padding: 1rem;
                }
            }
        `,
    ];

    static properties = {
        user: { type: Object },
    };

    constructor() {
        super();
        /** @type {import("../../shared/types.js").AuthUser | null} */
        this.user = null;
        /** @type {import("../stores/conversation-store.js").ConversationState} */
        this._convState = {
            conversations: [],
            activeConversationId: "",
            loading: true,
            loadingConversationId: "",
        };
        /** @type {import("../stores/mode-store.js").ModeState} */
        this._modeState = { mode: "gm" };
        /** @type {import("../stores/ui-store.js").UIState} */
        this._uiState = { sidebarExpanded: true, settingsOpen: false, breakpoint: "desktop" };
    }

    connectedCallback() {
        super.connectedCallback();
        new ContextConsumer(this, {
            context: conversationContext,
            callback:
                /** @param {import("../stores/conversation-store.js").ConversationState} v */ (
                    v,
                ) => {
                    this._convState = v;
                    this.requestUpdate();
                },
            subscribe: true,
        });
        new ContextConsumer(this, {
            context: modeContext,
            callback: /** @param {import("../stores/mode-store.js").ModeState} v */ (v) => {
                this._modeState = v;
            },
            subscribe: true,
        });
        new ContextConsumer(this, {
            context: uiContext,
            callback: /** @param {import("../stores/ui-store.js").UIState} v */ (v) => {
                this._uiState = v;
            },
            subscribe: true,
        });
    }

    /**
     * Renders the sidebar with session list and conversation menu.
     * Both elements are always in the DOM; CSS transitions handle visibility.
     * Session-list fades out left when collapsed, conversation-menu fades in from right.
     * @returns {import("lit-html").TemplateResult}
     */
    render() {
        const expanded = this._uiState.sidebarExpanded;
        const isPhone = this._uiState.breakpoint === "phone";
        const sidebarClasses = [
            "sidebar",
            !expanded ? "collapsed" : "",
            isPhone && expanded ? "expanded-mobile" : "",
        ]
            .filter(Boolean)
            .join(" ");
        return html`
            <aside class=${sidebarClasses}>
                <div class="toggle-container">
                    <sidebar-toggle
                        .expanded=${expanded}
                        .loading=${!expanded && !!this._convState.loadingConversationId}
                        @toggle-sidebar=${this.handleToggle}
                    ></sidebar-toggle>
                </div>
                <new-chat-button ?collapsed=${!expanded}></new-chat-button>
                <div class="content-container">
                    <div class="content ${!expanded ? "collapsed" : ""}">
                        <session-list></session-list>
                    </div>
                    <div class="conversation-menu-wrapper ${!expanded ? "visible" : ""}">
                        <conversation-menu></conversation-menu>
                    </div>
                </div>
                <sidebar-profile .user=${this.user} ?collapsed=${!expanded}></sidebar-profile>
            </aside>
        `;
    }

    /** @param {Event} e */
    handleToggle(e) {
        e.stopPropagation();
        const newExpanded = !this._uiState.sidebarExpanded;
        this.dispatchEvent(
            new CustomEvent("toggle-sidebar", {
                detail: { expanded: newExpanded },
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

    handleOpenSettings() {
        this.dispatchEvent(
            new CustomEvent("open-settings", {
                bubbles: true,
                composed: true,
            }),
        );
    }
}

const element = customElement("chat-sidebar")(ChatSidebar);
export { element as ChatSidebar };
