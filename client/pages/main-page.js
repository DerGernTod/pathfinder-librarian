import "../components/chat-header.js";
import "../components/chat-input.js";
import "../components/chat-sidebar.js";
import "../components/message-list.js";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from "../utils/mock-data.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */
/** @typedef {import("../../shared/types.js").Message} Message */
/** @typedef {import("../../shared/types.js").Mode} Mode */

class MainPage extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                height: 100vh;
            }
            .app {
                height: 100%;
                display: flex;
                overflow: hidden;
                background: var(--background);
                color: var(--foreground);
                --accent: hsl(262, 83%, 58%);
                --accent-foreground: hsl(0, 0%, 98%);
                --accent-sidebar-border: hsla(262, 83%, 58%, 0.25);
            }
            .app[data-mode="gm"] {
                --accent: hsl(262, 83%, 58%);
                --accent-foreground: hsl(0, 0%, 98%);
                --accent-sidebar-border: hsla(262, 83%, 58%, 0.45);
            }
            .app[data-mode="player"] {
                --accent: hsl(25, 83%, 48%);
                --accent-foreground: hsl(0, 0%, 98%);
                --accent-sidebar-border: hsla(25, 83%, 48%, 0.5);
            }
            .main {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
        `,
    ];

    static properties = {
        conversations: { type: Array },
        activeConversationId: { type: String },
        messages: { type: Array },
        mode: { type: String },
        loading: { type: Boolean },
        sidebarExpanded: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {Conversation[]} */
        this.conversations = MOCK_CONVERSATIONS;
        /** @type {string} */
        this.activeConversationId = "1";
        /** @type {Message[]} */
        this.messages = MOCK_MESSAGES;
        /** @type {Mode} */
        this.mode = "player";
        /** @type {boolean} */
        this.loading = false;
        this.sidebarExpanded = true;
    }

    render() {
        return html`
            <div class="app" data-mode=${this.mode}>
                <chat-sidebar
                    .conversations=${this.conversations}
                    .activeId=${this.activeConversationId}
                    .mode=${this.mode}
                    .expanded=${this.sidebarExpanded}
                    @new-chat=${this.handleNewChat}
                    @select-conversation=${this.handleSelectConversation}
                    @toggle-sidebar=${this.handleSidebarToggle}
                ></chat-sidebar>
                <main class="main">
                    <chat-header
                        .mode=${this.mode}
                        @mode-change=${this.handleModeChange}
                    ></chat-header>
                    <message-list
                        .messages=${this.messages}
                        .loading=${this.loading}
                    ></message-list>
                    <chat-input
                        .mode=${this.mode}
                        @send-message=${this.handleSendMessage}
                    ></chat-input>
                </main>
            </div>
        `;
    }

    handleNewChat() {}

    /**
     * @param {CustomEvent<{ id: string }>} e
     */
    handleSelectConversation(e) {
        this.activeConversationId = e.detail.id;
    }

    /**
     * @param {CustomEvent<{ mode: Mode }>} e
     */
    handleModeChange(e) {
        this.mode = e.detail.mode;
    }

    /**
     * @param {CustomEvent<{ text: string }>} e
     */
    handleSendMessage(e) {
        const text = e.detail.text;
        this.messages = [
            ...this.messages,
            { id: String(this.messages.length + 1), role: "user", content: text, mode: this.mode },
        ];
    }

    /** @param {CustomEvent<{ expanded: boolean }>} e */
    handleSidebarToggle(e) {
        this.sidebarExpanded = e.detail.expanded;
    }
}

const element = customElement("main-page")(MainPage);
export { element as MainPage };
