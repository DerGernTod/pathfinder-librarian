/**
 * @typedef {{ id: string, ruleItemId: string, ruleItemName: string, ruleItemType: string, compendiumSource: string | undefined, chunkIndex: number, text: string }} VectorChunk
 */

/**
 * Formats a number with a sign prefix (+ or -).
 * @param {number} value
 * @returns {string}
 */
function signedNum(value) {
    return value >= 0 ? `+${value}` : String(value);
}

/**
 * Formats an action type as a human-readable string.
 * @param {number | "reaction" | "free" | undefined} actionType
 * @returns {string}
 */
function formatActionType(actionType) {
    if (actionType === "reaction") {
        return "Reaction";
    }
    if (actionType === "free") {
        return "Free Action";
    }
    if (typeof actionType === "number") {
        if (actionType === 0) {
            return "Passive";
        }
        return `${actionType}-Action`;
    }
    return "Passive";
}

/**
 * Creates a summary text chunk for a creature.
 * Includes name, level, traits, AC, HP, saves, perception, speed, skills, abilities.
 * @param {import("../../shared/types.js").CreatureData} data
 * @returns {string}
 */
export function createCreatureSummaryChunk(data) {
    /** @type {string[]} */
    const parts = [];

    parts.push(`Creature: ${data.name} (Level ${data.level})`);

    if (data.traits && data.traits.length > 0) {
        parts.push(`Traits: ${data.traits.join(", ")}`);
    }

    if (data.rarity) {
        parts.push(`Rarity: ${data.rarity}`);
    }

    if (data.attributes) {
        if (data.attributes.ac) {
            parts.push(
                `AC ${data.attributes.ac.value}${data.attributes.ac.details ? ` (${data.attributes.ac.details})` : ""}`,
            );
        }
        if (data.attributes.hp) {
            parts.push(
                `HP ${data.attributes.hp.max}${data.attributes.hp.details ? ` (${data.attributes.hp.details})` : ""}`,
            );
        }
        if (data.attributes.fortitude) {
            parts.push(`Fort ${signedNum(data.attributes.fortitude.value)}`);
        }
        if (data.attributes.reflex) {
            parts.push(`Ref ${signedNum(data.attributes.reflex.value)}`);
        }
        if (data.attributes.will) {
            parts.push(`Will ${signedNum(data.attributes.will.value)}`);
        }
        if (data.attributes.speed) {
            parts.push(`Speed ${data.attributes.speed}`);
        }
    }

    if (data.perception !== undefined) {
        parts.push(`Perception ${signedNum(data.perception)}`);
    }

    if (data.abilities) {
        const abilityParts = [];
        if (data.abilities.str) {
            abilityParts.push(`STR ${signedNum(data.abilities.str.mod)}`);
        }
        if (data.abilities.dex) {
            abilityParts.push(`DEX ${signedNum(data.abilities.dex.mod)}`);
        }
        if (data.abilities.con) {
            abilityParts.push(`CON ${signedNum(data.abilities.con.mod)}`);
        }
        if (data.abilities.int) {
            abilityParts.push(`INT ${signedNum(data.abilities.int.mod)}`);
        }
        if (data.abilities.wis) {
            abilityParts.push(`WIS ${signedNum(data.abilities.wis.mod)}`);
        }
        if (data.abilities.cha) {
            abilityParts.push(`CHA ${signedNum(data.abilities.cha.mod)}`);
        }
        if (abilityParts.length > 0) {
            parts.push(abilityParts.join(", "));
        }
    }

    if (data.skills) {
        const skillParts = Object.entries(data.skills).map(
            ([name, val]) => `${name} ${signedNum(val.value)}`,
        );
        parts.push(`Skills: ${skillParts.join(", ")}`);
    }

    if (data.languages) {
        parts.push(
            `Languages: ${data.languages.value.join(", ")}${data.languages.details ? ` (${data.languages.details})` : ""}`,
        );
    }

    if (data.description) {
        parts.push(data.description);
    }

    return parts.join(". ");
}

/**
 * Creates text chunks for each action in a creature.
 * @param {import("../../shared/types.js").CreatureData} data
 * @returns {string[]}
 */
export function createActionChunks(data) {
    if (!data.actions || data.actions.length === 0) {
        return [];
    }

    /** @type {string[]} */
    const chunks = [];

    for (const action of data.actions) {
        if (!action.description) {
            continue;
        }
        const parts = [`Action: ${action.name} (${formatActionType(action.actionType)})`];
        if (action.traits && action.traits.length > 0) {
            parts.push(`Traits: ${action.traits.join(", ")}`);
        }
        parts.push(action.description);
        chunks.push(parts.join(". "));
    }

    return chunks;
}

/**
 * Creates a text chunk for a melee attack.
 * @param {{ name: string, attack?: string, damage?: string, traits?: string[] }} melee
 * @returns {string}
 */
function createMeleeChunk(melee) {
    const parts = [`Melee: ${melee.name}`];
    if (melee.attack) {
        parts.push(`Attack ${melee.attack}`);
    }
    if (melee.damage) {
        parts.push(`Damage ${melee.damage}`);
    }
    if (melee.traits && melee.traits.length > 0) {
        parts.push(`Traits: ${melee.traits.join(", ")}`);
    }
    return parts.join(". ");
}

