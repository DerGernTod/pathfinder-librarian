import "../components/chat-header.js";
import "../components/chat-input.js";
import "../components/chat-message.js";
import "../components/chat-sidebar.js";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/spinner/spinner.js?deps=lit@3.3.2";
import { LitElement } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from "../utils/mock-data.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */
/** @typedef {import("../../shared/types.js").Message} Message */
/** @typedef {import("../../shared/types.js").Mode} Mode */

class MainPage extends LitElement {
    static properties = {
        conversations: { type: Array },
        activeConversationId: { type: String },
        messages: { type: Array },
        mode: { type: String },
        loading: { type: Boolean },
    };

    createRenderRoot() {
        return this;
    }

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
            <div class="h-screen flex overflow-hidden bg-background text-foreground">
                <chat-sidebar
                    .conversations=${this.conversations}
                    .activeId=${this.activeConversationId}
                    @new-chat=${this.handleNewChat}
                    @select-conversation=${this.handleSelectConversation}
                ></chat-sidebar>
                <main class="flex-1 flex flex-col">
                    <chat-header
                        .mode=${this.mode}
                        @mode-change=${this.handleModeChange}
                    ></chat-header>
                    <div class="flex-1 overflow-y-auto p-6 space-y-6 chat-scroll">
                        ${this.messages.map(
                            (msg) => html` <chat-message .message=${msg}></chat-message> `,
                        )}
                        ${this.loading
                            ? html`
                                  <div
                                      class="flex items-center gap-2 text-muted-foreground justify-start"
                                  >
                                      <sl-spinner style="font-size: 1rem;"></sl-spinner>
                                      <span class="text-sm">Thinking...</span>
                                  </div>
                              `
                            : nothing}
                    </div>
                    <chat-input @send-message=${this.handleSendMessage}></chat-input>
                </main>
            </div>
        `;
    }

    handleNewChat() {
        // server integration later
    }

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
            { id: String(this.messages.length + 1), role: "user", content: text },
        ];
    }
}

const element = customElement("main-page")(MainPage);
export { element as MainPage };
