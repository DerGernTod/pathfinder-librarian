import "./chat-header.js";
import "./chat-input.js";
import "./message-list.js";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/** @typedef {import("../../shared/types.js").Message} Message */
/** @typedef {import("../../shared/types.js").Mode} Mode */

/**
 * @customElement chat-view
 * @property {Mode} mode - Current mode (gm or player).
 * @property {Message[]} messages - Messages to display in the message list.
 * @property {boolean} loading - Whether data is still loading or assistant is responding.
 * @property {boolean} responding - Whether the assistant is currently generating a response.
 * @fires mode-change - Bubbled from chat-header.
 * @fires send-message - Bubbled from chat-input.
 * @fires stop-message - Bubbled from chat-input.
 */
class ChatView extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                display: flex;
                flex: 1;
                flex-direction: column;
                min-height: 0;
            }
        `,
    ];

    static properties = {
        mode: { type: String },
        messages: { type: Array },
        loading: { type: Boolean },
        responding: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {Mode} */
        this.mode = "player";
        /** @type {Message[]} */
        this.messages = [];
        /** @type {boolean} */
        this.loading = false;
        /** @type {boolean} */
        this.responding = false;
    }

    render() {
        return html`
            <chat-header .mode=${this.mode}></chat-header>
            <message-list .messages=${this.messages} .loading=${this.loading}></message-list>
            <chat-input
                .mode=${this.mode}
                .responding=${this.responding}
            ></chat-input>
        `;
    }
}

customElement("chat-view")(ChatView);
export { ChatView };
