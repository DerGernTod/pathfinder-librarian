/** @typedef {import("../../shared/types.js").Mode} Mode */

import { LitElement } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

class ChatHeader extends LitElement {
    static properties = {
        mode: { type: String },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        /** @type {Mode} */
        this.mode = "player";
    }

    render() {
        return html`
            <header
                class="h-14 border-b border-border flex items-center justify-between px-6 shrink-0"
            >
                <div class="flex items-center gap-2">
                    <span
                        class="text-lg font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
                    >
                        Pathfinder 2e
                    </span>
                    <span class="text-sm text-muted-foreground">Rules Assistant</span>
                </div>
                <div
                    class="flex items-center gap-3 bg-secondary rounded-lg p-1 border border-border"
                >
                    <button
                        @click=${() => this.setMode("player")}
                        class="px-3 py-1.5 text-xs font-medium rounded-md ${this.mode === "player"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"} transition"
                    >
                        ⚔️ Player Mode
                    </button>
                    <button
                        @click=${() => this.setMode("gm")}
                        class="px-3 py-1.5 text-xs font-medium rounded-md ${this.mode === "gm"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"} transition"
                    >
                        📜 GM Mode
                    </button>
                </div>
            </header>
        `;
    }

    /**
     * @param {Mode} mode
     */
    setMode(mode) {
        this.mode = mode;
        this.dispatchEvent(
            new CustomEvent("mode-change", { detail: { mode }, bubbles: true, composed: true }),
        );
    }
}

const element = customElement("chat-header")(ChatHeader);
export { element as ChatHeader };
