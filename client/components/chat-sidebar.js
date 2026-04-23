import "./new-chat-button.js";
import "./session-list.js";
import "./sidebar-profile.js";
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
                transition: border-color 0.5s ease;
            }
            .content {
                flex: 1;
                min-height: 0;
                overflow: hidden;
            }
        `,
    ];

    static properties = {
        conversations: { type: Array },
        activeId: { type: String },
        mode: { type: String },
    };

    constructor() {
        super();
        /** @type {Conversation[]} */
        this.conversations = [];
        /** @type {string} */
        this.activeId = "";
        /** @type {Mode} */
        this.mode = "gm";
    }

    render() {
        return html`
            <aside class="sidebar">
                <new-chat-button @new-chat=${this.handleNewChat}></new-chat-button>
                <div class="content">
                    <session-list
                        .mode=${this.mode}
                        .conversations=${this.conversations}
                        .activeId=${this.activeId}
                        @select-conversation=${this.handleSelectConversation}
                    ></session-list>
                </div>
                <sidebar-profile
                    .mode=${this.mode}
                    name="Game Master 01"
                    subtitle="PF2e Remaster Rules"
                    initials="GM"
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
}

const element = customElement("chat-sidebar")(ChatSidebar);
export { element as ChatSidebar };
