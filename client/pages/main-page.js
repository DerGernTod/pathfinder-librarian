import "../components/chat-header.js";
import "../components/chat-input.js";
import "../components/chat-message.js";
import "../components/chat-sidebar.js";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/spinner/spinner.js?deps=lit@3.3.2";
import { LitElement, css } from "lit-element";
import { html, nothing } from "lit-html";
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
            .messages {
                flex: 1;
                overflow-y: auto;
                padding: 1.5rem;
            }
            .messages > * + * {
                margin-top: 1.5rem;
            }
            .messages::-webkit-scrollbar {
                width: 6px;
            }
            .messages::-webkit-scrollbar-track {
                background: transparent;
            }
            .messages::-webkit-scrollbar-thumb {
                background: var(--border-lighter);
                border-radius: 3px;
            }
            .loading {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: var(--muted-foreground);
            }
            .loading-text {
                font-size: 0.875rem;
            }
        `,
    ];

    static properties = {
        conversations: { type: Array },
        activeConversationId: { type: String },
        messages: { type: Array },
        mode: { type: String },
        loading: { type: Boolean },
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
    }

    render() {
        return html`
            <div class="app" data-mode=${this.mode}>
                <chat-sidebar
                    .conversations=${this.conversations}
                    .activeId=${this.activeConversationId}
                    .mode=${this.mode}
                    @new-chat=${this.handleNewChat}
                    @select-conversation=${this.handleSelectConversation}
                ></chat-sidebar>
                <main class="main">
                    <chat-header
                        .mode=${this.mode}
                        @mode-change=${this.handleModeChange}
                    ></chat-header>
                    <div class="messages">
                        ${this.messages.map(
                            (msg) => html` <chat-message .message=${msg}></chat-message> `,
                        )}
                        ${this.loading
                            ? html`
                                  <div class="loading">
                                      <sl-spinner style="font-size: 1rem;"></sl-spinner>
                                      <span class="loading-text">Thinking...</span>
                                  </div>
                              `
                            : nothing}
                    </div>
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
}

const element = customElement("main-page")(MainPage);
export { element as MainPage };
