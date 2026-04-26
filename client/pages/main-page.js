import "../components/chat-header.js";
import "../components/chat-input.js";
import "../components/chat-sidebar.js";
import "../components/message-list.js";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { client } from "../utils/rpc-client.js";

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
        this.conversations = [];
        /** @type {string} */
        this.activeConversationId = "";
        /** @type {Message[]} */
        this.messages = [];
        /** @type {Mode} */
        this.mode = "player";
        /** @type {boolean} */
        this.loading = true;
        this.sidebarExpanded = true;
    }

    async firstUpdated() {
        try {
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
                        .messages=${this.filteredMessages}
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
            json: { title: "New Conversation", userId: "00000000-0000-4000-8000-000000000001" },
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
        const res = await client.api.conversations[":id"].messages.$post({
            param: { id: this.activeConversationId },
            json: { content: e.detail.text, mode: this.mode },
        });
        const newMsg = await res.json();
        this.messages = [...this.messages, newMsg.data];
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
}

customElement("main-page")(MainPage);
export { MainPage };
