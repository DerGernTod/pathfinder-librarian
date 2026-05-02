import "../components/chat-header.js";
import "../components/chat-input.js";
import "../components/chat-sidebar.js";
import "../components/message-list.js";
import "../components/settings-dialog.js";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { logout } from "../utils/auth-client.js";
import { client } from "../utils/rpc-client.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */
/** @typedef {import("../../shared/types.js").Message} Message */
/** @typedef {import("../../shared/types.js").Mode} Mode */
/** @typedef {import("../../shared/types.js").AuthUser} AuthUser */

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
        /** @type {boolean} Whether the assistant is currently generating a response */
        responding: { type: Boolean },
        sidebarExpanded: { type: Boolean },
        /** @type {AuthUser} */ user: { type: Object },
        /** @type {boolean} */ settingsOpen: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {Conversation[]} */
        this.conversations = [];
        /** @type {string} */
        this.activeConversationId = "";
        /** @type {Message[]} */
        this.messages = [];
        /** @type {Mode} */
        this.mode = "player";
        /** @type {boolean} */
        this.loading = true;
        /** @type {boolean} */
        this.responding = false;
        this.sidebarExpanded = true;
        /** @type {AuthUser | null} */
        this.user = null;
        /** @type {boolean} */
        this.settingsOpen = false;
    }

    async firstUpdated() {
        try {
            // Set mode from user
            if (this.user) {
                this.mode = this.user.mode;
            }

            // Step 1: Fetch conversations list
            const convRes = await client.api.conversations.$get();
            const convResult = await convRes.json();
            this.conversations = convResult.data;

            // Step 2: Set active conversation from result (first conversation)
            if (this.conversations.length > 0) {
                this.activeConversationId = this.conversations[0].id;

                // Step 3: Fetch messages for the active conversation
                const msgRes = await client.api.conversations[":id"].messages.$get({
                    param: { id: this.activeConversationId },
                });
                const msgResult = await msgRes.json();
                this.messages = msgResult.data;
            }
        } finally {
            this.loading = false;
        }
    }

    render() {
        return html`
            <div class="app" data-mode=${this.mode}>
                <chat-sidebar
                    .conversations=${this.conversations}
                    .activeId=${this.activeConversationId}
                    .mode=${this.mode}
                    .expanded=${this.sidebarExpanded}
                    .user=${this.user}
                    @new-chat=${this.handleNewChat}
                    @select-conversation=${this.handleSelectConversation}
                    @toggle-sidebar=${this.handleSidebarToggle}
                    @logout=${this.handleLogout}
                    @open-settings=${() => {
                        this.settingsOpen = true;
                    }}
                ></chat-sidebar>
                <main class="main">
                    <chat-header
                        .mode=${this.mode}
                        @mode-change=${this.handleModeChange}
                    ></chat-header>
                    <message-list
                        .messages=${this.filteredMessages}
                        .loading=${this.loading || this.responding}
                    ></message-list>
                    <chat-input
                        .mode=${this.mode}
                        .disabled=${this.responding}
                        @send-message=${this.handleSendMessage}
                    ></chat-input>
                </main>
            </div>
            <settings-dialog
                .open=${this.settingsOpen}
                .user=${this.user}
                @settings-closed=${() => {
                    this.settingsOpen = false;
                }}
                @settings-updated=${this.handleSettingsUpdated}
                @account-deleted=${this.handleAccountDeleted}
            ></settings-dialog>
        `;
    }

    async fetchConversations() {
        const res = await client.api.conversations.$get();
        const result = await res.json();
        this.conversations = result.data;
    }

    /**
     * @param {string} convId the conversation id
     */
    async fetchMessages(convId) {
        const res = await client.api.conversations[":id"].messages.$get({
            param: { id: convId },
        });
        const result = await res.json();
        this.messages = result.data;
    }

    async handleNewChat() {
        const res = await client.api.conversations.$post({
            json: { title: "New Conversation" },
        });
        const conv = await res.json();
        this.conversations = [...this.conversations, conv.data];
        this.activeConversationId = conv.data.id;
        await this.fetchMessages(conv.data.id);
    }

    /**
     * @param {CustomEvent<{ id: string }>} e
     */
    async handleSelectConversation(e) {
        this.activeConversationId = e.detail.id;
        await this.fetchMessages(e.detail.id);
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
    async handleSendMessage(e) {
        this.responding = true;

        try {
            const res = await client.api.conversations[":id"].messages.$post({
                param: { id: this.activeConversationId },
                json: { content: e.detail.text, mode: this.mode },
            });
            const result = await res.json();
            const { userMessage, assistantMessage } = result.data;
            this.messages = [...this.messages, userMessage, assistantMessage];
        } finally {
            this.responding = false;
        }
    }

    get filteredMessages() {
        return this.messages.filter(
            (message) => message.conversationId === this.activeConversationId,
        );
    }

    /** @param {CustomEvent<{ expanded: boolean }>} e */
    handleSidebarToggle(e) {
        this.sidebarExpanded = e.detail.expanded;
    }

    async handleLogout() {
        await logout();
        this.dispatchEvent(
            new CustomEvent("user-logged-out", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    /**
     * @param {CustomEvent<{ user: AuthUser }>} e
     */
    handleSettingsUpdated(e) {
        this.user = e.detail.user;
        this.mode = this.user.mode;
    }

    async handleAccountDeleted() {
        await logout();
        this.dispatchEvent(
            new CustomEvent("user-logged-out", {
                bubbles: true,
                composed: true,
            }),
        );
    }
}

customElement("main-page")(MainPage);
export { MainPage };
