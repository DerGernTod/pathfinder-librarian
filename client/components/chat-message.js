import "./user-message.js";
import "./assistant-message.js";
import { LitElement, css } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

/** @typedef {import("../../shared/types.js").Message} Message */

/**
 * @customElement chat-message
 * @property {Message} message - The message to display, either from the user or the assistant.
 */
class ChatMessage extends LitElement {
    static styles = css`
        :host {
            display: block;
        }
    `;

    static properties = {
        message: { type: Object },
    };

    constructor() {
        super();
        /** @type {Message | undefined} */
        this.message = undefined;
    }

    render() {
        if (!this.message) {
            return nothing;
        }
        return this.message.role === "user"
            ? html`<user-message .message=${this.message}></user-message>`
            : html`<assistant-message .message=${this.message}></assistant-message>`;
    }
}

const element = customElement("chat-message")(ChatMessage);
export { element as ChatMessage };
