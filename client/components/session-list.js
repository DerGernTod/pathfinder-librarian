// @ts-expect-error Side-effect import from esm.sh has no type declarations
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/input/input.js?deps=lit@3.3.2";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */

/**
 * @template T
 * @typedef {InputEvent & { currentTarget: T }} TargetedInputEvent
 */

class SessionList extends LitElement {
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
            .session-item {
                border-radius: 0.375rem;
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                color: var(--muted-foreground);
                line-height: 1.25rem;
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                transition:
                    all var(--transition-speed),
                    background-color var(--accent-transition-speed);
            }
            .session-item:hover,
            .session-item.active {
                background: var(--accent);
                color: var(--secondary-foreground);
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
        conversations: { type: Array },
        activeId: { type: String },
        query: { type: String },
    };

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
                        <div
                            @click=${() => this.handleSelect(conv.id)}
                            class="session-item ${conv.id === this.activeId ? "active" : ""}"
                        >
                            ${conv.title}
                        </div>
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
