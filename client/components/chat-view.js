import "./chat-header.js";
import "./chat-input.js";
import "./message-list.js";
import { css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

/**
 * @customElement chat-view
 * @fires mode-change - Bubbled from chat-header.
 * @fires send-message - Bubbled from chat-input.
 * @fires stop-message - Bubbled from chat-input.
 */
class ChatView extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                display: flex;
                flex: 1;
                flex-direction: column;
                min-height: 0;
                overflow: hidden;
            }
        `,
    ];

    constructor() {
        super();
    }

    render() {
        return html`
            <chat-header></chat-header>
            <message-list></message-list>
            <chat-input></chat-input>
        `;
    }
}

customElement("chat-view")(ChatView);
export { ChatView };
