import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";

/**
 * @customElement landing-view
 * @property {boolean} submitting - When true, disables the input and button to prevent double-submission.
 * @fires landing-submit - Fired when the user submits a prompt. Detail: { text: string }
 */
class LandingView extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                flex: 1;
                display: flex;
            }
            .landing-welcome {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                max-width: 40rem;
                margin: 0 auto;
                width: 100%;
            }
            .landing-welcome h1 {
                font-size: 1.875rem;
                font-weight: 700;
                margin-bottom: 0.5rem;
            }
            .landing-welcome p {
                color: var(--muted-foreground);
                font-size: 1rem;
                margin-bottom: 2rem;
            }
            .landing-input-row {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                width: 100%;
                max-width: 36rem;
                background: var(--secondary);
                border-radius: 0.75rem;
                border: 1px solid var(--border);
                padding: 0.75rem 1rem;
            }
            .landing-input-row:focus-within {
                outline: none;
                box-shadow: 0 0 0 1px var(--accent);
            }
            .landing-prompt {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                font-size: 1.125rem;
                line-height: 1.5rem;
                color: var(--foreground);
            }
            .landing-prompt::placeholder {
                color: var(--muted-foreground);
            }
            .landing-send-btn {
                color: white;
                border-radius: 0.5rem;
                padding: 0.5rem 1rem;
                border: none;
                cursor: pointer;
                background: var(--accent);
                font-size: 0.875rem;
            }
            .landing-send-btn:hover {
                opacity: 0.9;
            }
            .landing-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .landing-hint {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                margin-top: 0.75rem;
            }
            :focus-visible {
                outline: 2px solid var(--accent);
                outline-offset: 2px;
            }
        `,
    ];

    static properties = {
        submitting: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {boolean} */
        this.submitting = false;
        /** @type {string} */
        this._text = "";
    }

    render() {
        return html`
            <section role="region" aria-label="Welcome" class="landing-welcome">
                <h1>Pathfinder Librarian</h1>
                <p>Ask about rules, lore, or mechanics...</p>
                <div class="landing-input-row">
                    <input
                        aria-label="Type your first prompt"
                        data-test="landing-input"
                        class="landing-prompt"
                        .value=${this._text}
                        ?disabled=${this.submitting}
                        @input=${this._handleInput}
                        @keydown=${this._handleKeydown}
                        placeholder="e.g. How does flanking work?"
                    />
                    <button
                        aria-label="Send prompt"
                        class="landing-send-btn"
                        data-test="landing-send"
                        ?disabled=${this.submitting}
                        @click=${this._handleSubmit}
                    >
                        Send
                    </button>
                </div>
                <p class="landing-hint">Press Enter to send</p>
            </section>
        `;
    }

    /**
     * @param {InputEvent & { currentTarget: HTMLInputElement }} e
     */
    _handleInput(e) {
        this._text = e.currentTarget.value;
    }

    /**
     * @param {KeyboardEvent} e
     */
    _handleKeydown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this._handleSubmit();
        }
    }

    _handleSubmit() {
        if (this.submitting) {
            return;
        }
        const text = this._text.trim();
        if (!text) {
            return;
        }

        this.dispatchEvent(
            new CustomEvent("landing-submit", {
                detail: { text },
                bubbles: true,
                composed: true,
            }),
        );
        this._text = "";
    }
}

customElement("landing-view")(LandingView);
export { LandingView };
