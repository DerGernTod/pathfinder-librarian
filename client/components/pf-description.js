import { css } from "lit-element";
import { html, nothing } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import {
    formatCheck,
    formatDamage,
    formatRoll,
    formatTemplate,
    optionsTooltip,
    parseFoundryInline,
} from "../utils/foundry-inline.js";
import { BaseElement } from "./base-element.js";

/**
 * @customElement pf-description
 *
 * Renders a Foundry PF2e description with rich inline markup:
 * - Server-resolved @UUID segments (with ruleItemId) become clickable links
 * - @Check[...] patterns become styled check-badge pills
 * - @Damage[...] patterns become styled damage-badge pills
 * - @Template[...] patterns become styled template-badge pills
 * - [[/gmr ...]] / [[/act ...]] inline rolls become styled roll-note badges
 *
 * Usage (with server segments):
 *   <pf-description .segments=${action.descriptionSegments}></pf-description>
 *
 * Usage (with raw description text):
 *   <pf-description .description=${action.description}></pf-description>
 *
 * Dispatches `rule-detail-request` (bubbles, composed) when a rule-ref is clicked.
 *
 * @property {string} [description] - Raw description text (fallback when no segments)
 * @property {Array<{ text: string, ruleItemId?: string }>} [segments] - Server-resolved segments
 */
class PfDescription extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                display: inline;
            }
            a.rule-ref {
                color: var(--accent, hsl(262, 83%, 68%));
                text-decoration: underline;
                cursor: pointer;
            }
            .check-badge {
                display: inline-block;
                background: hsl(215 25% 18%);
                border: 1px solid hsl(215 45% 32%);
                border-radius: 0.25rem;
                padding: 0.05em 0.4em;
                font-size: 0.8em;
                font-weight: 600;
                color: hsl(215 75% 72%);
                white-space: nowrap;
                vertical-align: baseline;
            }
            .damage-badge {
                display: inline-block;
                background: hsl(15 25% 18%);
                border: 1px solid hsl(15 45% 32%);
                border-radius: 0.25rem;
                padding: 0.05em 0.4em;
                font-size: 0.8em;
                font-weight: 600;
                color: hsl(15 75% 72%);
                white-space: nowrap;
                vertical-align: baseline;
            }
            .template-badge {
                display: inline-block;
                background: hsl(175 25% 18%);
                border: 1px solid hsl(175 45% 32%);
                border-radius: 0.25rem;
                padding: 0.05em 0.4em;
                font-size: 0.8em;
                font-weight: 600;
                color: hsl(175 75% 72%);
                white-space: nowrap;
                vertical-align: baseline;
            }
            .roll-note {
                display: inline-block;
                background: hsl(45 25% 18%);
                border: 1px solid hsl(45 45% 32%);
                border-radius: 0.25rem;
                padding: 0.05em 0.4em;
                font-size: 0.8em;
                font-weight: 600;
                color: hsl(45 75% 72%);
                white-space: nowrap;
                vertical-align: baseline;
            }
        `,
    ];

    static properties = {
        description: { type: String },
        segments: { type: Array },
    };

    constructor() {
        super();
        /** @type {string | undefined} */
        this.description = undefined;
        /** @type {Array<{ text: string, ruleItemId?: string }> | undefined} */
        this.segments = undefined;
    }

    /**
     * @param {string} ruleItemId
     * @param {string} name
     */
    _onRuleRef(ruleItemId, name) {
        this.dispatchEvent(
            new CustomEvent("rule-detail-request", {
                detail: { ruleItemId, name },
                bubbles: true,
                composed: true,
            }),
        );
    }

    /**
     * @param {import("../utils/foundry-inline.js").InlineSeg} seg
     */
    _renderSeg(seg) {
        if (seg.type === "text") {
            return seg.text;
        }
        if (seg.type === "check") {
            const tooltip =
                formatCheck(seg) + (seg.options ? ` (${optionsTooltip(seg.options)})` : "");
            return html`<span class="check-badge" title=${tooltip}>${formatCheck(seg)}</span>`;
        }
        if (seg.type === "damage") {
            const tooltip = seg.options ? optionsTooltip(seg.options) : "";
            return html`<span class="damage-badge" title=${tooltip}>${formatDamage(seg)}</span>`;
        }
        if (seg.type === "template") {
            return html`<span class="template-badge" title=${seg.displayText ?? ""}
                >${formatTemplate(seg)}</span
            >`;
        }
        if (seg.type === "roll") {
            return html`<span class="roll-note" title=${seg.formula ?? ""}
                >${formatRoll(seg)}</span
            >`;
        }
        return nothing;
    }

    /**
     * Renders a single line of text. Always parses inline patterns first,
     * then renders each resulting segment. Text segments containing HTML
     * (from @Localize resolution) are rendered as actual HTML elements
     * rather than escaped text.
     * @param {string} text
     * @returns {import("lit-html").TemplateResult | string | Array<unknown>}
     */
    _renderInlineSegments(text) {
        const segs = parseFoundryInline(text);
        // Fast path: single text segment with no inline patterns
        if (segs.length === 1 && segs[0].type === "text") {
            if (/<[a-zA-Z][^>]*>/.test(segs[0].text)) {
                return /** @type {import("lit-html").TemplateResult} */ (unsafeHTML(segs[0].text));
            }
            return segs[0].text;
        }
        return segs.map((seg) => {
            if (seg.type === "text") {
                if (/<[a-zA-Z][^>]*>/.test(seg.text)) {
                    return /** @type {import("lit-html").TemplateResult} */ (unsafeHTML(seg.text));
                }
                return seg.text;
            }
            return this._renderSeg(seg);
        });
    }

    /**
     * Expands @Check, @Damage, @Template, and inline roll patterns inside a
     * text string. Handles newlines by splitting on \\n and interleaving
     * with <br/> elements.
     * @param {string} text
     * @returns {import("lit-html").TemplateResult | string | Array<unknown>}
     */
    _renderInlineText(text) {
        const lines = text.split("\n");
        if (lines.length === 1) {
            return this._renderInlineSegments(text);
        }
        return html`${lines.flatMap((line, i) => {
            const parts = [this._renderInlineSegments(line)];
            if (i < lines.length - 1) {
                parts.push(html`<br />`);
            }
            return parts;
        })}`;
    }

    /**
     * Splits text on double-newlines into paragraphs and renders inline
     * markup within each paragraph.
     * @param {string} text
     * @returns {import("lit-html").TemplateResult | string | Array<unknown>}
     */
    _renderTextWithParagraphs(text) {
        const paragraphs = text.split(/\n{2,}/);
        if (paragraphs.length <= 1) {
            return this._renderInlineText(text);
        }
        return html`${paragraphs.map((p) => html`<p>${this._renderInlineText(p.trim())}</p>`)}`;
    }

    render() {
        const segs = this.segments;
        if (segs?.length) {
            return html`${segs.map((seg) => {
                if (seg.ruleItemId) {
                    return html`<a
                        class="rule-ref"
                        href="#"
                        @click=${(/** @type {MouseEvent} */ e) => {
                            e.preventDefault();
                            this._onRuleRef(seg.ruleItemId ?? "", seg.text);
                        }}
                        >${seg.text}</a
                    >`;
                }
                return this._renderTextWithParagraphs(seg.text);
            })}`;
        }
        if (this.description) {
            return html`${this._renderTextWithParagraphs(this.description)}`;
        }
        return nothing;
    }
}

customElement("pf-description")(PfDescription);
export { PfDescription };
