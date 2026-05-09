import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/card/card.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/details/details.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/tag/tag.js?deps=lit@3.3.2";
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/divider/divider.js?deps=lit@3.3.2";
import { css } from "lit-element";
import { html } from "lit-html";
import { customElement } from "lit/decorators.js";

import { baseStyles } from "../styles/base-styles.js";
import { tokens } from "../styles/tokens.js";
import { BaseElement } from "./base-element.js";

/** @typedef {string} ActionType */
/** @typedef {{ name: string; description: string; actionType?: ActionType }} Action */
/** @typedef {{ name: string; description: string; tradition?: string; rank?: number; dc?: number }} Spell */
/** @typedef {{ name: string; description: string }} Ability */

/**
 * @typedef {{
 *     name?: string;
 *     type?: string;
 *     level?: number;
 *     traits?: string[];
 *     perception?: string;
 *     languages?: string;
 *     attributes?: {
 *         ac?: number | string;
 *         hp?: number | string;
 *         fortitude?: string;
 *         reflex?: string;
 *         will?: string;
 *     };
 *     skills?: Record<string, string>;
 *     str?: number;
 *     dex?: number;
 *     con?: number;
 *     int?: number;
 *     wis?: number;
 *     cha?: number;
 *     actions?: Action[];
 *     spells?: Spell[];
 *     abilities?: Ability[];
 * }} StatBlockData
 */

/**
 * @customElement stat-block
 * @property {string} title - The title of the stat block, used in the details summary.
 * @property {StatBlockData} data - The data for the stat block, containing all the relevant stats and information to display.
 */
class StatBlock extends BaseElement {
    static styles = [
        tokens,
        baseStyles,
        css`
            :host {
                margin-top: 1rem;
            }
            sl-details::part(base) {
                background: transparent;
                border: none;
                border-radius: 0;
            }
            sl-details::part(header) {
                padding: 0;
            }
            sl-details::part(summary) {
                font-size: 0.875rem;
                font-weight: 500;
                color: var(--muted-foreground);
            }
            sl-details::part(summary):hover {
                color: var(--foreground);
            }
            sl-details::part(summary-icon) {
                color: var(--muted-foreground);
            }
            sl-card::part(base) {
                background: var(--background);
                border: 1px solid var(--border-lighter);
                border-radius: 0.5rem;
            }
            sl-card::part(body) {
                padding: 1rem;
            }
            .header {
                margin-bottom: 1rem;
            }
            .header h3 {
                font-size: 1.5rem;
                font-weight: 700;
                margin: 0 0 0.25rem 0;
                color: var(--foreground);
            }
            .type-level {
                font-size: 0.875rem;
                color: var(--muted-foreground);
                margin-bottom: 0.5rem;
            }
            .traits {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            sl-tag {
                font-size: 0.75rem;
            }
            .primary-stats {
                margin-bottom: 1rem;
            }
            .defense-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
                margin-bottom: 0.75rem;
            }
            .stat-box {
                background: var(--muted);
                border-radius: 0.25rem;
                padding: 0.5rem;
            }
            .stat-label {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                margin-bottom: 0.125rem;
            }
            .stat-value {
                font-size: 1.25rem;
                font-weight: 700;
                color: var(--foreground);
            }
            .hp-value {
                color: #22c55e;
            }
            .saves-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 0.25rem;
                margin-bottom: 0.75rem;
            }
            .save {
                font-size: 0.875rem;
                padding: 0.25rem 0.5rem;
                background: var(--muted);
                border-radius: 0.25rem;
            }
            .perception-languages {
                font-size: 0.875rem;
                color: var(--muted-foreground);
            }
            .secondary-stats {
                margin-bottom: 1rem;
            }
            .ability-scores {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: 0.25rem;
                margin-bottom: 0.75rem;
            }
            .ability-score {
                font-size: 0.75rem;
                text-align: center;
                padding: 0.25rem;
                background: var(--muted);
                border-radius: 0.25rem;
            }
            .skills {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.25rem;
            }
            .skill-entry {
                font-size: 0.875rem;
                padding: 0.125rem 0;
            }
            .drill-downs sl-details {
                margin-bottom: 0.5rem;
            }
            .drill-downs sl-details::part(base) {
                border-left: 2px solid var(--border);
                padding-left: 0.5rem;
                background: transparent;
            }
            .drill-downs sl-details::part(header) {
                padding: 0.25rem 0;
            }
            .drill-downs sl-details::part(summary) {
                font-size: 0.875rem;
                font-weight: 600;
            }
            .action-entry,
            .spell-entry,
            .ability-entry {
                margin-bottom: 0.5rem;
            }
            .action-name,
            .spell-name,
            .ability-name {
                font-weight: 600;
                font-size: 0.875rem;
            }
            .action-type,
            .spell-details {
                font-size: 0.75rem;
                color: var(--muted-foreground);
            }
            .description {
                font-size: 0.875rem;
                margin-top: 0.125rem;
                color: var(--foreground);
            }
            .spell-tradition {
                font-size: 0.75rem;
            }
            @media (max-width: 767px) {
                .ability-scores {
                    grid-template-columns: repeat(3, 1fr);
                }
                .skills {
                    grid-template-columns: 1fr;
                }
                .defense-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
        `,
    ];

    static properties = {
        title: { type: String },
        data: { type: Object },
    };

    constructor() {
        super();
        /** @type {string} */
        this.title = "";
        /** @type {StatBlockData} */
        this.data = {};
    }

