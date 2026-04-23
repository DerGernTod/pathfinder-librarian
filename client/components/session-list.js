import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/input/input.js?deps=lit@3.3.2";
import { LitElement } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */

class SessionList extends LitElement {
    static properties = {
        conversations: { type: Array },
        activeId: { type: String },
        query: { type: String },
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
        /** @type {string} */
        this.query = "";
    }

    render() {
        const filtered = this.query
            ? this.conversations.filter((c) =>
                  c.title.toLowerCase().includes(this.query.toLowerCase()),
              )
            : this.conversations;

        return html`
            <div class="sidebar-search h-full overflow-y-auto space-y-1">
                <p class="text-xs text-muted-foreground font-medium px-2 py-1">Recent</p>
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
                        <div
                            @click=${() => this.handleSelect(conv.id)}
                            class="rounded-md px-3 py-2 text-sm ${conv.id === this.activeId
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"} transition truncate cursor-pointer"
                        >
                            ${conv.title}
                        </div>
                    `,
                )}
            </div>
        `;
    }

    /**
     * @param {Event} e
     */
    handleSearch(e) {
        this.query = e.target.value;
    }

    /**
     * @param {string} id
     */
    handleSelect(id) {
        this.dispatchEvent(
            new CustomEvent("select-conversation", {
                detail: { id },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

const element = customElement("session-list")(SessionList);
export { element as SessionList };
