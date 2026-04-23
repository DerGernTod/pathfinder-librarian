import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/icon/icon.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/textarea/textarea.js?deps=lit@3.3.2";
import { LitElement } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

/**
 * @template T
 * @typedef {InputEvent & { currentTarget: T }} TargetedInputEvent
 */

class ChatInput extends LitElement {
    static properties = {
        value: { type: String },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.value = "";
    }

    render() {
        return html`
            <div class="p-4 border-t border-border">
                <div class="flex items-end gap-2 max-w-4xl mx-auto">
                    <sl-textarea
                        .value=${this.value}
                        @sl-input=${this.handleInput}
                        @keydown=${this.handleKeydown}
                        placeholder="Ask about rules, lore, or mechanics..."
                        resize="auto"
                        rows="1"
                        class="flex-1"
                    ></sl-textarea>
                    <button
                        @click=${this.handleSubmit}
                        class="bg-primary text-primary-foreground rounded-lg p-2 hover:opacity-90 transition mb-0.5"
                    >
                        <sl-icon name="arrow-right" class="w-4 h-4"></sl-icon>
                    </button>
                </div>
                <p class="text-xs text-muted-foreground text-center mt-2">
                    Pathfinder Librarian can make mistakes. Verify critical mechanics with the PRD.
                </p>
            </div>
        `;
    }

    /**
     * @param {TargetedInputEvent<HTMLTextAreaElement>} e
     */
    handleInput(e) {
        this.value = e.currentTarget.value;
    }

    /**
     * @param {KeyboardEvent} e
     */
    handleKeydown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this.handleSubmit();
        }
    }

    handleSubmit() {
        const text = this.value.trim();
        if (!text) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent("send-message", { detail: { text }, bubbles: true, composed: true }),
        );
        this.value = "";
    }
}

const element = customElement("chat-input")(ChatInput);
export { element as ChatInput };
