import "./stat-block.js";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/card/card.js?deps=lit@3.3.2";
import { LitElement } from "lit-element";
import { html, nothing } from "lit-html";
import { customElement } from "lit/decorators.js";

/** @typedef {import("../../shared/types.js").Message} Message */
/** @typedef {import("../../shared/types.js").UserMessage} UserMessage */
/** @typedef {import("../../shared/types.js").AssistantMessage} AssistantMessage */
/** @typedef {import("../../shared/types.js").MessageBlock} MessageBlock */
/** @typedef {import("../../shared/types.js").Segment} Segment */

class ChatMessage extends LitElement {
    static properties = {
        message: { type: Object },
    };

    createRenderRoot() {
        return this;
    }

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
            ? this.renderUserMessage(this.message)
            : this.renderAssistantMessage(this.message);
    }

    /**
     * @param {UserMessage} msg
     */
    renderUserMessage(msg) {
        return html`
            <div class="flex justify-end">
                <div
                    class="max-w-[70%] bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-br-sm shadow-lg"
                >
                    <p class="text-sm leading-relaxed">${msg.content}</p>
                </div>
            </div>
        `;
    }

    /**
     * @param {AssistantMessage} msg
     */
    renderAssistantMessage(msg) {
        return html`
            <div class="flex justify-start gap-3">
                <div
                    class="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs shrink-0 mt-1"
                >
                    🤖
                </div>
                <div class="max-w-[80%] space-y-4">
                    <div
                        class="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"
                    >
                        <div class="text-sm leading-relaxed text-foreground space-y-3">
                            ${msg.blocks.map((block) => this.renderBlock(block))}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * @param {MessageBlock} block
     */
    renderBlock(block) {
        switch (block.type) {
            case "paragraph":
                return html`
                    <p class="${block.italic ? "text-muted-foreground italic" : ""}">
                        ${this.renderInline(block.segments ?? block.text)}
                    </p>
                `;
            case "callout":
                return html`
                    <sl-card class="callout-card w-full">
                        <p class="font-semibold text-purple-400 mb-1">${block.title}</p>
                        <p class="text-muted-foreground">
                            ${this.renderInline(block.segments ?? block.text)}
                        </p>
                    </sl-card>
                `;
            case "stat-block":
                return html` <stat-block .title=${block.title} .data=${block.data}></stat-block> `;
            case "list":
                return html`
                    <ul class="list-disc pl-5 space-y-2 text-muted-foreground">
                        ${block.items.map(
                            (item) => html`
                                <li>
                                    <strong class="text-foreground">${item.title}</strong>
                                    ${this.renderInline(item.segments ?? item.text)}
                                </li>
                            `,
                        )}
                    </ul>
                `;
            default:
                return nothing;
        }
    }

    /**
     * @param {Segment[] | string | undefined} inline
     */
    renderInline(inline) {
        if (!inline) {
            return nothing;
        }
        if (typeof inline === "string") {
            return inline;
        }
        return inline.map((seg) =>
            seg.highlight ? html`<strong class="text-foreground">${seg.text}</strong>` : seg.text,
        );
    }
}

const element = customElement("chat-message")(ChatMessage);
export { element as ChatMessage };
