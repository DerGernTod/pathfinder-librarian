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

/** @typedef {number | "reaction" | "free"} ActionType */
/** @typedef {{ name: string; description: string; actionType?: ActionType; traits?: string[] }} Action */
/** @typedef {{ name: string; attack: string; damage: string; damageType?: string; traits?: string[] }} MeleeEntry */
/** @typedef {{ name: string; tradition?: string; type?: string; dc?: number; attackModifier?: number; slots?: Record<string, { name: string; rank?: number }[]>; cantrips?: { name: string; rank?: number }[] }} SpellcastingEntry */

/**
 * @typedef {{
 *     name?: string;
 *     type?: string;
 *     level?: number;
 *     rarity?: string;
 *     traits?: string[];
 *     perception?: number | string;
 *     languages?: string | { value: string[]; details?: string };
 *     attributes?: {
 *         ac?: number | { value: number; details?: string };
 *         hp?: number | { value: number; max: number; details?: string };
 *         fortitude?: string | { value: number };
 *         reflex?: string | { value: number };
 *         will?: string | { value: number };
 *         speed?: string;
 *     };
 *     skills?: Record<string, string | { value: number }>;
 *     str?: number;
 *     dex?: number;
 *     con?: number;
 *     int?: number;
 *     wis?: number;
 *     cha?: number;
 *     abilities?: { str?: { mod: number }; dex?: { mod: number }; con?: { mod: number }; int?: { mod: number }; wis?: { mod: number }; cha?: { mod: number } };
 *     actions?: Action[];
 *     melee?: MeleeEntry[];
 *     spellcasting?: SpellcastingEntry[];
 *     spells?: { name: string; description: string; tradition?: string; rank?: number; dc?: number }[];
 * }} StatBlockData
 */

