import { ContextConsumer } from "@lit/context";
import { startRegistration } from "@simplewebauthn/browser";
import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { uiContext } from "../stores/ui-store.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { client } from "../utils/rpc-client.js";
/** @typedef {import("../../shared/types.js").Mode} Mode */
/** @typedef {import("../../shared/types.js").AuthUser} AuthUser */

import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/dialog/dialog.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/input/input.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/button/button.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/tag/tag.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/divider/divider.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/radio-group/radio-group.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/radio-button/radio-button.js?deps=lit@3.3.2";

class SettingsDialog extends LitElement {
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
            .section {
                margin-bottom: 2rem;
            }
            .section:last-child {
                margin-bottom: 0;
            }
            .section-title {
                font-size: 0.875rem;
                font-weight: 600;
                margin-bottom: 1rem;
                color: var(--foreground);
            }
            .form-group {
                margin-bottom: 1rem;
            }
            .form-group label {
                display: block;
                font-size: 0.875rem;
                margin-bottom: 0.5rem;
                color: var(--muted-foreground);
            }
            .mode-toggle {
                display: flex;
                gap: 1rem;
            }
            .mode-option {
                flex: 1;
            }
            .devices-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .device-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem;
                background: hsla(240, 10%, 8%, 0.5);
                border-radius: 8px;
            }
            .device-info {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            .device-name {
                font-size: 0.875rem;
                font-weight: 500;
            }
            .device-meta {
                font-size: 0.75rem;
                color: var(--muted-foreground);
            }
            .danger-zone {
                padding: 1rem;
                background: hsla(0, 70%, 15%, 0.5);
                border: 1px solid hsla(0, 70%, 30%, 0.5);
                border-radius: 8px;
            }
            .danger-zone h3 {
                font-size: 0.875rem;
                color: hsl(0, 70%, 70%);
                margin: 0 0 1rem 0;
            }
            sl-button.danger {
                --sl-color-primary-500: hsl(0, 70%, 60%);
                --sl-color-primary-600: hsl(0, 70%, 50%);
            }
        `,
    ];

    static properties = {
        user: { type: Object },
        devices: { type: Array },
        _uiState: { type: Object },
        nameInput: { type: String },
        modeInput: { type: String },
        loading: { type: Boolean },
        error: { type: String },
    };

    constructor() {
        super();
        /** @type {AuthUser | null} */
        this.user = null;
        /** @type {import("zod").z.infer<typeof import("../../server/db/queries.js").DeviceListSchema>} */
        this.devices = [];
        /** @type {string} */
        this.nameInput = "";
        /** @type {Mode} */
        this.modeInput = "gm";
        /** @type {boolean} */
        this.loading = false;
        /** @type {string} */
        this.error = "";
        /** @type {import("../stores/ui-store.js").UIState} */
        this._uiState = { sidebarExpanded: true, settingsOpen: false, breakpoint: "desktop" };
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

        // Sync inputs with user when user changes
        if (changedProperties.has("user") && this.user) {
            this.nameInput = this.user.name;
            this.modeInput = this.user.mode;
        }

        // Sync dialog open state from context
        if (changedProperties.has("_uiState") || this._uiStateChanged(changedProperties)) {
            const dialog = /** @type {ShadowRoot} */ (this.shadowRoot).querySelector("sl-dialog");
            if (dialog) {
                if (this._uiState.settingsOpen) {
                    void dialog.show();
                } else {
                    void dialog.hide();
                }
            }
        }

        // Fetch devices when dialog opens
        const prevUIState = /** @type {{ settingsOpen: boolean } | undefined} */ (
            changedProperties.get("_uiState")
        );
        const wasOpen = prevUIState?.settingsOpen;
        if (this._uiState.settingsOpen && !wasOpen && !(this.devices || []).length) {
            void this.fetchDevices();
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
        const prev = /** @type {{ settingsOpen: boolean } | undefined} */ (
            changedProperties.get("_uiState")
        );
        return prev ? prev.settingsOpen !== this._uiState.settingsOpen : true;
    }

    render() {
        if (!this.user) {
            return html``;
        }

        return html`
            <sl-dialog
                label="Settings"
                @sl-after-hide=${() => {
                    this.dispatchEvent(
                        new CustomEvent("settings-closed", {
                            bubbles: true,
                            composed: true,
                        }),
                    );
                }}
            >
                ${this.error ? html`<div class="error">${this.error}</div>` : ""}

                <div class="section">
                    <h3 class="section-title">Profile</h3>
                    <div class="form-group">
                        <label>Name</label>
                        <sl-input
                            value=${this.nameInput}
                            @sl-input=${this.handleNameInput}
                            ?disabled=${this.loading}
                        ></sl-input>
                    </div>
                    <div class="form-group">
                        <label>Default Mode</label>
                        <div class="mode-toggle">
                            <sl-radio-group
                                size="small"
                                .value=${this.modeInput}
                                @sl-change=${this.handleModeChange}
                            >
                                <sl-radio-button value="player" class="mode-option player">
                                    Player Mode
                                </sl-radio-button>
                                <sl-radio-button value="gm" class="mode-option gm">
                                    GM Mode
                                </sl-radio-button>
                            </sl-radio-group>
                        </div>
                    </div>
                </div>

                <sl-divider></sl-divider>

                <div class="section">
                    <h3 class="section-title">Passkeys</h3>
                    <div class="devices-list">
                        ${(this.devices || []).map(
                            (device) => html`
                                <div class="device-item">
                                    <div class="device-info">
                                        <span class="device-name"
                                            >${this.getDeviceName(device)}</span
                                        >
                                        <span class="device-meta"
                                            >${this.formatDate(device.createdAt)}</span
                                        >
                                    </div>
                                    ${(this.devices || []).length > 1
                                        ? html`
                                              <sl-button
                                                  size="small"
                                                  variant="danger"
                                                  @click=${() => this.handleRemoveDevice(device.id)}
                                                  ?disabled=${this.loading}
                                              >
                                                  Remove
                                              </sl-button>
                                          `
                                        : ""}
                                </div>
                            `,
                        )}
                    </div>
                    <div style="margin-top: 1rem;">
                        <sl-button
                            variant="default"
                            @click=${this.handleAddDevice}
                            ?disabled=${this.loading}
                            ?loading=${this.loading}
                        >
                            Add Device
                        </sl-button>
                    </div>
                </div>

                <sl-divider></sl-divider>

                <div class="section danger-zone">
                    <h3>Danger Zone</h3>
                    <sl-button
                        class="danger"
                        variant="danger"
                        @click=${this.handleDeleteAccount}
                        ?disabled=${this.loading}
                    >
                        Delete Account
                    </sl-button>
                </div>

                <sl-button slot="footer" variant="default" @click=${this.handleClose}
                    >Close</sl-button
                >
                <sl-button
                    slot="footer"
                    variant="primary"
                    @click=${this.handleSave}
                    ?disabled=${this.loading}
                >
                    Save
                </sl-button>
            </sl-dialog>
        `;
    }

    /**
     * @param {import("@shoelace-style/shoelace").SlInputEvent} e
     */
    handleNameInput(e) {
        this.nameInput = /** @type {HTMLInputElement} */ (e.target).value;
    }

    /**
     * @param {import("@shoelace-style/shoelace").SlChangeEvent} e
     */
    handleModeChange(e) {
        this.modeInput = /** @type {Mode} */ (/** @type {HTMLInputElement} */ (e.target).value);
    }

    async handleSave() {
        this.loading = true;
        this.error = "";

        try {
            const res = await client.api.users.me.$put({
                json: {
                    name: this.nameInput,
                    mode: this.modeInput,
                },
            });
            const data = await res.json();

            this.dispatchEvent(
                new CustomEvent("settings-updated", {
                    detail: { user: data.data },
                    bubbles: true,
                    composed: true,
                }),
            );
            this._hideDialog();
        } catch (err) {
            this.error = Error.isError(err) ? err.message : "Failed to save settings";
        } finally {
            this.loading = false;
        }
    }

    handleClose() {
        this._hideDialog();
    }

    /**
     * Hides the Shoelace dialog element directly.
     */
    _hideDialog() {
        const dialog = /** @type {ShadowRoot} */ (this.shadowRoot)?.querySelector("sl-dialog");
        if (dialog) {
            void dialog.hide();
        }
    }

    async fetchDevices() {
        try {
            const res = await client.api.auth.devices.$get();
            const data = await res.json();
            this.devices = data.data ?? [];
        } catch {
            // Failed to fetch devices
        } finally {
            this.loading = false;
        }
    }

    /**
     *
     * @param {import("zod").z.infer<typeof import("../../server/db/queries.js").DeviceSchema>} device
     */
    getDeviceName(device) {
        if (device.deviceType === "singleDevice") {
            return "Passkey (Single Device)";
        }
        if (device.deviceType === "multiDevice") {
            return "Passkey (Multi-Device)";
        }
        return "Passkey";
    }

    /**
     * @param {string} dateString
     * @returns {string}
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    async handleAddDevice() {
        this.loading = true;
        this.error = "";

        try {
            // Start device registration
            const startRes = await client.api.auth.device.start.$post({ json: {} });
            if (!startRes.ok) {
                const startData = await startRes.json();
                throw new Error(startData.message || "Failed to start device registration");
            }
            const startData = await startRes.json();
            const { options, challengeId } = startData.data;

            // Prompt for passkey
            const credential = await startRegistration({ optionsJSON: options });

            // Finish registration
            await client.api.auth.device.finish.$post({
                json: { credential, challengeId },
            });

            // Refresh devices list
            await this.fetchDevices();
        } catch (err) {
            this.error = Error.isError(err) ? err.message : "Failed to add device";
        } finally {
            this.loading = false;
        }
    }

    /**
     * @param {string} deviceId
     */
    async handleRemoveDevice(deviceId) {
        this.loading = true;
        this.error = "";

        try {
            await client.api.auth.device[":credentialId"].$delete({
                param: { credentialId: deviceId },
            });
            await this.fetchDevices();
        } catch (err) {
            this.error = Error.isError(err) ? err.message : "Failed to remove device";
        } finally {
            this.loading = false;
        }
    }

    async handleDeleteAccount() {
        if (
            !confirm("Are you sure you want to delete your account? This action cannot be undone.")
        ) {
            return;
        }

        this.loading = true;
        this.error = "";

        try {
            await client.api.users["me"].$delete();
            this.dispatchEvent(
                new CustomEvent("account-deleted", {
                    bubbles: true,
                    composed: true,
                }),
            );
            this._hideDialog();
        } catch (err) {
            this.error = Error.isError(err) ? err.message : "Failed to delete account";
        } finally {
            this.loading = false;
        }
    }
}

customElement("settings-dialog")(SettingsDialog);
export { SettingsDialog };
