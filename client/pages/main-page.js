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
            .landing-welcome {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                max-width: 40rem;
                margin: 0 auto;
                width: 100%;
            }
            .landing-welcome h1 {
                font-size: 1.875rem;
                font-weight: 700;
                margin-bottom: 0.5rem;
            }
            .landing-welcome p {
                color: var(--muted-foreground);
                font-size: 1rem;
                margin-bottom: 2rem;
            }
            .landing-input-row {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                width: 100%;
                max-width: 36rem;
                background: var(--secondary);
                border-radius: 0.75rem;
                border: 1px solid var(--border);
                padding: 0.75rem 1rem;
            }
            .landing-input-row:focus-within {
                outline: none;
                box-shadow: 0 0 0 1px var(--accent);
            }
            .landing-prompt {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                font-size: 1.125rem;
                line-height: 1.5rem;
                color: var(--foreground);
            }
            .landing-prompt::placeholder {
                color: var(--muted-foreground);
            }
            .landing-send-btn {
                color: white;
                border-radius: 0.5rem;
                padding: 0.5rem 1rem;
                border: none;
                cursor: pointer;
                background: var(--accent);
                font-size: 0.875rem;
            }
            .landing-send-btn:hover {
                opacity: 0.9;
            }
            .landing-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .landing-hint {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                margin-top: 0.75rem;
            }
            :focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }
        `,
    ];

    static properties = {
        conversations: { type: Array },
        activeConversationId: { type: String },
        messages: { type: Array },
        mode: { type: String },
        loading: { type: Boolean },
        responding: { type: Boolean },
        sidebarExpanded: { type: Boolean },
        user: { type: Object },
        settingsOpen: { type: Boolean },
        _pendingPrompt: { type: String },
        _submitting: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {Conversation[]} */
        this.conversations = [];
        /** @type {string} */
        this.activeConversationId = "";
        /** @type {import("../../shared/types.js").Message[]} */
        this.messages = [];
        /** @type {Mode} */
        this.mode = "player";
        /** @type {boolean} */
        this.loading = true;
        /** @type {boolean} */
        this.responding = false;
        /** @type {AbortController | null} */
        this._currentAssistantController = null;
        this.sidebarExpanded = true;
        /** @type {AuthUser | null} */
        this.user = null;
        /** @type {boolean} */
        this.settingsOpen = false;
        /** @type {string} */
        this._pendingPrompt = "";
        /** @type {boolean} */
        this._submitting = false;
    }

    get isLanding() {
        return !this.loading && this.filteredMessages.length === 0;
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
                this.messages = /** @type {import("../../shared/types.js").Message[]} */ (
                    msgResult.data
                );
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
                    ${this.isLanding
                        ? html`
                              <section role="region" aria-label="Welcome" class="landing-welcome">
                                  <h1>Pathfinder Librarian</h1>
                                  <p>Ask about rules, lore, or mechanics...</p>
                                  <div class="landing-input-row">
                                      <input
                                          aria-label="Type your first prompt"
                                          data-test="landing-input"
                                          class="landing-prompt"
                                          .value=${this._pendingPrompt}
                                          @input=${this._handleLandingInput}
                                          @keydown=${this._handleLandingKeydown}
                                          placeholder="e.g. How does flanking work?"
                                      />
                                      <button
                                          aria-label="Send prompt"
                                          class="landing-send-btn"
                                          data-test="landing-send"
                                          @click=${this._handleLandingSubmit}
                                      >
                                          Send
                                      </button>
                                  </div>
                                  <p class="landing-hint">Press Enter to send</p>
                              </section>
                          `
                        : html`
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
                                  .responding=${this.responding}
                                  @send-message=${this.handleSendMessage}
                                  @stop-message=${this.handleStopMessage}
                              ></chat-input>
                          `}
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
        this.messages = /** @type {import("../../shared/types.js").Message[]} */ (result.data);
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
        const controller = new AbortController();
        this._currentAssistantController = controller;

        try {
            const res = await client.api.conversations[":id"].messages.$post(
                {
                    param: { id: this.activeConversationId },
                    json: { content: e.detail.text, mode: this.mode },
                },
                {
                    init: { signal: controller.signal },
                },
            );

            /** @type {ReadableStream<Uint8Array>} */
            const body = /** @type {ReadableStream<Uint8Array>} */ (res.body);
            if (!body) {
                throw new Error("No response body");
            }
            const reader = body.getReader();
            const decoder = new TextDecoder();
            /** @type {import("../../shared/types.js").Message | null} */
            let userMessage = null;
            /** @type {import("../../shared/types.js").AssistantMessage | null} */
            let assistantMessage = null;
            let assistantMessageAdded = false;

            while (true) {
                const result = await reader.read();
                if (result.done) {
                    break;
                }
                const value = result.value;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n").filter(Boolean);
                for (const line of lines) {
                    /** @type {unknown} */
                    const data = JSON.parse(line);
                    if (
                        typeof data === "object" &&
                        data !== null &&
                        "type" in data &&
                        typeof data.type === "string" &&
                        "data" in data
                    ) {
                        /** @type {{ type: string, data: unknown }} */
                        const typedData = /** @type {{ type: string, data: unknown }} */ (data);
                        if (typedData.type === "userMessage") {
                            userMessage = /** @type {import("../../shared/types.js").Message} */ (
                                typedData.data
                            );
                            this.messages = [...this.messages, userMessage];
                        } else if (typedData.type === "assistantChunk") {
                            if (!assistantMessage) {
                                assistantMessage = {
                                    id: "temp-assistant-" + Date.now(),
                                    role: "assistant",
                                    blocks: [],
                                    mode: this.mode,
                                    conversationId: this.activeConversationId,
                                    content: null,
                                    createdAt: new Date().toISOString(),
                                };
                            }
                            assistantMessage = {
                                ...assistantMessage,
                                blocks: [
                                    ...(assistantMessage?.blocks ?? []),
                                    /** @type {import("../../shared/types.js").MessageBlock} */ (
                                        typedData.data
                                    ),
                                ],
                            };

                            if (!assistantMessageAdded) {
                                this.messages = [...this.messages, assistantMessage];
                                assistantMessageAdded = true;
                            } else {
                                this.messages = [...this.messages.slice(0, -1), assistantMessage];
                            }
                        } else if (typedData.type === "assistantComplete") {
                            assistantMessage =
                                /** @type {import("../../shared/types.js").AssistantMessage} */ (
                                    typedData.data
                                );
                            if (!assistantMessageAdded) {
                                this.messages = [...this.messages, assistantMessage];
                                assistantMessageAdded = true;
                            } else {
                                this.messages = [...this.messages.slice(0, -1), assistantMessage];
                            }
                        }
                    }
                }
            }
        } catch (err) {
            if (Error.isError(err) && err.name !== "AbortError") {
                // Ignore error
            }
        } finally {
            this.responding = false;
            this._currentAssistantController = null;
        }
    }

    handleStopMessage() {
        this._currentAssistantController?.abort();
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

    /**
     * @param {InputEvent & { currentTarget: HTMLInputElement }} e
     */
    _handleLandingInput(e) {
        this._pendingPrompt = e.currentTarget.value;
    }

    /**
     * @param {KeyboardEvent} e
     */
    _handleLandingKeydown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void this._handleLandingSubmit();
        }
    }

    async _handleLandingSubmit() {
        if (this._submitting) {
            return;
        }
        const text = this._pendingPrompt.trim();
        if (!text) {
            return;
        }
        this._submitting = true;

        /** @type {string} */
        let targetConvId = this.activeConversationId;

        try {
            if (this.conversations.length === 0) {
                const res = await client.api.conversations.$post({
                    json: { title: text.slice(0, 80) },
                });
                const conv = await res.json();
                const convData = conv.data;

                this.conversations = [convData, ...this.conversations];
                this.activeConversationId = convData.id;
                targetConvId = convData.id;
                await this.fetchMessages(convData.id);
            }

            this.responding = true;
            const controller = new AbortController();
            this._currentAssistantController = controller;

            try {
                const msgRes = await client.api.conversations[":id"].messages.$post(
                    {
                        param: { id: targetConvId },
                        json: { content: text, mode: this.mode },
                    },
                    {
                        init: { signal: controller.signal },
                    },
                );

                /** @type {ReadableStream<Uint8Array>} */
                const body = /** @type {ReadableStream<Uint8Array>} */ (msgRes.body);
                if (!body) {
                    throw new Error("No response body");
                }
                const reader = body.getReader();
                const decoder = new TextDecoder();
                /** @type {import("../../shared/types.js").Message | null} */
                let userMessage = null;
                /** @type {import("../../shared/types.js").AssistantMessage | null} */
                let assistantMessage = null;
                let assistantMessageAdded = false;

                while (true) {
                    const result = await reader.read();
                    if (result.done) {
                        break;
                    }
                    const value = result.value;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n").filter(Boolean);
                    for (const line of lines) {
                        /** @type {unknown} */
                        const data = JSON.parse(line);
                        if (
                            typeof data === "object" &&
                            data !== null &&
                            "type" in data &&
                            typeof data.type === "string" &&
                            "data" in data
                        ) {
                            /** @type {{ type: string, data: unknown }} */
                            const typedData = /** @type {{ type: string, data: unknown }} */ (data);
                            if (typedData.type === "userMessage") {
                                userMessage =
                                    /** @type {import("../../shared/types.js").Message} */ (
                                        typedData.data
                                    );
                                this.messages = [...this.messages, userMessage];
                            } else if (typedData.type === "assistantChunk") {
                                if (!assistantMessage) {
                                    assistantMessage = {
                                        id: "temp-assistant-" + Date.now(),
                                        role: "assistant",
                                        blocks: [],
                                        mode: this.mode,
                                        conversationId: this.activeConversationId,
                                        content: null,
                                        createdAt: new Date().toISOString(),
                                    };
                                }
                                assistantMessage = {
                                    ...assistantMessage,
                                    blocks: [
                                        ...(assistantMessage?.blocks ?? []),
                                        /** @type {import("../../shared/types.js").MessageBlock} */ (
                                            typedData.data
                                        ),
                                    ],
                                };

                                if (!assistantMessageAdded) {
                                    this.messages = [...this.messages, assistantMessage];
                                    assistantMessageAdded = true;
                                } else {
                                    this.messages = [
                                        ...this.messages.slice(0, -1),
                                        assistantMessage,
                                    ];
                                }
                            } else if (typedData.type === "assistantComplete") {
                                assistantMessage =
                                    /** @type {import("../../shared/types.js").AssistantMessage} */ (
                                        typedData.data
                                    );
                                if (!assistantMessageAdded) {
                                    this.messages = [...this.messages, assistantMessage];
                                    assistantMessageAdded = true;
                                } else {
                                    this.messages = [
                                        ...this.messages.slice(0, -1),
                                        assistantMessage,
                                    ];
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                if (Error.isError(err) && err.name !== "AbortError") {
                    // Ignore error
                }
            } finally {
                this.responding = false;
                this._currentAssistantController = null;
            }
        } catch {
            // Error creating conversation or posting message — _submitting reset in finally
        } finally {
            this._submitting = false;
            this._pendingPrompt = "";
        }

        await this.updateComplete;
        await new Promise((r) => requestAnimationFrame(r));
        const chatInput = this.shadowRoot?.querySelector("chat-input");
        if (chatInput && "updateComplete" in chatInput) {
            await /** @type {import("lit-element").LitElement} */ (chatInput).updateComplete;
        }
        const inner =
            chatInput?.shadowRoot?.querySelector("sl-textarea") ??
            chatInput?.shadowRoot?.querySelector("textarea");
        if (inner && "focus" in inner) {
            /** @type {HTMLElement} */ (inner).focus();
        }
    }
}

customElement("main-page")(MainPage);
export { MainPage };