/**
 * @typedef {{
 *     name: string;
 *     type?: string;
 *     level?: number;
 *     rarity?: string;
 *     traits: string[];
 *     perception?: number;
 *     languages?: { value: string[]; details?: string };
 *     attributes?: {
 *         ac?: { value: number; details?: string };
 *         hp?: { value: number; max: number; details?: string };
 *         fortitude?: { value: number };
 *         reflex?: { value: number };
 *         will?: { value: number };
 *         speed?: string;
 *     };
 *     abilities?: {
 *         str?: { mod: number };
 *         dex?: { mod: number };
 *         con?: { mod: number };
 *         int?: { mod: number };
 *         wis?: { mod: number };
 *         cha?: { mod: number };
 *     };
 *     skills?: Record<string, { value: number }>;
 *     melee?: MeleeEntry[];
 *     spellcasting?: SpellcastingEntry[];
 *     actions?: Action[];
 *     description?: string;
 * }} NormalizedCreatureData
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
            .speed {
                font-size: 0.875rem;
                color: var(--muted-foreground);
            }
            .stat-details {
                font-size: 0.75rem;
                color: var(--muted-foreground);
                margin-left: 0.25rem;
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
        ruleItemId: { type: String },
    };

    constructor() {
        super();
        /** @type {string} */
        this.title = "";
        /** @type {StatBlockData} */
        this.data = {};
    }

    render() {
        const data = this.normalizeCreatureData(this.data);
        return html`
            <sl-details summary="View ${this.title} Stat Block">
                <sl-card style="width: 100%;">
                    ${this.renderHeader(data)}
                    <sl-divider></sl-divider>
                    ${this.renderPrimaryStats(data)}
                    <sl-divider></sl-divider>
                    ${this.renderSecondaryStats(data)}
                    <sl-divider></sl-divider>
                    ${this.renderDrillDowns(data)}
                </sl-card>
            </sl-details>
        `;
    }

    /**
     * @param {StatBlockData} raw
     * @returns {NormalizedCreatureData}
     */
    normalizeCreatureData(raw) {
        if (!raw) {
            return { name: "", traits: [] };
        }
        const attrs = raw.attributes;
        // If already new shape (ac is object or undefined), return as-is
        if (!attrs || typeof attrs.ac === "object") {
            /** @type {NormalizedCreatureData} */
            const result = {
                name: raw.name ?? "",
                type: raw.type,
                level: raw.level,
                rarity: raw.rarity,
                traits: raw.traits ?? [],
                perception:
                    typeof raw.perception === "string"
                        ? parseInt(raw.perception, 10) || 0
                        : raw.perception,
                languages: typeof raw.languages === "object" ? raw.languages : undefined,
                attributes: attrs
                    ? {
                          ac: typeof attrs.ac === "object" ? attrs.ac : undefined,
                          hp: typeof attrs.hp === "object" ? attrs.hp : undefined,
                          fortitude:
                              typeof attrs.fortitude === "object" ? attrs.fortitude : undefined,
                          reflex: typeof attrs.reflex === "object" ? attrs.reflex : undefined,
                          will: typeof attrs.will === "object" ? attrs.will : undefined,
                          speed: attrs.speed,
                      }
                    : undefined,
                abilities:
                    raw.abilities &&
                    typeof raw.abilities === "object" &&
                    "str" in raw.abilities &&
                    typeof raw.abilities.str === "object"
                        ? raw.abilities
                        : undefined,
                skills: raw.skills
                    ? typeof Object.values(raw.skills)[0] === "object"
                        ? /** @type {Record<string, { value: number }>} */ (raw.skills)
                        : Object.fromEntries(
                              Object.entries(raw.skills).map(([k, v]) => [
                                  k,
                                  { value: parseInt(/** @type {string} */ (v), 10) || 0 },
                              ]),
                          )
                    : undefined,
                melee: raw.melee,
                spellcasting: raw.spellcasting,
                actions: raw.actions
                    ? raw.actions.map((a) => ({
                          name: a.name,
                          actionType: a.actionType,
                          traits: a.traits,
                          description: a.description,
                      }))
                    : undefined,
            };
            return result;
        }
        // Old shape detected — convert
        return {
            name: raw.name ?? "",
            type: raw.type,
            level: raw.level,
            rarity: raw.rarity,
            traits: raw.traits ?? [],
            perception:
                typeof raw.perception === "string"
                    ? parseInt(raw.perception, 10) || 0
                    : raw.perception,
            languages:
                typeof raw.languages === "string"
                    ? { value: raw.languages.split(",").map((s) => s.trim()) }
                    : raw.languages,
            attributes: {
                ac: typeof attrs.ac === "number" ? { value: attrs.ac } : undefined,
                hp: typeof attrs.hp === "number" ? { value: attrs.hp, max: attrs.hp } : undefined,
                fortitude:
                    typeof attrs.fortitude === "string"
                        ? { value: parseInt(attrs.fortitude, 10) || 0 }
                        : undefined,
                reflex:
                    typeof attrs.reflex === "string"
                        ? { value: parseInt(attrs.reflex, 10) || 0 }
                        : undefined,
                will:
                    typeof attrs.will === "string"
                        ? { value: parseInt(attrs.will, 10) || 0 }
                        : undefined,
            },
            abilities: {
                str: typeof raw.str === "number" ? { mod: raw.str } : undefined,
                dex: typeof raw.dex === "number" ? { mod: raw.dex } : undefined,
                con: typeof raw.con === "number" ? { mod: raw.con } : undefined,
                int: typeof raw.int === "number" ? { mod: raw.int } : undefined,
                wis: typeof raw.wis === "number" ? { mod: raw.wis } : undefined,
                cha: typeof raw.cha === "number" ? { mod: raw.cha } : undefined,
            },
            skills: raw.skills
                ? Object.fromEntries(
                      Object.entries(raw.skills).map(([k, v]) => [
                          k,
                          { value: parseInt(/** @type {string} */ (v), 10) || 0 },
                      ]),
                  )
                : undefined,
            actions: raw.actions
                ? raw.actions.map((a) => ({
                      name: a.name,
                      actionType: this._normalizeActionType(a.actionType),
                      description: a.description,
                  }))
                : undefined,
            spellcasting: raw.spells?.length
                ? [
                      {
                          name: "Spells",
                          cantrips: raw.spells.map((s) => ({ name: s.name, rank: s.rank })),
                      },
                  ]
                : undefined,
        };
    }

    /**
     * Maps old string actionType to new numeric/string values.
     * Old: "single"→1, "two"→2, "three"→3, "reaction"→"reaction", "free"→"free"
     * @param {unknown} type
     * @returns {ActionType | undefined}
     */
    _normalizeActionType(type) {
        if (type === undefined || type === null) {
            return undefined;
        }
        /** @type {Record<string, ActionType>} */
        const oldMap = { single: 1, two: 2, three: 3, reaction: "reaction", free: "free" };
        if (typeof type === "string" && type in oldMap) {
            return oldMap[type];
        }
        return /** @type {ActionType} */ (type);
    }

    /**
     * @param {NormalizedCreatureData} data
     */
    renderHeader(data) {
        const { name, type, level, rarity, traits } = data;
        return html`
            <div class="header">
                <h3>${name || "Unknown"}</h3>
                <div class="type-level">
                    ${rarity ? html`<sl-tag size="small" variant="warning">${rarity}</sl-tag>` : ""}
                    ${type || ""} ${level !== undefined ? level : ""}
                </div>
                <div class="traits">
                    ${(traits || []).map((trait) => html` <sl-tag>${trait}</sl-tag> `)}
                </div>
            </div>
        `;
    }

    /**
     * @param {NormalizedCreatureData} data
     */
    renderPrimaryStats(data) {
        const { attributes, perception, languages } = data;
        if (!attributes) {
            return html``;
        }
        const acValue = attributes.ac;
        const hpValue = attributes.hp;
        return html`
            <div class="primary-stats">
                <div class="defense-grid">
                    <div class="stat-box">
                        <div class="stat-label">Armor Class</div>
                        <div class="stat-value ac-value">
                            ${acValue ? acValue.value : "-"}${acValue?.details
                                ? html` <span class="stat-details">${acValue.details}</span>`
                                : ""}
                        </div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-label">Hit Points</div>
                        <div class="stat-value hp-value">
                            ${hpValue ? `${hpValue.value}/${hpValue.max}` : "-"}${hpValue?.details
                                ? html` <span class="stat-details">${hpValue.details}</span>`
                                : ""}
                        </div>
                    </div>
                </div>
                <div class="saves-grid">
                    <div class="save save-fort">
                        <span>Fort ${this.formatModifier(attributes.fortitude?.value)}</span>
                    </div>
                    <div class="save save-ref">
                        <span>Ref ${this.formatModifier(attributes.reflex?.value)}</span>
                    </div>
                    <div class="save save-will">
                        <span>Will ${this.formatModifier(attributes.will?.value)}</span>
                    </div>
                </div>
                <div class="perception-languages">
                    <div class="perception">Perception ${this.formatModifier(perception)}</div>
                    ${attributes.speed
                        ? html`<div class="speed">Speed ${attributes.speed}</div>`
                        : ""}
                    <div class="languages">
                        Languages: ${languages ? languages.value.join(", ") : "-"}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * @param {NormalizedCreatureData} data
     */
    renderSecondaryStats(data) {
        const abilities = data.abilities;
        const skills = data.skills;
        const abilityScores = [
            { name: "STR", value: abilities?.str?.mod },
            { name: "DEX", value: abilities?.dex?.mod },
            { name: "CON", value: abilities?.con?.mod },
            { name: "INT", value: abilities?.int?.mod },
            { name: "WIS", value: abilities?.wis?.mod },
            { name: "CHA", value: abilities?.cha?.mod },
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
                              ([name, skillVal]) =>
                                  html` <div class="skill-entry">
                                      ${name} ${this.formatModifier(skillVal.value)}
                                  </div>`,
                          )
                        : html``}
                </div>
            </div>
        `;
    }

    /**
     * @param {NormalizedCreatureData} data
     */
    renderDrillDowns(data) {
        return html`
            <div class="drill-downs">
                ${this.renderMelee(data)} ${this.renderSpellcasting(data)}
                ${this.renderActions(data)}
            </div>
        `;
    }

    /**
     * @param {NormalizedCreatureData} data
     */
    renderMelee(data) {
        const melee = data.melee;
        if (!melee || melee.length === 0) {
            return html``;
        }
        return html`
            <sl-details summary="Melee Strikes">
                ${melee.map(
                    (strike) => html`
                        <div class="action-entry">
                            <div class="action-name">${strike.name}</div>
                            <div class="action-type">${strike.attack}</div>
                            <div class="description">
                                ${strike.damage}${strike.damageType ? ` ${strike.damageType}` : ""}
                            </div>
                            ${strike.traits?.length
                                ? html`<div class="traits" style="margin-top:0.25rem">
                                      ${strike.traits.map(
                                          (t) => html`<sl-tag size="small">${t}</sl-tag>`,
                                      )}
                                  </div>`
                                : ""}
                        </div>
                    `,
                )}
            </sl-details>
        `;
    }

    /**
     * @param {NormalizedCreatureData} data
     */
    renderSpellcasting(data) {
        const spellcasting = data.spellcasting;
        if (!spellcasting || spellcasting.length === 0) {
            return html``;
        }
        return html`
            <sl-details summary="Spellcasting">
                ${spellcasting.map(
                    (entry) => html`
                        <div class="spell-entry" style="margin-bottom:0.75rem">
                            <div class="spell-name">${entry.name}</div>
                            <div class="spell-details">
                                ${entry.tradition
                                    ? html`<sl-tag class="spell-tradition" size="small"
                                          >${entry.tradition}</sl-tag
                                      >`
                                    : ""}
                                ${entry.type ? html`<span> ${entry.type}</span>` : ""}
                                ${entry.dc ? html`<span> DC ${entry.dc}</span>` : ""}
                                ${entry.attackModifier !== undefined
                                    ? html`<span>
                                          attack ${this.formatModifier(entry.attackModifier)}</span
                                      >`
                                    : ""}
                            </div>
                            ${entry.cantrips?.length
                                ? html`
                                      <div style="margin-top:0.25rem">
                                          <strong>Cantrips:</strong>
                                          ${entry.cantrips.map((s) => s.name).join(", ")}
                                      </div>
                                  `
                                : ""}
                            ${entry.slots
                                ? Object.entries(entry.slots).map(
                                      ([rank, spells]) => html`
                                          <div style="margin-top:0.25rem">
                                              <strong>${rank}:</strong>
                                              ${spells.map((s) => s.name).join(", ")}
                                          </div>
                                      `,
                                  )
                                : ""}
                        </div>
                    `,
                )}
            </sl-details>
        `;
    }

    /**
     * @param {NormalizedCreatureData} data
     */
    renderActions(data) {
        const { actions } = data;
        if (!actions || actions.length === 0) {
            return html``;
        }
        return html`
            <sl-details summary="Actions">
                ${actions.map(
                    (action) =>
                        html` <div class="action-entry">
                            <div class="action-name">
                                ${this.formatActionType(action.actionType)} ${action.name}
                            </div>
                            ${action.traits?.length
                                ? html`<div
                                      class="traits"
                                      style="margin-top:0.25rem;margin-bottom:0.25rem"
                                  >
                                      ${action.traits.map(
                                          (t) => html`<sl-tag size="small">${t}</sl-tag>`,
                                      )}
                                  </div>`
                                : ""}
                            <div class="description">${action.description}</div>
                        </div>`,
                )}
            </sl-details>
        `;
    }

    /**
     * @param {number | { mod: number } | string | undefined | null} value
     * @returns {string}
     */
    formatModifier(value) {
        if (value === undefined || value === null) {
            return "-";
        }
        // Handle new { mod: number } shape
        if (typeof value === "object" && "mod" in value) {
            return value.mod >= 0 ? `+${value.mod}` : `${value.mod}`;
        }
        // Handle old bare number or string
        const numValue = typeof value === "string" ? parseInt(value, 10) : value;
        if (numValue >= 0) {
            return `+${numValue}`;
        }
        return `${numValue}`;
    }

    /**
     * @param {unknown} type
     * @returns {string}
     */
    formatActionType(type) {
        if (type === undefined || type === null) {
            return "";
        }
        // Map old string values (backward compat for historical data)
        const oldMap = { single: "⬤", two: "⬤⬤", three: "⬤⬤⬤" };
        if (typeof type === "string" && oldMap[/** @type {keyof typeof oldMap} */ (type)]) {
            return oldMap[/** @type {keyof typeof oldMap} */ (type)];
        }

        // New numeric/string values
        const actionSymbols = {
            0: "◯",
            1: "⬤",
            2: "⬤⬤",
            3: "⬤⬤⬤",
            reaction: "⬢",
            free: "◯",
        };
        return actionSymbols[/** @type {keyof typeof actionSymbols} */ (type)] ?? "";
    }
}

const element = customElement("stat-block")(StatBlock);
export { element as StatBlock };
