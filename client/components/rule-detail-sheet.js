import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/dialog/dialog.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/tag/tag.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/divider/divider.js?deps=lit@3.3.2";
import { css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { client } from "../utils/rpc-client.js";
import { BaseElement } from "./base-element.js";

/**
 * @customElement rule-detail-sheet
 * @property {{ title: string, category: string, description?: string, traits?: string[] } | null} detail
 */
class RuleDetailSheet extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                display: block;
                color: var(--foreground);
            }
            sl-dialog::part(panel) {
                background: var(--secondary);
                border: 1px solid var(--border);
            }
            .rule-detail-header {
                margin-bottom: 1rem;
            }
            .rule-detail-title {
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--foreground);
                margin: 0 0 0.5rem 0;
            }
            .rule-detail-category {
                font-size: 0.75rem;
            }
            .rule-detail-description {
                font-size: 0.875rem;
                line-height: 1.625;
                color: var(--foreground);
                margin-bottom: 1rem;
            }
            .rule-detail-traits {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            .rule-detail-loading {
                font-size: 0.875rem;
                color: var(--muted-foreground);
                padding: 1rem 0;
            }
            .rule-detail-error {
                font-size: 0.875rem;
                color: hsl(0, 70%, 70%);
                padding: 1rem 0;
            }
        `,
    ];

    static properties = {
        detail: { type: Object },
        loading: { type: Boolean },
        error: { type: String },
    };

    constructor() {
        super();
        /** @type {{ title: string, category: string, description?: string, traits?: string[] } | null} */
        this.detail = null;
        /** @type {boolean} */
        this.loading = false;
        /** @type {string} */
        this.error = "";
        /** @type {Node | null} */
        this._listenParent = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener("rule-detail-request", this._onRuleDetailRequest);
        // Also listen on the parent/root node so events from sibling elements
        // in the same shadow DOM are caught. Store reference for proper cleanup.
        const parent = this.getRootNode();
        if (parent && parent !== this) {
            parent.addEventListener("rule-detail-request", this._onRuleDetailRequest);
            this._listenParent = parent;
        }
    }

    disconnectedCallback() {
        this.removeEventListener("rule-detail-request", this._onRuleDetailRequest);
        if (this._listenParent) {
            this._listenParent.removeEventListener(
                "rule-detail-request",
                this._onRuleDetailRequest,
            );
            this._listenParent = null;
        }
        super.disconnectedCallback();
    }

    /**
     * Handles rule-detail-request events bubbled up from stat-block or other components.
     * @param {Event} event
     */
    _onRuleDetailRequest = async (event) => {
        const detail = /** @type {{ ruleItemId: string, name: string }} */ (
            /** @type {CustomEvent} */ (event).detail
        );
        const { ruleItemId } = detail;
        if (!ruleItemId) {
            return;
        }

        this.loading = true;
        this.error = "";
        this.detail = {
            title: detail.name || "Loading…",
            category: "",
        };
        this.requestUpdate();

        // Open dialog immediately with loading state
        void this.updateComplete.then(() => {
            const dialog = /** @type {ShadowRoot} */ (this.shadowRoot)?.querySelector("sl-dialog");
            if (dialog) {
                void dialog.show();
            }
        });

        try {
            const res = await client.api["rule-items"][":id"].$get({
                param: { id: ruleItemId },
            });
            if (!res.ok) {
                throw new Error(`Failed to load rule item: ${res.status}`);
            }
            const { data } = await res.json();
            const itemData = /** @type {Record<string, unknown>} */ (data.data ?? {});
            this.detail = {
                title: data.name,
                category: data.type,
                description:
                    typeof itemData.description === "string" ? itemData.description : undefined,
                traits: Array.isArray(itemData.traits) ? itemData.traits : undefined,
            };
            this.loading = false;
        } catch (err) {
            this.error = err instanceof Error ? err.message : "Failed to load rule item";
            this.loading = false;
        }
    };

    /**
     * Shows the dialog with the given detail data directly.
     * @param {{ title: string, category: string, description?: string, traits?: string[] }} detail
     */
    show(detail) {
        this.detail = detail;
        this.loading = false;
        this.error = "";
        this.requestUpdate();
        void this.updateComplete.then(() => {
            const dialog = /** @type {ShadowRoot} */ (this.shadowRoot)?.querySelector("sl-dialog");
            if (dialog) {
                void dialog.show();
            }
        });
    }

    render() {
        return html`
            <sl-dialog
                label=${this.detail?.title ?? "Rule Detail"}
                @sl-after-hide=${this._onDialogHide}
            >
                ${this.error ? html`<p class="rule-detail-error">${this.error}</p>` : ""}
                ${this.loading ? html`<p class="rule-detail-loading">Loading…</p>` : ""}
                ${this.detail && !this.loading
                    ? html`
                          <div class="rule-detail-header">
                              <sl-tag size="small" variant="neutral"
                                  >${this.detail.category}</sl-tag
                              >
                          </div>
                          ${this.detail.description
                              ? html`<p class="rule-detail-description">
                                    ${this.detail.description}
                                </p>`
                              : ""}
                          ${this.detail.traits?.length
                              ? html`<sl-divider></sl-divider>
                                    <div class="rule-detail-traits">
                                        ${this.detail.traits.map(
                                            (t) => html`<sl-tag size="small">${t}</sl-tag>`,
                                        )}
                                    </div>`
                              : ""}
                      `
                    : ""}
            </sl-dialog>
        `;
    }

    _onDialogHide() {
        this.detail = null;
        this.loading = false;
        this.error = "";
    }
}

customElement("rule-detail-sheet")(RuleDetailSheet);
export { RuleDetailSheet };