/**
 * Creates a text chunk for a spellcasting entry.
 * @param {{ name: string, tradition?: string, dc?: number, attackModifier?: number }} entry
 * @returns {string}
 */
function createSpellcastingChunk(entry) {
    const parts = [`Spellcasting: ${entry.name}`];
    if (entry.tradition) {
        parts.push(`Tradition: ${entry.tradition}`);
    }
    if (entry.dc) {
        parts.push(`DC ${entry.dc}`);
    }
    if (entry.attackModifier) {
        parts.push(`Attack +${entry.attackModifier}`);
    }
    return parts.join(". ");
}

/**
 * Creates a text chunk for a spell.
 * @param {unknown} rawData - Spell data
 * @returns {string}
 */
export function createSpellChunk(rawData) {
    const data = /** @type {Record<string, unknown>} */ (rawData);
    /** @type {string[]} */
    const parts = [];

    parts.push(`Spell: ${String(data.name ?? "Unknown")} (Rank ${String(data.level ?? 0)})`);

    if (data.traditions && Array.isArray(data.traditions)) {
        parts.push(`Traditions: ${data.traditions.join(", ")}`);
    }
    if (data.cast) {
        parts.push(`Cast: ${String(data.cast)}`);
    }
    if (data.range) {
        parts.push(`Range: ${String(data.range)}`);
    }
    if (data.area) {
        parts.push(`Area: ${String(data.area)}`);
    }
    if (data.savingThrow) {
        parts.push(`Saving Throw: ${String(data.savingThrow)}`);
    }
    if (data.traits && Array.isArray(data.traits)) {
        parts.push(`Traits: ${data.traits.join(", ")}`);
    }
    if (data.description) {
        parts.push(String(data.description));
    }

    return parts.join(". ");
}

/**
 * Creates a text chunk for equipment.
 * @param {unknown} rawData
 * @returns {string}
 */
function createEquipmentChunk(rawData) {
    const data = /** @type {Record<string, unknown>} */ (rawData);
    /** @type {string[]} */
    const parts = [];

    parts.push(`Equipment: ${String(data.name ?? "Unknown")} (Level ${String(data.level ?? 0)})`);

    if (data.price) {
        parts.push(`Price: ${String(data.price)}`);
    }
    if (data.traits && Array.isArray(data.traits)) {
        parts.push(`Traits: ${data.traits.join(", ")}`);
    }
    if (data.description) {
        parts.push(String(data.description));
    }

    return parts.join(". ");
}

/**
 * Creates a text chunk for a feat.
 * @param {unknown} rawData
 * @returns {string}
 */
function createFeatChunk(rawData) {
    const data = /** @type {Record<string, unknown>} */ (rawData);
    /** @type {string[]} */
    const parts = [];

    parts.push(`Feat: ${String(data.name ?? "Unknown")} (Level ${String(data.level ?? 0)})`);

    if (data.actionType !== undefined) {
        parts.push(
            `Type: ${formatActionType(/** @type {number | "reaction" | "free"} */ (data.actionType))}`,
        );
    }
    if (data.traits && Array.isArray(data.traits)) {
        parts.push(`Traits: ${data.traits.join(", ")}`);
    }
    if (data.prerequisites) {
        parts.push(`Prerequisites: ${String(data.prerequisites)}`);
    }
    if (data.description) {
        parts.push(String(data.description));
    }

    return parts.join(". ");
}

/**
 * Creates text chunks from a rule item for vector embedding.
 * Creatures get multiple chunks (stat block summary, each action/melee/spell section).
 * Spells, equipment, feats get a single chunk each.
 * @param {{ id: string, type: string, name: string, compendiumSource?: string, data: unknown }} ruleItem
 * @returns {VectorChunk[]}
 */
export function createChunksFromRuleItem(ruleItem) {
    /** @type {string[]} */
    const texts = [];

    const data = /** @type {Record<string, unknown>} */ (ruleItem.data);

    if (ruleItem.type === "creature") {
        const creatureData = /** @type {import("../../shared/types.js").CreatureData} */ (data);
        texts.push(createCreatureSummaryChunk(creatureData));
        texts.push(...createActionChunks(creatureData));

        // Melee chunks
        if (Array.isArray(creatureData.melee)) {
            for (const melee of creatureData.melee) {
                texts.push(createMeleeChunk(melee));
            }
        }

        // Spellcasting chunks
        if (Array.isArray(creatureData.spellcasting)) {
            for (const entry of creatureData.spellcasting) {
                texts.push(createSpellcastingChunk(entry));
            }
        }
    } else if (ruleItem.type === "spell") {
        texts.push(createSpellChunk(data));
    } else if (ruleItem.type === "equipment") {
        texts.push(createEquipmentChunk(data));
    } else if (ruleItem.type === "feat") {
        texts.push(createFeatChunk(data));
    } else {
        // Generic chunk for other types
        texts.push(`${ruleItem.type}: ${ruleItem.name}`);
    }

    return texts.map((text, index) => ({
        id: `${ruleItem.id}-chunk-${index}`,
        ruleItemId: ruleItem.id,
        ruleItemName: ruleItem.name,
        ruleItemType: ruleItem.type,
        compendiumSource: ruleItem.compendiumSource,
        chunkIndex: index,
        text,
    }));
}
