import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/input/input.js?deps=lit@3.3.2";
import "./conversation-item.js";
import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { conversationContext } from "../stores/conversation-store.js";
import { uiContext } from "../stores/ui-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { getCachedConversationIds } from "../utils/conversation-cache.js";
import { BaseElement } from "./base-element.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */

/**
 * @template T
 * @typedef {InputEvent & { currentTarget: T }} TargetedInputEvent
 */

/**
 * @customElement session-list
 * @property {string} query - The current search query for filtering conversations.
 * @fires select-conversation - Fired when the user selects a conversation from the list, with the conversation ID in the event detail.
 */
class SessionList extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            .container {
                height: 100%;
                overflow-y: auto;
                overflow-x: hidden;
            }
            .container > * + * {
                margin-top: 0.25rem;
            }
            .label {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                font-weight: 500;
                padding: 0.25rem 0.5rem;
            }
            sl-input::part(base) {
                background: transparent;
                border: 1px solid var(--border);
                border-radius: 0.375rem;
            }
            sl-input::part(base):focus-within {
                border-color: var(--border-lighter);
                box-shadow: none;
            }
            sl-input::part(input) {
                font-size: 0.75rem;
            }
        `,
    ];

    static properties = {
        query: { type: String },
        _cachedIds: { type: Object, state: true },
    };

    constructor() {
        super();
        /** @type {string} */
        this.query = "";
        /** @type {Set<string>} */
        this._cachedIds = new Set();
        /** @type {import("../stores/conversation-store.js").ConversationState} */
        this._convState = {
            conversations: [],
            activeConversationId: "",
            loading: true,
            loadingConversationId: "",
        };
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
            context: uiContext,
            callback: /** @param {import("../stores/ui-store.js").UIState} v */ (v) => {
                this._uiState = v;
            },
            subscribe: true,
        });
        this.addEventListener("conversations-updated", () => {
            this.requestUpdate();
        });
    }

    /**
     * Async cache lookup MUST NOT happen in render() (Lit render is sync).
     * Trigger the lookup here and store on a reactive property; render reads
     * the property synchronously.
     * @param {Map<string, unknown>} changedProperties
     */
    willUpdate(changedProperties) {
        if (!changedProperties.has("_convState") && !changedProperties.has("_uiState")) {
            return;
        }
        const online = this._uiState.online !== false;
        const ids = this._convState.conversations.map((c) => c.id);
        if (online) {
            // Online → everything enabled (avoid Cache API entirely).
            this._cachedIds = new Set(ids);
            return;
        }
        // Fire-and-forget; the assignment triggers a second render with the
        // correct disabled set when the lookup resolves.
        void getCachedConversationIds(ids).then((set) => {
            this._cachedIds = set;
        });
    }

    render() {
        const offline = this._uiState.online === false;
        const activeId = this._convState.activeConversationId;
        const filtered = this.query
            ? this._convState.conversations.filter((c) =>
                  c.title.toLowerCase().includes(this.query.toLowerCase()),
              )
            : this._convState.conversations;

        return html`
            <div class="container">
                <p class="label">Recent</p>
                <sl-input
                    .value=${this.query}
                    @sl-input=${this.handleSearch}
                    placeholder="Search conversations..."
                    size="small"
                    clearable
                    pill
                ></sl-input>
                ${filtered.map(
                    (conv) => html`
                        <conversation-item
                            .conversation=${conv}
                            .loading=${this._convState.loadingConversationId === conv.id}
                            .disabled=${offline &&
                            !this._cachedIds.has(conv.id) &&
                            conv.id !== activeId}
                            @select=${this.handleSelect}
                            data-test="session-item"
                        ></conversation-item>
                    `,
                )}
            </div>
        `;
    }

    /**
     * @param {TargetedInputEvent<HTMLInputElement>} e
     */
    handleSearch(e) {
        this.query = e.currentTarget.value;
    }

    /**
     * @param {CustomEvent<{ id: string }>} e
     */
    handleSelect(e) {
        this.dispatchEvent(
            new CustomEvent("select-conversation", {
                detail: { id: e.detail.id },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

const element = customElement("session-list")(SessionList);
export { element as SessionList };