    render() {
        return html`
            <sl-details summary="View ${this.title} Stat Block">
                <sl-card style="width: 100%;">
                    ${this.renderHeader()}
                    <sl-divider></sl-divider>
                    ${this.renderPrimaryStats()}
                    <sl-divider></sl-divider>
                    ${this.renderSecondaryStats()}
                    <sl-divider></sl-divider>
                    ${this.renderDrillDowns()}
                </sl-card>
            </sl-details>
        `;
    }

    renderHeader() {
        const { name, type, level, traits } = this.data;
        return html`
            <div class="header">
                <h3>${name || "Unknown"}</h3>
                <div class="type-level">${type || ""} ${level !== undefined ? level : ""}</div>
                <div class="traits">
                    ${(traits || []).map((trait) => html` <sl-tag>${trait}</sl-tag> `)}
                </div>
            </div>
        `;
    }

    renderPrimaryStats() {
        const { attributes, perception, languages } = this.data;
        if (!attributes) {
            return html``;
        }
        return html`
            <div class="primary-stats">
                <div class="defense-grid">
                    <div class="stat-box">
                        <div class="stat-label">Armor Class</div>
                        <div class="stat-value ac-value">${attributes.ac ?? "-"}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Hit Points</div>
                        <div class="stat-value hp-value">${attributes.hp ?? "-"}</div>
                    </div>
                </div>
                <div class="saves-grid">
                    <div class="save save-fort">
                        <span>Fort ${attributes.fortitude ?? "-"}</span>
                    </div>
                    <div class="save save-ref">
                        <span>Ref ${attributes.reflex ?? "-"}</span>
                    </div>
                    <div class="save save-will">
                        <span>Will ${attributes.will ?? "-"}</span>
                    </div>
                </div>
                <div class="perception-languages">
                    <div class="perception">Perception ${perception ?? "-"}</div>
                    <div class="languages">Languages: ${languages ?? "-"}</div>
                </div>
            </div>
        `;
    }

    renderSecondaryStats() {
        const { skills, str, dex, con, int, wis, cha } = this.data;
        const abilityScores = [
            { name: "STR", value: str },
            { name: "DEX", value: dex },
            { name: "CON", value: con },
            { name: "INT", value: int },
            { name: "WIS", value: wis },
            { name: "CHA", value: cha },
        ];
        return html`
            <div class="secondary-stats">
                <div class="ability-scores">
                    ${abilityScores.map(
                        (score) =>
                            html` <div class="ability-score">
                                ${score.name} ${this.formatModifier(score.value)}
                            </div>`,
                    )}
                </div>
                <div class="skills">
                    ${skills
                        ? Object.entries(skills).map(
                              ([name, bonus]) =>
                                  html` <div class="skill-entry">${name} ${bonus}</div>`,
                          )
                        : html``}
                </div>
            </div>
        `;
    }

    renderDrillDowns() {
        return html`
            <div class="drill-downs">
                ${this.renderActions()} ${this.renderSpells()} ${this.renderAbilities()}
            </div>
        `;
    }

    renderActions() {
        const { actions } = this.data;
        if (!actions || actions.length === 0) {
            return html``;
        }
        return html`
            <sl-details summary="Actions">
                ${actions.map(
                    (action) =>
                        html` <div class="action-entry">
                            <div class="action-name">${action.name}</div>
                            ${action.actionType
                                ? html`
                                      <div class="action-type">
                                          ${this.formatActionType(action.actionType)}
                                      </div>
                                  `
                                : html``}
                            <div class="description">${action.description}</div>
                        </div>`,
                )}
            </sl-details>
        `;
    }

    renderSpells() {
        const { spells } = this.data;
        if (!spells || spells.length === 0) {
            return html``;
        }
        return html`
            <sl-details summary="Spells">
                ${spells.map(
                    (spell) =>
                        html` <div class="spell-entry">
                            <div class="spell-name">${spell.name}</div>
                            <div class="spell-details">
                                ${spell.tradition
                                    ? html`
                                          <sl-tag class="spell-tradition"
                                              >${spell.tradition}</sl-tag
                                          >
                                      `
                                    : html``}
                                ${spell.rank !== undefined
                                    ? html` <span>Rank ${spell.rank}</span> `
                                    : html``}
                                ${spell.dc ? html` <span>DC ${spell.dc}</span> ` : html``}
                            </div>
                            <div class="description">${spell.description}</div>
                        </div>`,
                )}
            </sl-details>
        `;
    }

    renderAbilities() {
        const { abilities } = this.data;
        if (!abilities || abilities.length === 0) {
            return html``;
        }
        return html`
            <sl-details summary="Abilities">
                ${abilities.map(
                    (ability) =>
                        html` <div class="ability-entry">
                            <div class="ability-name">${ability.name}</div>
                            <div class="description">${ability.description}</div>
                        </div>`,
                )}
            </sl-details>
        `;
    }

    /**
     * @param {number | string | undefined | null} value
     * @returns {string}
     */
    formatModifier(value) {
        if (value === undefined || value === null) {
            return "-";
        }
        const numValue = typeof value === "string" ? parseInt(value, 10) : value;
        if (numValue >= 0) {
            return `+${value}`;
        }
        return `${value}`;
    }

    /**
     * @param {ActionType} type
     * @returns {string}
     */
    formatActionType(type) {
        /** @type {{ single: string; two: string; three: string; reaction: string; free: string }} */
        const types = {
            single: "⬤",
            two: "⬤⬤",
            three: "⬤⬤⬤",
            reaction: "⬢",
            free: "◯",
        };
        return types[/** @type {keyof typeof types} */ (type)] || "";
    }
}

const element = customElement("stat-block")(StatBlock);
export { element as StatBlock };
