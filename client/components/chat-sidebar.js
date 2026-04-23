import "./new-chat-button.js";
import "./session-list.js";
import "./sidebar-profile.js";
import { LitElement } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */

class ChatSidebar extends LitElement {
    static properties = {
        conversations: { type: Array },
        activeId: { type: String },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        /** @type {Conversation[]} */
        this.conversations = [];
        /** @type {string} */
        this.activeId = "";
    }

    render() {
        return html`
            <aside
                class="w-64 bg-secondary border-r border-border flex flex-col p-4 gap-4 shrink-0 h-full"
            >
                <new-chat-button @new-chat=${this.handleNewChat}></new-chat-button>
                <div class="flex-1 min-h-0 overflow-hidden">
                    <session-list
                        .conversations=${this.conversations}
                        .activeId=${this.activeId}
                        @select-conversation=${this.handleSelectConversation}
                    ></session-list>
                </div>
                <sidebar-profile
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
