import { ContextConsumer } from "@lit/context";
import { css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { createConversationStore } from "../stores/conversation-store.js";
import { uiContext } from "../stores/ui-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/dialog/dialog.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/button/button.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/spinner/spinner.js?deps=lit@3.3.2";

/** @typedef {import("../../shared/types.js").Conversation} Conversation */

/**
 * @customElement archive-dialog
 */
class ArchiveDialog extends BaseElement {
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
            .empty-state {
                text-align: center;
                padding: 2rem;
                color: var(--muted-foreground);
                font-size: 0.875rem;
            }
            .archived-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .archived-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.75rem;
                background: hsla(240, 10%, 8%, 0.5);
                border-radius: 0.5rem;
                gap: 0.5rem;
            }
            .archived-info {
                flex: 1;
                min-width: 0;
            }
            .archived-title {
                font-size: 0.875rem;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .archived-date {
                font-size: 0.75rem;
                color: var(--muted-foreground);
            }
            .archived-actions {
                display: flex;
                gap: 0.375rem;
                flex-shrink: 0;
            }
        `,
    ];

    static properties = {
        _archivedConversations: { type: Array },
        _error: { type: String },
        _loading: { type: Boolean },
        _uiState: { type: Object },
    };

    constructor() {
        super();
        /** @type {Conversation[]} */
        this._archivedConversations = [];
        /** @type {string} */
        this._error = "";
        /** @type {boolean} */
        this._loading = false;
        /** @type {import("../stores/ui-store.js").UIState} */
        this._uiState = {
            sidebarExpanded: true,
            settingsOpen: false,
            archiveOpen: false,
            breakpoint: "desktop",
        };
        this._convStore = createConversationStore();
    }

    connectedCallback() {
        super.connectedCallback();
        new ContextConsumer(this, {
            context: uiContext,
            callback: /** @param {import("../stores/ui-store.js").UIState} v */ (v) => {
                this._uiState = v;
            },
            subscribe: true,
        });
    }

    /** @param {Map<string, unknown>} changedProperties */
    updated(changedProperties) {
        super.updated(changedProperties);

        // Sync dialog open state from context
        if (changedProperties.has("_uiState") || this._uiStateChanged(changedProperties)) {
            const dialog = /** @type {ShadowRoot} */ (this.shadowRoot).querySelector("sl-dialog");
            if (dialog) {
                if (this._uiState.archiveOpen) {
                    void dialog.show();
                } else {
                    void dialog.hide();
                }
            }
        }

        // Fetch archived conversations when dialog opens
        const prevUIState = /** @type {{ archiveOpen: boolean } | undefined} */ (
            changedProperties.get("_uiState")
        );
        const wasOpen = prevUIState?.archiveOpen;
        if (changedProperties.has("_uiState") && this._uiState.archiveOpen && !wasOpen) {
            void this._fetchArchived();
        }
    }

    /**
     * @param {Map<string, unknown>} changedProperties
     * @returns {boolean}
     */
    _uiStateChanged(changedProperties) {
        if (!changedProperties.has("_uiState")) {
            return false;
        }
        const prev = /** @type {{ archiveOpen: boolean } | undefined} */ (
            changedProperties.get("_uiState")
        );
        return prev ? prev.archiveOpen !== this._uiState.archiveOpen : true;
    }

    render() {
        return html`
            <sl-dialog
                label="Archive"
                @sl-after-hide=${() => {
                    this.dispatchEvent(
                        new CustomEvent("archive-closed", {
                            bubbles: true,
                            composed: true,
                        }),
                    );
                }}
            >
                ${this._error ? html`<div class="error">${this._error}</div>` : ""}
                ${this._loading
                    ? html`<div class="empty-state"><sl-spinner></sl-spinner></div>`
                    : this._archivedConversations.length === 0
                      ? html`<div class="empty-state">No archived conversations</div>`
                      : html`<div class="archived-list">
                            ${this._archivedConversations.map(
                                (conv) => html`
                                    <div class="archived-item">
                                        <div class="archived-info">
                                            <div class="archived-title">${conv.title}</div>
                                            <div class="archived-date">
                                                Archived ${this._formatDate(conv.archivedAt)}
                                            </div>
                                        </div>
                                        <div class="archived-actions">
                                            <sl-button
                                                size="small"
                                                variant="default"
                                                @click=${() => this._handleRestore(conv.id)}
                                            >
                                                Restore
                                            </sl-button>
                                            <sl-button
                                                size="small"
                                                variant="danger"
                                                @click=${() => this._handleDelete(conv.id)}
                                            >
                                                Delete
                                            </sl-button>
                                        </div>
                                    </div>
                                `,
                            )}
                        </div>`}
            </sl-dialog>
        `;
    }

    async _fetchArchived() {
        this._loading = true;
        this._error = "";
        try {
            this._archivedConversations = await this._convStore.fetchArchivedConversations();
        } catch {
            this._error = "Failed to load archived conversations";
        } finally {
            this._loading = false;
        }
    }

    /** @param {string} id */
    async _handleRestore(id) {
        this._loading = true;
        this._error = "";
        try {
            await this._convStore.restoreConversation(id);
            this._archivedConversations = this._archivedConversations.filter((c) => c.id !== id);
            this.dispatchEvent(
                new CustomEvent("conversation-restored", {
                    bubbles: true,
                    composed: true,
                }),
            );
        } catch {
            this._error = "Failed to restore conversation";
        } finally {
            this._loading = false;
        }
    }

    /** @param {string} id */
    async _handleDelete(id) {
        if (!confirm("Permanently delete this conversation? This cannot be undone.")) {
            return;
        }
        this._loading = true;
        this._error = "";
        try {
            await this._convStore.deleteConversation(id);
            this._archivedConversations = this._archivedConversations.filter((c) => c.id !== id);
        } catch {
            this._error = "Failed to delete conversation";
        } finally {
            this._loading = false;
        }
    }

    /**
     * @param {string | null | undefined} dateString
     * @returns {string}
     */
    _formatDate(dateString) {
        if (!dateString) {
            return "";
        }
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }
}

const element = customElement("archive-dialog")(ArchiveDialog);
export { element as ArchiveDialog };
