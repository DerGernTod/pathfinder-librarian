import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/textarea/textarea.js?deps=lit@3.3.2";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/**
 * @template T
 * @typedef {InputEvent & { currentTarget: T }} TargetedInputEvent
 */

/** @typedef {import("../../shared/types.js").Mode} Mode */

class ChatInput extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            .wrapper {
                padding: 1rem;
                border-top: 1px solid var(--border);
            }
            .input-row {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                max-width: 56rem;
                margin: 0 auto;
                background: var(--secondary);
                border-radius: 0.75rem;
                border: 1px solid var(--border);
                padding: 0.5rem 1rem;
                transition: box-shadow 0.5s ease;
            }
            .input-row:focus-within {
                outline: none;
                box-shadow: 0 0 0 1px var(--accent);
            }
            .textarea-flex {
                flex: 1;
            }
            sl-textarea::part(base) {
                background: transparent;
                border: none;
                box-shadow: none;
            }
            sl-textarea::part(textarea) {
                background: transparent;
                font-size: 0.875rem;
                line-height: 1.25rem;
                padding: 0;
                color: var(--foreground);
            }
            sl-textarea::part(textarea)::placeholder {
                color: var(--muted-foreground);
            }
            .send-btn {
                color: white;
                border-radius: 0.5rem;
                padding: 0.5rem;
                border: none;
                cursor: pointer;
                background: var(--accent);
                transition: opacity var(--transition-speed), background-color var(--accent-transition-speed);
            }
            .send-btn:hover {
                opacity: 0.9;
            }
            .send-icon {
                width: 1rem;
                height: 1rem;
                display: block;
            }
            .disclaimer {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                text-align: center;
                margin-top: 0.5rem;
                line-height: 1rem;
            }
        `,
    ];

    static properties = {
        value: { type: String },
        mode: { type: String },
    };

    constructor() {
        super();
        this.value = "";
        /** @type {Mode} */
        this.mode = "gm";
    }

    render() {
        return html`
            <div class="wrapper">
                <div class="input-row" data-mode=${this.mode}>
                    <sl-textarea
                        .value=${this.value}
                        @sl-input=${this.handleInput}
                        @keydown=${this.handleKeydown}
                        placeholder="Ask about rules, lore, or mechanics..."
                        resize="auto"
                        rows="1"
                        class="textarea-flex"
                    ></sl-textarea>
                    <button @click=${this.handleSubmit} class="send-btn">
                        <svg
                            class="send-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 12h14M12 5l7 7-7 7"
                            />
                        </svg>
                    </button>
                </div>
                <p class="disclaimer">
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
