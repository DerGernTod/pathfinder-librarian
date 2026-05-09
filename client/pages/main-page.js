import "../components/chat-sidebar.js";
import "../components/chat-view.js";
import "../components/landing-view.js";
import "../components/settings-dialog.js";
import { ContextProvider } from "@lit/context";
import { LitElement, css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

import { conversationContext, createConversationStore } from "../stores/conversation-store.js";
import { messagesContext, createMessagesStore } from "../stores/messages-store.js";
import { modeContext, createModeStore } from "../stores/mode-store.js";
import { uiContext, createUIStore } from "../stores/ui-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { logout } from "../utils/auth-client.js";
import { router } from "../utils/router.js";
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
                position: relative;
            }
            .view-layer {
                position: absolute;
                inset: 0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                transform: translateY(10px);
                pointer-events: none;
                transition:
                    opacity 0.5s ease-in-out,
                    transform 0.5s ease-in-out;
            }
            .view-layer.active {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            .sidebar-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10;
            }
            @media (max-width: 767px) {
                .main {
                    width: 100%;
                }
            }
        `,
    ];

    static properties = {
        user: { type: Object },
        _landingSubmitting: { type: Boolean },
        _routeParams: { type: Object },
        _convState: { type: Object },
        _msgState: { type: Object },
        _modeState: { type: Object },
        _uiState: { type: Object },
        _isNewChat: { type: Boolean },
        _viewState: { type: String },
        _prevViewState: { type: String },
    };

    constructor() {
        super();
        /** @type {AuthUser | null} */
        this.user = null;
        /** @type {boolean} */
        this._landingSubmitting = false;
        /** @type {boolean} */
        this._isNewChat = false;
        /** @type {string} */
        this._viewState = "loading";
        /** @type {string} */
        this._prevViewState = "loading";

        /** @type {{ conversationId?: string }} */
        this._routeParams = {};

        // Internal state objects (provided via ContextProvider)
        /** @type {import("../stores/conversation-store.js").ConversationState} */
        this._convState = {
            conversations: [],
            activeConversationId: "",
            loading: true,
            loadingConversationId: "",
        };

        /** @type {import("../stores/messages-store.js").MessagesState} */
        this._msgState = { messages: [], responding: false };

        /** @type {import("../stores/mode-store.js").ModeState} */
        this._modeState = { mode: "player" };

        /** @type {import("../stores/ui-store.js").UIState} */
        this._uiState = { sidebarExpanded: true, settingsOpen: false, breakpoint: "desktop" };

        // Store instances
        this._convStore = createConversationStore();
        this._msgStore = createMessagesStore();
        this._modeStore = createModeStore();
        this._uiStore = createUIStore();

        /** @type {AbortController | null} */
        this._currentAssistantController = null;
    }

    get isLanding() {
        if (this._viewState === "landing") {
            return true;
        }
        if (this._viewState === "conversation") {
            return false;
        }
        // _viewState is "loading" or undefined - use legacy check for tests
        return (
            !this._convState.loading &&
            this._msgState.messages.length === 0 &&
            this._convState.conversations.length === 0
        );
    }

    connectedCallback() {
        super.connectedCallback();

        // ContextProvider instances with guards against re-creation
        if (!this._convProvider) {
            this._convProvider = new ContextProvider(this, {
                context: conversationContext,
                initialValue: this._convState,
            });
        }
        if (!this._msgProvider) {
            this._msgProvider = new ContextProvider(this, {
                context: messagesContext,
                initialValue: this._msgState,
            });
        }
        if (!this._modeProvider) {
            this._modeProvider = new ContextProvider(this, {
                context: modeContext,
                initialValue: this._modeState,
            });
        }
        if (!this._uiProvider) {
            this._uiProvider = new ContextProvider(this, {
                context: uiContext,
                initialValue: this._uiState,
            });
        }

        // Start the router and listen for route changes
        router.start();
        this._handleRouteChange = this._handleRouteChange.bind(this);
        /** @type {(e: Event) => void} */
        this._boundRouteChange = (e) => {
            void this._handleRouteChange(
                /** @type {CustomEvent<import("../utils/router.js").RouteChangeDetail>} */ (e),
            );
        };
        window.addEventListener("route-changed", this._boundRouteChange);

        const phoneMql = window.matchMedia("(max-width: 767px)");
        const tabletMql = window.matchMedia("(min-width: 768px) and (max-width: 1024px)");

        const updateBreakpoint = () => {
            /** @type {"phone" | "tablet" | "desktop"} */
            let bp;
            if (phoneMql.matches) {
                bp = "phone";
            } else if (tabletMql.matches) {
                bp = "tablet";
            } else {
                bp = "desktop";
            }
            const newState = this._uiStore.setBreakpoint(this._uiState, bp);
            if (bp === "phone" && this._uiState.sidebarExpanded) {
                newState.sidebarExpanded = false;
            }
            if (bp === "tablet" && this._uiState.sidebarExpanded) {
                newState.sidebarExpanded = false;
            }
            if (bp === "desktop" && !this._uiState.sidebarExpanded) {
                newState.sidebarExpanded = true;
            }
            this._updateUIState(newState);
        };
        updateBreakpoint();
        phoneMql.addEventListener("change", updateBreakpoint);
        tabletMql.addEventListener("change", updateBreakpoint);

        this._phoneMql = phoneMql;
        this._tabletMql = tabletMql;
        this._updateBreakpoint = updateBreakpoint;

        if (window.visualViewport) {
            const vv = window.visualViewport;
            this._onVvResize = () => {
                this.style.height = `${vv.height}px`;
            };
            vv.addEventListener("resize", this._onVvResize);
            this._onVvResize();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._boundRouteChange) {
            window.removeEventListener("route-changed", this._boundRouteChange);
        }
        if (this._phoneMql && this._updateBreakpoint) {
            this._phoneMql.removeEventListener("change", this._updateBreakpoint);
        }
        if (this._tabletMql && this._updateBreakpoint) {
            this._tabletMql.removeEventListener("change", this._updateBreakpoint);
        }
        if (this._onVvResize) {
            window.visualViewport?.removeEventListener("resize", this._onVvResize);
        }
    }

    /**
     * @param {import("../stores/conversation-store.js").ConversationState} state
     */
    _updateConvState(state) {
        this._convState = state;
        if (this._convProvider) {
            this._convProvider.setValue(state);
        }
    }

    /**
     * @param {import("../stores/messages-store.js").MessagesState} state
     */
    _updateMsgState(state) {
        this._msgState = state;
        if (this._msgProvider) {
            this._msgProvider.setValue(state);
        }
    }

    /**
     * @param {import("../stores/mode-store.js").ModeState} state
     */
    _updateModeState(state) {
        this._modeState = state;
        if (this._modeProvider) {
            this._modeProvider.setValue(state);
        }
    }

    /**
     * @param {import("../stores/ui-store.js").UIState} state
     */
    _updateUIState(state) {
        this._uiState = state;
        if (this._uiProvider) {
            this._uiProvider.setValue(state);
        }
    }

    async firstUpdated() {
        try {
            // Set mode from user
            if (this.user) {
                const newMode = this.user.mode;
                this._updateModeState({ mode: newMode });
            }

            // Fetch conversations
            const conversations = await this._convStore.fetchConversations();
            let activeId = "";

            // Check URL for conversation ID (deep link support)
            const routeParams = router.getCurrentParams();
            if (routeParams?.conversationId) {
                const urlConv = conversations.find((c) => c.id === routeParams.conversationId);
                if (urlConv) {
                    activeId = routeParams.conversationId;
                }
            }

            // Fall back to first conversation if URL has no valid ID.
            // Navigate to reflect the active conversation in the URL — data flows
            // from URL to state, so the URL must always match the active conversation.
            if (!activeId && conversations.length > 0) {
                activeId = conversations[0].id;
                router.navigate(`/conversations/${activeId}`, { replace: true });
            }

            this._updateConvState({
                conversations,
                activeConversationId: activeId,
                loading: true,
                loadingConversationId: "",
            });

            // Fetch messages for the active conversation
            if (activeId) {
                const messages = await this._msgStore.fetchMessages(activeId);
                this._updateMsgState({ messages, responding: false });
            }

            this._updateConvState({
                conversations,
                activeConversationId: activeId,
                loading: false,
            });

            // Transition to appropriate view state after initial load
            if (conversations.length > 0) {
                this._viewState = "conversation";
            } else {
                this._viewState = "landing";
            }
        } catch {
            this._viewState = "landing";
        }
    }

    render() {
        return html`
            <div class="app" data-mode=${this._modeState.mode}>
                ${this._uiState.breakpoint === "phone" && this._uiState.sidebarExpanded
                    ? html`<div class="sidebar-backdrop" @click=${this.handleCloseSidebar}></div>`
                    : nothing}
                <chat-sidebar
                    .user=${this.user}
                    @new-chat=${this.handleNewChat}
                    @select-conversation=${this.handleSelectConversation}
                    @toggle-sidebar=${this.handleSidebarToggle}
                    @logout=${this.handleLogout}
                    @open-settings=${() => {
                        this._updateUIState(this._uiStore.openSettings(this._uiState));
                    }}
                ></chat-sidebar>
                <main class="main">
                    <div class="view-layer ${this.isLanding ? "active" : ""}">
                        <landing-view
                            .submitting=${this._landingSubmitting}
                            @landing-submit=${this.handleLandingSubmit}
                            @mode-change=${this.handleModeChange}
                            @toggle-sidebar=${this.handleSidebarToggle}
                            @new-chat=${this.handleNewChat}
                        ></landing-view>
                    </div>
                    <div class="view-layer ${!this.isLanding ? "active" : ""}">
                        <chat-view
                            @mode-change=${this.handleModeChange}
                            @send-message=${this.handleSendMessage}
                            @stop-message=${this.handleStopMessage}
                            @toggle-sidebar=${this.handleSidebarToggle}
                            @new-chat=${this.handleNewChat}
                        ></chat-view>
                    </div>
                </main>
            </div>
            <settings-dialog
                .user=${this.user}
                @settings-closed=${() => {
                    this._updateUIState(this._uiStore.closeSettings(this._uiState));
                }}
                @settings-updated=${this.handleSettingsUpdated}
                @account-deleted=${this.handleAccountDeleted}
            ></settings-dialog>
        `;
    }

    async handleNewChat() {
        if (this._uiState.breakpoint === "phone" && this._uiState.sidebarExpanded) {
            this._updateUIState({ ...this._uiState, sidebarExpanded: false });
        }
        this._prevViewState = this._viewState;
        this._viewState = "landing";
        this._isNewChat = true;
        router.navigate("/", { replace: true });
        this._updateConvState({
            conversations: this._convState.conversations,
            activeConversationId: "__new__",
            loading: false,
        });
        this._updateMsgState({ messages: [], responding: false });

        // Focus the input by dispatching select-conversation event
        document.dispatchEvent(
            new CustomEvent("select-conversation", { detail: { id: "__new__" } }),
        );
    }

    /**
     * @param {CustomEvent<{ id: string }>} e
     * @param {{ navigate?: "push" | "replace" | false }} [opts]
     */
    async handleSelectConversation(e, opts) {
        const convId = e.detail.id;

        // Clear ephemeral new chat state if switching away
        if (this._isNewChat && convId !== "__new__") {
            this._isNewChat = false;
        }

        // Save previous view for crossfade transition
        this._prevViewState = this._viewState;

        // Transition to conversation view if needed
        if (this._viewState === "landing") {
            this._viewState = "conversation";
        }

        // Set loading state BEFORE fetch and view transition
        this._updateConvState({ ...this._convState, loadingConversationId: convId });
        this._updateConvState({ ...this._convState, activeConversationId: convId });

        // Update URL BEFORE await - networkidle waits for this in tests
        const navigate = opts?.navigate ?? "push";
        if (navigate === "replace") {
            router.navigate(`/conversations/${convId}`, { replace: true });
        } else if (navigate !== false) {
            router.navigate(`/conversations/${convId}`);
        }

        // Use View Transition API for smooth crossfade, fallback for testing
        let transition;
        if (document.startViewTransition) {
            transition = document.startViewTransition(async () => {
                const msgs = await this._msgStore.fetchMessages(convId);

                // Update messages - this becomes the "new" state for the transition
                this._updateMsgState({ messages: msgs, responding: false });
            });
        } else {
            // Fallback for testing (happy-dom doesn't support View Transition API)
            const msgs = await this._msgStore.fetchMessages(convId);
            this._updateMsgState({ messages: msgs, responding: false });
        }

        // Wait for transition to complete if available
        if (transition) {
            await transition.finished;
        }

        // Clear loading state
        this._updateConvState({ ...this._convState, loadingConversationId: "" });
    }

    /**
     * Handles route-changed events from the router.
     * Triggered by popstate (back/forward) and direct URL loads.
     * Uses navigate: false to avoid creating duplicate history entries.
     * @param {CustomEvent<import("../utils/router.js").RouteChangeDetail>} e
     */
    async _handleRouteChange(e) {
        // Guard: skip if component hasn't finished initial load
        // (firstUpdated handles the initial URL hydration)
        if (this._convState.loading) {
            return;
        }

        const { params } = e.detail;
        if (
            params.conversationId &&
            params.conversationId !== this._convState.activeConversationId
        ) {
            this._routeParams = params;
            // Pass navigate: false — browser already changed the URL (popstate)
            await this.handleSelectConversation(
                new CustomEvent("select-conversation", {
                    detail: { id: params.conversationId },
                }),
                { navigate: false },
            );
        }
    }

    /**
     * @param {CustomEvent<{ mode: Mode }>} e
     */
    handleModeChange(e) {
        const newState = this._modeStore.setMode(e.detail.mode);
        this._updateModeState(newState);
    }

    /**
     * @param {CustomEvent<{ text: string }>} e
     */
    async handleSendMessage(e) {
        // Handle ephemeral new chat state
        if (this._isNewChat) {
            await this._handleFirstMessage(e.detail.text);
            return;
        }

        const newResponding = { messages: this._msgState.messages, responding: true };
        this._updateMsgState(newResponding);
        const controller = new AbortController();
        this._currentAssistantController = controller;

        try {
            const res = await client.api.conversations[":id"].messages.$post(
                {
                    param: { id: this._convState.activeConversationId },
                    json: { content: e.detail.text, mode: this._modeState.mode },
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

            /** @type {import("../../shared/types.js").Message | null} */
            let userMessage = null;
            /** @type {import("../../shared/types.js").AssistantMessage | null} */
            let assistantMessage = null;
            let assistantMessageAdded = false;
            let messages = this._msgState.messages;

            for await (const event of this._msgStore.parseSSEStream(body)) {
                if (event.type === "userMessage") {
                    userMessage = event.data;
                    messages = [...messages, userMessage];
                    this._updateMsgState({ messages, responding: true });
                } else if (event.type === "assistantChunk") {
                    if (!assistantMessage) {
                        assistantMessage = {
                            id: "temp-assistant-" + Date.now(),
                            role: "assistant",
                            blocks: [],
                            mode: this._modeState.mode,
                            conversationId: this._convState.activeConversationId,
                            content: null,
                            createdAt: new Date().toISOString(),
                        };
                    }
                    assistantMessage = {
                        ...assistantMessage,
                        blocks: [...(assistantMessage?.blocks ?? []), event.data],
                    };

                    if (!assistantMessageAdded) {
                        messages = [...messages, assistantMessage];
                        assistantMessageAdded = true;
                    } else {
                        messages = [...messages.slice(0, -1), assistantMessage];
                    }
                    this._updateMsgState({ messages, responding: true });
                } else if (event.type === "assistantComplete") {
                    assistantMessage = event.data;
                    if (!assistantMessageAdded) {
                        messages = [...messages, assistantMessage];
                        assistantMessageAdded = true;
                    } else {
                        messages = [...messages.slice(0, -1), assistantMessage];
                    }
                    this._updateMsgState({ messages, responding: true });
                }
            }
        } catch (err) {
            if (Error.isError(err) && err.name !== "AbortError") {
                // Ignore error
            }
        } finally {
            this._updateMsgState({ messages: this._msgState.messages, responding: false });
            this._currentAssistantController = null;
        }
    }

    /**
     * Handles the first message in ephemeral new chat state.
     * Sends to existing messages endpoint with "__new__" ID, server creates
     * conversation and sends it via SSE before the response.
     * @param {string} text - The message text
     */
    async _handleFirstMessage(text) {
        this._isNewChat = false;

        const newResponding = { messages: [], responding: true };
        this._updateMsgState(newResponding);
        const controller = new AbortController();
        this._currentAssistantController = controller;

        /** @type {import("../../shared/types.js").Conversation | null} */
        let newConversation = null;
        /** @type {import("../../shared/types.js").Message | null} */
        let userMessage = null;
        /** @type {import("../../shared/types.js").AssistantMessage | null} */
        let assistantMessage = null;
        let assistantMessageAdded = false;
        /** @type {import("../../shared/types.js").Message[]} */
        let messages = [];

        try {
            // Use existing messages endpoint with "__new__" as conversation ID
            const res = await client.api.conversations[":id"].messages.$post(
                {
                    param: { id: "__new__" },
                    json: { content: text, mode: this._modeState.mode },
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

            for await (const event of this._msgStore.parseSSEStream(body)) {
                if (event.type === "conversation") {
                    newConversation = event.data;
                    const newConversations = [newConversation, ...this._convState.conversations];
                    this._updateConvState({
                        conversations: newConversations,
                        activeConversationId: newConversation.id,
                        loading: false,
                    });
                    router.navigate(`/conversations/${newConversation.id}`, {
                        replace: true,
                    });
                } else if (event.type === "userMessage") {
                    userMessage = event.data;
                    messages = [...messages, userMessage];
                    this._updateMsgState({ messages, responding: true });
                } else if (event.type === "assistantChunk") {
                    if (!assistantMessage) {
                        assistantMessage = {
                            id: "temp-assistant-" + Date.now(),
                            role: "assistant",
                            blocks: [],
                            mode: this._modeState.mode,
                            conversationId: newConversation?.id ?? "",
                            content: null,
                            createdAt: new Date().toISOString(),
                        };
                    }
                    assistantMessage = {
                        ...assistantMessage,
                        blocks: [...(assistantMessage?.blocks ?? []), event.data],
                    };

                    if (!assistantMessageAdded) {
                        messages = [...messages, assistantMessage];
                        assistantMessageAdded = true;
                    } else {
                        messages = [...messages.slice(0, -1), assistantMessage];
                    }
                    this._updateMsgState({ messages, responding: true });
                } else if (event.type === "assistantComplete") {
                    assistantMessage = event.data;
                    if (!assistantMessageAdded) {
                        messages = [...messages, assistantMessage];
                        assistantMessageAdded = true;
                    } else {
                        messages = [...messages.slice(0, -1), assistantMessage];
                    }
                    this._updateMsgState({ messages, responding: true });
                }
            }
        } catch (err) {
            if (Error.isError(err) && err.name !== "AbortError") {
                // Ignore error
            }
        } finally {
            this._updateMsgState({ messages: this._msgState.messages, responding: false });
            this._currentAssistantController = null;
        }
    }

    handleStopMessage() {
        this._currentAssistantController?.abort();
    }

    focusChatInput() {
        const chatInput = /** @type {{ focus: () => void } | null} */ (
            this.shadowRoot?.querySelector("chat-input")
        );
        if (chatInput?.focus) {
            chatInput.focus();
        }
    }

    /**
     * @param {CustomEvent<{ expanded: boolean }>} e
     */
    handleSidebarToggle(e) {
        const expanded = e.detail?.expanded ?? !this._uiState.sidebarExpanded;
        this._updateUIState({ ...this._uiState, sidebarExpanded: expanded });
    }

    handleCloseSidebar() {
        this._updateUIState({ ...this._uiState, sidebarExpanded: false });
    }

    async handleLogout() {
        // Reset URL to landing before logout — prevents blank screen from
        // staying on a conversation URL when logged-out user has no access.
        router.navigate("/", { replace: true });
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
        this._updateModeState({ mode: this.user.mode });
    }

    async handleAccountDeleted() {
        router.navigate("/", { replace: true });
        await logout();
        this.dispatchEvent(
            new CustomEvent("user-logged-out", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    /**
     * @param {CustomEvent<{ text: string }>} e
     */
    async handleLandingSubmit(e) {
        const text = e.detail.text;
        this._landingSubmitting = true;
        this._prevViewState = this._viewState;
        this._viewState = "conversation";

        /** @type {string} */
        let targetConvId = this._convState.activeConversationId;

        try {
            if (
                this._convState.activeConversationId === "__new__" ||
                this._convState.conversations.length === 0
            ) {
                /** @type {Promise<void> | { finished: Promise<void> } | undefined} */
                let transition;
                if (document.startViewTransition) {
                    transition = document.startViewTransition(async () => {
                        const conv = await this._convStore.createConversation(text.slice(0, 80));
                        const newConversations = [conv, ...this._convState.conversations];
                        targetConvId = conv.id;
                        this._updateConvState({
                            conversations: newConversations,
                            activeConversationId: conv.id,
                            loading: false,
                        });
                        const msgs = await this._msgStore.fetchMessages(conv.id);

                        this._updateMsgState({ messages: msgs, responding: false });

                        router.navigate(`/conversations/${conv.id}`, { replace: true });

                        this.dispatchEvent(
                            new CustomEvent("conversations-updated", {
                                bubbles: true,
                                composed: true,
                            }),
                        );
                    });
                } else {
                    const conv = await this._convStore.createConversation(text.slice(0, 80));
                    const newConversations = [conv, ...this._convState.conversations];
                    targetConvId = conv.id;
                    this._updateConvState({
                        conversations: newConversations,
                        activeConversationId: conv.id,
                        loading: false,
                    });
                    const msgs = await this._msgStore.fetchMessages(conv.id);

                    this._updateMsgState({ messages: msgs, responding: false });
                    router.navigate(`/conversations/${conv.id}`, { replace: true });

                    this.dispatchEvent(
                        new CustomEvent("conversations-updated", {
                            bubbles: true,
                            composed: true,
                        }),
                    );
                }

                if (transition) {
                    if ("finished" in transition) {
                        await transition.finished;
                    } else {
                        await transition;
                    }
                }

                await this.updateComplete;
                this.focusChatInput();
            }

            const newResponding = { messages: this._msgState.messages, responding: true };
            this._updateMsgState(newResponding);
            const controller = new AbortController();
            this._currentAssistantController = controller;

            try {
                const msgRes = await client.api.conversations[":id"].messages.$post(
                    {
                        param: { id: targetConvId },
                        json: { content: text, mode: this._modeState.mode },
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

                /** @type {import("../../shared/types.js").Message | null} */
                let userMessage = null;
                /** @type {import("../../shared/types.js").AssistantMessage | null} */
                let assistantMessage = null;
                let assistantMessageAdded = false;
                let messages = this._msgState.messages;

                for await (const event of this._msgStore.parseSSEStream(body)) {
                    if (event.type === "userMessage") {
                        userMessage = event.data;
                        messages = [...messages, userMessage];
                        this._updateMsgState({ messages, responding: true });
                    } else if (event.type === "assistantChunk") {
                        if (!assistantMessage) {
                            assistantMessage = {
                                id: "temp-assistant-" + Date.now(),
                                role: "assistant",
                                blocks: [],
                                mode: this._modeState.mode,
                                conversationId: targetConvId,
                                content: null,
                                createdAt: new Date().toISOString(),
                            };
                        }
                        assistantMessage = {
                            ...assistantMessage,
                            blocks: [...(assistantMessage?.blocks ?? []), event.data],
                        };

                        if (!assistantMessageAdded) {
                            messages = [...messages, assistantMessage];
                            assistantMessageAdded = true;
                        } else {
                            messages = [...messages.slice(0, -1), assistantMessage];
                        }
                        this._updateMsgState({ messages, responding: true });
                    } else if (event.type === "assistantComplete") {
                        assistantMessage = event.data;
                        if (!assistantMessageAdded) {
                            messages = [...messages, assistantMessage];
                            assistantMessageAdded = true;
                        } else {
                            messages = [...messages.slice(0, -1), assistantMessage];
                        }
                        this._updateMsgState({ messages, responding: true });
                    }
                }
            } catch (err) {
                if (Error.isError(err) && err.name !== "AbortError") {
                    // Ignore error
                }
            } finally {
                this._updateMsgState({ messages: this._msgState.messages, responding: false });
                this._currentAssistantController = null;
            }
        } catch {
            // Error creating conversation or posting message — _landingSubmitting reset in finally
        } finally {
            this._landingSubmitting = false;
        }
    }
}

customElement("main-page")(MainPage);
export { MainPage };
