import { LitElement, css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { SEED_IDS } from "../../server/db/seed.js";
import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { registerWithPasskey, loginWithPasskey, quickLogin } from "../utils/auth-client.js";

import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/input/input.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/button/button.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/card/card.js?deps=lit@3.3.2";

class LoginPage extends LitElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: hsl(240, 10%, 3.9%);
            }
            .container {
                width: 100%;
                max-width: 400px;
                padding: 2rem;
            }
            .card {
                background: var(--secondary);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            }
            .header {
                text-align: center;
                margin-bottom: 2rem;
            }
            .title {
                font-size: 1.5rem;
                font-weight: 700;
                background: linear-gradient(135deg, hsl(262, 83%, 58%) 0%, hsl(280, 80%, 60%) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin: 0 0 0.5rem 0;
            }
            .subtitle {
                font-size: 0.875rem;
                color: var(--muted-foreground);
                margin: 0;
            }
            .form {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .button-group {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            sl-button {
                width: 100%;
            }
            .divider {
                display: flex;
                align-items: center;
                margin: 1.5rem 0;
                color: var(--muted-foreground);
                font-size: 0.875rem;
            }
            .divider::before,
            .divider::after {
                content: "";
                flex: 1;
                border-bottom: 1px solid var(--border);
            }
            .divider span {
                padding: 0 1rem;
            }
            .test-users {
                margin-top: 1.5rem;
                padding-top: 1.5rem;
                border-top: 1px solid var(--border);
            }
            .test-users h3 {
                font-size: 0.875rem;
                color: var(--muted-foreground);
                margin: 0 0 1rem 0;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .test-user-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem 0;
                border-bottom: 1px solid var(--border);
            }
            .test-user-item:last-child {
                border-bottom: none;
            }
            .test-user-name {
                font-size: 0.875rem;
                font-weight: 500;
            }
            .test-user-mode {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                margin-left: 0.5rem;
            }
            .quick-login-button {
                padding: 0.5rem 1rem;
                font-size: 0.875rem;
            }
            .error {
                background: hsl(0, 70%, 15%);
                border: 1px solid hsl(0, 70%, 30%);
                color: hsl(0, 70%, 70%);
                padding: 0.75rem 1rem;
                border-radius: 8px;
                font-size: 0.875rem;
                margin-bottom: 1rem;
            }
        `,
    ];

    static properties = {
        /** @type {string} */ name: { type: String },
        /** @type {boolean} */ loading: { type: Boolean },
        /** @type {string} */ error: { type: String },
        /** @type {boolean} */ isRegistering: { type: Boolean },
    };

    constructor() {
        super();
        /** @type {string} */
        this.name = "";
        /** @type {boolean} */
        this.loading = false;
        /** @type {string} */
        this.error = "";
        /** @type {boolean} */
        this.isRegistering = false;
    }

    render() {
        return html`
            <div class="container">
                <div class="card">
                    <div class="header">
                        <h1 class="title">Pathfinder Librarian</h1>
                        <p class="subtitle">Your AI-powered Pathfinder 2e assistant</p>
                    </div>

                    ${this.error ? html`<div class="error">${this.error}</div>` : ""}

                    <div class="form">
                        <sl-input
                            label="Your Name"
                            placeholder="Enter your name"
                            value=${this.name}
                            @sl-input=${this.handleNameInput}
                            ?disabled=${this.loading}
                        ></sl-input>

                        <div class="button-group">
                            <sl-button
                                variant="primary"
                                @click=${this.handleLogin}
                                ?disabled=${this.loading}
                                ?loading=${this.loading}
                            >
                                Sign in with Passkey
                            </sl-button>
                            <sl-button
                                variant="default"
                                @click=${this.handleRegister}
                                ?disabled=${this.loading}
                                ?loading=${this.loading}
                            >
                                Create Account
                            </sl-button>
                        </div>
                    </div>

                    ${process.env.NODE_ENV !== "production"
                        ? html`
                              <div class="test-users">
                                  <h3>Quick Login (Dev Only)</h3>
                                  <div class="test-user-item">
                                      <span>
                                          <span class="test-user-name">Pathfinder GM</span>
                                          <span class="test-user-mode">GM Mode</span>
                                      </span>
                                      <sl-button
                                          class="quick-login-button"
                                          size="small"
                                          @click=${() =>
                                              this.handleQuickLogin(SEED_IDS.USER_DEFAULT)}
                                          ?disabled=${this.loading}
                                      >
                                          Quick Login
                                      </sl-button>
                                  </div>
                                  <div class="test-user-item">
                                      <span>
                                          <span class="test-user-name">Valeros</span>
                                          <span class="test-user-mode">Player Mode</span>
                                      </span>
                                      <sl-button
                                          class="quick-login-button"
                                          size="small"
                                          @click=${() =>
                                              this.handleQuickLogin(SEED_IDS.USER_TEST_PLAYER)}
                                          ?disabled=${this.loading}
                                      >
                                          Quick Login
                                      </sl-button>
                                  </div>
                              </div>
                          `
                        : ""}
                </div>
            </div>
        `;
    }

    handleNameInput(e) {
        this.name = e.target.value;
    }

    async handleLogin() {
        this.loading = true;
        this.error = "";

        try {
            const { user } = await loginWithPasskey();
            this.dispatchEvent(
                new CustomEvent("login-success", {
                    detail: { user },
                    bubbles: true,
                    composed: true,
                }),
            );
        } catch (err) {
            this.error = err.message || "Failed to sign in. Please try again.";
        } finally {
            this.loading = false;
        }
    }

    async handleRegister() {
        if (!this.name.trim()) {
            this.error = "Please enter your name";
            return;
        }

        this.loading = true;
        this.error = "";

        try {
            const { user } = await registerWithPasskey(this.name);
            this.dispatchEvent(
                new CustomEvent("login-success", {
                    detail: { user },
                    bubbles: true,
                    composed: true,
                }),
            );
        } catch (err) {
            this.error = err.message || "Failed to create account. Please try again.";
        } finally {
            this.loading = false;
        }
    }

    async handleQuickLogin(userId) {
        this.loading = true;
        this.error = "";

        try {
            const { user } = await quickLogin(userId);
            this.dispatchEvent(
                new CustomEvent("login-success", {
                    detail: { user },
                    bubbles: true,
                    composed: true,
                }),
            );
        } catch (err) {
            this.error = err.message || "Failed to sign in. Please try again.";
        } finally {
            this.loading = false;
        }
    }
}

customElement("login-page")(LoginPage);
export { LoginPage };
