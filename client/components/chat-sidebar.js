import "./sidebar-toggle.js";
import "./new-chat-button.js";
import "./session-list.js";
import "./sidebar-profile.js";
import "./conversation-menu.js";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */
/** @typedef {import("../../shared/types.js").Mode} Mode */

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
                padding: 0.5rem;
            }
            .sidebar.collapsed new-chat-button {
            }
            .toggle-container {
                display: flex;
                justify-content: flex-end;
            }
            .content {
                flex: 1;
                min-height: 0;
                overflow: hidden;
                opacity: 1;
                transform: translateX(0);
                max-height: 100%;
                transition:
                    opacity 0.3s ease,
                    transform 0.3s ease,
                    max-height 0.3s ease;
            }
            .content.collapsed {
                opacity: 0;
                transform: translateX(-1rem);
                pointer-events: none;
                max-height: 0;
            }
            .conversation-menu-wrapper {
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
        `,
    ];

    static properties = {
        conversations: { type: Array },
        activeId: { type: String },
        mode: { type: String },
        expanded: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {Conversation[]} */
        this.conversations = [];
        /** @type {string} */
        this.activeId = "";
        /** @type {Mode} */
        this.mode = "gm";
        this.expanded = true;
    }

    /**
     * Renders the sidebar with session list and conversation menu.
     * Both elements are always in the DOM; CSS transitions handle visibility.
     * Session-list fades out left when collapsed, conversation-menu fades in from right.
     * @returns {import("lit-html").TemplateResult}
     */
    render() {
        return html`
            <aside class="sidebar ${!this.expanded ? "collapsed" : ""}">
                <div class="toggle-container">
                    <sidebar-toggle
                        .expanded=${this.expanded}
                        @toggle-sidebar=${this.handleToggle}
                    ></sidebar-toggle>
                </div>
                <new-chat-button
                    @new-chat=${this.handleNewChat}
                    ?collapsed=${!this.expanded}
                ></new-chat-button>
                <div class="content ${!this.expanded ? "collapsed" : ""}">
                    <session-list
                        .mode=${this.mode}
                        .conversations=${this.conversations}
                        .activeId=${this.activeId}
                        @select-conversation=${this.handleSelectConversation}
                    ></session-list>
                </div>
                <div class="conversation-menu-wrapper ${!this.expanded ? "visible" : ""}">
                    <conversation-menu
                        .conversations=${this.conversations}
                        .activeId=${this.activeId}
                        .mode=${this.mode}
                        @select-conversation=${this.handleSelectConversation}
                    ></conversation-menu>
                </div>
                <sidebar-profile
                    .mode=${this.mode}
                    .name=${"Game Master 01"}
                    .subtitle=${"PF2e Remaster Rules"}
                    .initials=${"GM"}
                    ?collapsed=${!this.expanded}
                ></sidebar-profile>
            </aside>
        `;
    }

    handleNewChat() {
        this.dispatchEvent(new CustomEvent("new-chat", { bubbles: true, composed: true }));
    }

    /**
     * @param {CustomEvent<{ id: string }>} e
     */
    handleSelectConversation(e) {
        this.activeId = e.detail.id;
        this.dispatchEvent(
            new CustomEvent("select-conversation", {
                detail: { id: e.detail.id },
                bubbles: true,
                composed: true,
            }),
        );
    }

    handleToggle() {
        this.expanded = !this.expanded;
        this.dispatchEvent(
            new CustomEvent("toggle-sidebar", {
                detail: { expanded: this.expanded },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

const element = customElement("chat-sidebar")(ChatSidebar);
export { element as ChatSidebar };
