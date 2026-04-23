import { LitElement } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

class NewChatButton extends LitElement {
    createRenderRoot() {
        return this;
    }

    render() {
        return html`
            <button
                @click=${this.handleClick}
                class="flex items-center justify-center gap-2 w-full rounded-md border border-dashed border-muted-foreground/50 p-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                    />
                </svg>
                New Chat
            </button>
        `;
    }

    handleClick() {
        this.dispatchEvent(new CustomEvent("new-chat", { bubbles: true, composed: true }));
    }
}

const element = customElement("new-chat-button")(NewChatButton);
export { element as NewChatButton };
