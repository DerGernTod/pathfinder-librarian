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
 * Capitalizes the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a proficiency rank number to a label.
 * 0=untrained, 1=trained, 2=expert, 3=master, 4=legendary
 * @param {number} rank
 * @returns {string}
 */
function proficiencyLabel(rank) {
    const labels = ["Untrained", "Trained", "Expert", "Master", "Legendary"];
    return labels[rank] ?? `Rank ${rank}`;
}

/**
 * Converts a size code to a readable label.
 * @param {string} code
 * @returns {string}
 */
function sizeLabel(code) {
    const map = {
        tiny: "Tiny",
        sm: "Small",
        med: "Medium",
        lg: "Large",
        huge: "Huge",
        grg: "Gargantuan",
    };
    return /** @type {Record<string, string>} */ (map)[code] ?? capitalize(code);
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
 * Child item types (melee, action, spellcastingEntry, weapon, armor) get rich chunks
 * with parent context when a parent is provided.
 * @param {{ id: string, type: string, name: string, compendiumSource?: string, parentId?: string, data: unknown }} ruleItem
 * @param {{ name?: string, type?: string }} [parent]
 * @returns {VectorChunk[]}
 */
export function createChunksFromRuleItem(ruleItem, parent) {
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
    } else if (ruleItem.type === "melee") {
        const meleeData =
            /** @type {{ name?: string, attack?: string, damage?: string, damageType?: string, traits?: string[] }} */ (
                data
            );
        const prefix = parent ? `${parent.name}'s ` : "";
        const parts = [`Melee: ${prefix}${meleeData.name ?? ruleItem.name}`];
        if (meleeData.attack) {
            parts.push(`Attack ${meleeData.attack}`);
        }
        if (meleeData.damage) {
            parts.push(`Damage ${meleeData.damage}`);
        }
        if (meleeData.traits?.length) {
            parts.push(`Traits: ${meleeData.traits.join(", ")}`);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "action") {
        const actionData =
            /** @type {{ name?: string, actionType?: number | "reaction" | "free", traits?: string[], description?: string }} */ (
                data
            );
        const prefix = parent ? `${parent.name}'s ` : "";
        const parts = [
            `Action: ${prefix}${actionData.name ?? ruleItem.name} (${formatActionType(actionData.actionType)})`,
        ];
        if (actionData.traits?.length) {
            parts.push(`Traits: ${actionData.traits.join(", ")}`);
        }
        if (actionData.description) {
            parts.push(actionData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "spellcastingEntry") {
        const scData =
            /** @type {{ name?: string, tradition?: string, type?: string, dc?: number, attackModifier?: number }} */ (
                data
            );
        const prefix = parent ? `${parent.name}'s ` : "";
        texts.push(
            createSpellcastingChunk({
                ...scData,
                name: `${prefix}${scData.name ?? ruleItem.name}`,
            }),
        );
    } else if (ruleItem.type === "weapon") {
        const weaponData =
            /** @type {{ name?: string, level?: number, category?: string, group?: string, damage?: string, range?: number, reload?: number | string, bulk?: number, rarity?: string, traits?: string[], description?: string }} */ (
                data
            );
        const prefix = parent ? `${parent.name}'s ` : "";
        const parts = [`Weapon: ${prefix}${weaponData.name ?? ruleItem.name}`];
        if (weaponData.category) {
            parts.push(capitalize(weaponData.category));
        }
        if (weaponData.damage) {
            parts.push(`Damage: ${weaponData.damage}`);
        }
        if (weaponData.range) {
            parts.push(`Range ${weaponData.range} ft`);
        }
        if (weaponData.level) {
            parts.push(`Level ${weaponData.level}`);
        }
        if (weaponData.traits?.length) {
            parts.push(`Traits: ${weaponData.traits.join(", ")}`);
        }
        if (weaponData.description) {
            parts.push(weaponData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "armor") {
        const armorData =
            /** @type {{ name?: string, level?: number, category?: string, group?: string, acBonus?: number, checkPenalty?: number, dexCap?: number, speedPenalty?: number, strength?: number, bulk?: number, rarity?: string, traits?: string[], description?: string }} */ (
                data
            );
        const prefix = parent ? `${parent.name}'s ` : "";
        const parts = [`Armor: ${prefix}${armorData.name ?? ruleItem.name}`];
        if (armorData.category) {
            parts.push(capitalize(armorData.category));
        }
        if (armorData.acBonus) {
            parts.push(`AC +${armorData.acBonus}`);
        }
        if (armorData.dexCap) {
            parts.push(`Dex Cap +${armorData.dexCap}`);
        }
        if (armorData.checkPenalty) {
            parts.push(`Check Penalty ${armorData.checkPenalty}`);
        }
        if (armorData.speedPenalty) {
            parts.push(`Speed Penalty ${armorData.speedPenalty} ft`);
        }
        if (armorData.level) {
            parts.push(`Level ${armorData.level}`);
        }
        if (armorData.traits?.length) {
            parts.push(`Traits: ${armorData.traits.join(", ")}`);
        }
        if (armorData.description) {
            parts.push(armorData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "class") {
        const classData =
            /** @type {{ name?: string, description?: string, keyAbility?: string[], hp?: number, perception?: number, savingThrows?: { fortitude?: number, reflex?: number, will?: number }, attacks?: { simple?: number, martial?: number, advanced?: number, unarmed?: number }, defenses?: Record<string, number>, trainedSkills?: { value?: string[], additional?: number }, classFeatLevels?: number[], ancestryFeatLevels?: number[], generalFeatLevels?: number[], skillFeatLevels?: number[], skillIncreaseLevels?: number[], spellcasting?: number, classFeatures?: Array<{ level: number, name: string }> }} */ (
                data
            );
        const parts = [`Class: ${classData.name ?? ruleItem.name}`];
        if (classData.hp) {
            parts.push(`HP per level: ${classData.hp}`);
        }
        if (classData.keyAbility?.length) {
            parts.push(`Key Ability: ${classData.keyAbility.join(" or ")}`);
        }
        if (classData.perception) {
            parts.push(`Perception: ${proficiencyLabel(classData.perception)}`);
        }
        if (classData.savingThrows) {
            const saveParts = [];
            if (classData.savingThrows.fortitude) {
                saveParts.push(`Fort ${proficiencyLabel(classData.savingThrows.fortitude)}`);
            }
            if (classData.savingThrows.reflex) {
                saveParts.push(`Ref ${proficiencyLabel(classData.savingThrows.reflex)}`);
            }
            if (classData.savingThrows.will) {
                saveParts.push(`Will ${proficiencyLabel(classData.savingThrows.will)}`);
            }
            if (saveParts.length) {
                parts.push(`Saves: ${saveParts.join(", ")}`);
            }
        }
        if (classData.classFeatLevels?.length) {
            parts.push(`Class feats at levels: ${classData.classFeatLevels.join(", ")}`);
        }
        if (classData.trainedSkills) {
            if (classData.trainedSkills.value?.length) {
                parts.push(`Trained skills: ${classData.trainedSkills.value.join(", ")}`);
            }
            if (classData.trainedSkills.additional) {
                parts.push(`+${classData.trainedSkills.additional} additional skills`);
            }
        }
        if (classData.classFeatures?.length) {
            const featStr = classData.classFeatures.map((f) => `L${f.level} ${f.name}`).join(", ");
            parts.push(`Class features: ${featStr}`);
        }
        if (classData.description) {
            parts.push(classData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "ancestry") {
        const ancestryData =
            /** @type {{ name?: string, description?: string, hp?: number, size?: string, speed?: number, vision?: string, boosts?: Record<string, { value: string[] }>, flaws?: Record<string, { value: string[] }>, languages?: string[], additionalLanguages?: { count?: number, value?: string[] }, ancestryFeatures?: Array<{ level: number, name: string }>, rarity?: string, traits?: string[] }} */ (
                data
            );
        const parts = [`Ancestry: ${ancestryData.name ?? ruleItem.name}`];
        if (ancestryData.hp) {
            parts.push(`HP: ${ancestryData.hp}`);
        }
        if (ancestryData.size) {
            parts.push(`Size: ${sizeLabel(ancestryData.size)}`);
        }
        if (ancestryData.speed) {
            parts.push(`Speed: ${ancestryData.speed} ft`);
        }
        if (ancestryData.vision) {
            parts.push(`Vision: ${ancestryData.vision}`);
        }
        if (ancestryData.languages?.length) {
            parts.push(`Languages: ${ancestryData.languages.join(", ")}`);
        }
        if (ancestryData.ancestryFeatures?.length) {
            const featStr = ancestryData.ancestryFeatures
                .map((f) => `L${f.level} ${f.name}`)
                .join(", ");
            parts.push(`Features: ${featStr}`);
        }
        if (ancestryData.traits?.length) {
            parts.push(`Traits: ${ancestryData.traits.join(", ")}`);
        }
        if (ancestryData.description) {
            parts.push(ancestryData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "heritage") {
        const heritageData =
            /** @type {{ name?: string, description?: string, ancestry?: { name?: string }, traits?: string[] }} */ (
                data
            );
        const parts = [`Heritage: ${heritageData.name ?? ruleItem.name}`];
        if (heritageData.ancestry?.name) {
            parts.push(`Ancestry: ${heritageData.ancestry.name}`);
        }
        if (heritageData.traits?.length) {
            parts.push(`Traits: ${heritageData.traits.join(", ")}`);
        }
        if (heritageData.description) {
            parts.push(heritageData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "background") {
        const bgData =
            /** @type {{ name?: string, description?: string, boosts?: Record<string, { value: string[] }>, trainedSkills?: { value?: string[], lore?: string[] }, grantedItems?: Array<{ name: string }> }} */ (
                data
            );
        const parts = [`Background: ${bgData.name ?? ruleItem.name}`];
        if (bgData.trainedSkills) {
            const skills = [
                ...(bgData.trainedSkills.value ?? []),
                ...(bgData.trainedSkills.lore ?? []),
            ];
            if (skills.length) {
                parts.push(`Trained in: ${skills.join(", ")}`);
            }
        }
        if (bgData.grantedItems?.length) {
            parts.push(`Granted: ${bgData.grantedItems.map((i) => i.name).join(", ")}`);
        }
        if (bgData.description) {
            parts.push(bgData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "deity") {
        const deityData =
            /** @type {{ name?: string, description?: string, category?: string, attribute?: string[], domains?: { primary?: string[], alternate?: string[] }, font?: string[], sanctification?: { modal?: string, what?: string[] }, skill?: string[], spells?: Record<string, string>, weapons?: string[] }} */ (
                data
            );
        const parts = [`Deity: ${deityData.name ?? ruleItem.name}`];
        if (deityData.category) {
            parts.push(capitalize(deityData.category));
        }
        if (deityData.attribute?.length) {
            parts.push(`Divine Ability: ${deityData.attribute.join(", ")}`);
        }
        if (deityData.domains?.primary?.length) {
            parts.push(`Domains: ${deityData.domains.primary.join(", ")}`);
        }
        if (deityData.font?.length) {
            parts.push(`Font: ${deityData.font.join(", ")}`);
        }
        if (deityData.skill?.length) {
            parts.push(`Divine Skill: ${deityData.skill.join(", ")}`);
        }
        if (deityData.weapons?.length) {
            parts.push(`Favored Weapon: ${deityData.weapons.join(", ")}`);
        }
        if (deityData.description) {
            parts.push(deityData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "shield") {
        const shieldData =
            /** @type {{ name?: string, level?: number, acBonus?: number, hardness?: number, hp?: number, speedPenalty?: number, bulk?: number, traits?: string[], description?: string }} */ (
                data
            );
        const parts = [`Shield: ${shieldData.name ?? ruleItem.name}`];
        if (shieldData.acBonus) {
            parts.push(`AC +${shieldData.acBonus}`);
        }
        if (shieldData.hardness) {
            parts.push(`Hardness ${shieldData.hardness}`);
        }
        if (shieldData.hp) {
            parts.push(`HP ${shieldData.hp}`);
        }
        if (shieldData.speedPenalty) {
            parts.push(`Speed Penalty ${shieldData.speedPenalty} ft`);
        }
        if (shieldData.level) {
            parts.push(`Level ${shieldData.level}`);
        }
        if (shieldData.traits?.length) {
            parts.push(`Traits: ${shieldData.traits.join(", ")}`);
        }
        if (shieldData.description) {
            parts.push(shieldData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "consumable") {
        const consData =
            /** @type {{ name?: string, level?: number, category?: string, bulk?: number, rarity?: string, traits?: string[], description?: string }} */ (
                data
            );
        const parts = [`Consumable: ${consData.name ?? ruleItem.name}`];
        if (consData.category) {
            parts.push(capitalize(consData.category));
        }
        if (consData.level) {
            parts.push(`Level ${consData.level}`);
        }
        if (consData.traits?.length) {
            parts.push(`Traits: ${consData.traits.join(", ")}`);
        }
        if (consData.description) {
            parts.push(consData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "ammo") {
        const ammoData =
            /** @type {{ name?: string, level?: number, baseItem?: string, bulk?: number, traits?: string[], description?: string }} */ (
                data
            );
        const parts = [`Ammunition: ${ammoData.name ?? ruleItem.name}`];
        if (ammoData.level) {
            parts.push(`Level ${ammoData.level}`);
        }
        if (ammoData.traits?.length) {
            parts.push(`Traits: ${ammoData.traits.join(", ")}`);
        }
        if (ammoData.description) {
            parts.push(ammoData.description);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "hazard") {
        const hazData =
            /** @type {{ name?: string, level?: number, isComplex?: boolean, description?: string, disable?: string, routine?: string, ac?: number, hardness?: number, hp?: number, stealth?: number, saves?: { fortitude?: number, reflex?: number, will?: number }, traits?: string[] }} */ (
                data
            );
        const parts = [`Hazard: ${hazData.name ?? ruleItem.name}`];
        if (hazData.level) {
            parts.push(`Level ${hazData.level}`);
        }
        if (hazData.isComplex !== undefined) {
            parts.push(hazData.isComplex ? "Complex" : "Simple");
        }
        if (hazData.ac) {
            parts.push(`AC ${hazData.ac}`);
        }
        if (hazData.hp) {
            parts.push(`HP ${hazData.hp}`);
        }
        if (hazData.stealth) {
            parts.push(`Stealth DC ${hazData.stealth}`);
        }
        if (hazData.traits?.length) {
            parts.push(`Traits: ${hazData.traits.join(", ")}`);
        }
        if (hazData.description) {
            parts.push(hazData.description);
        }
        if (hazData.disable) {
            parts.push(`Disable: ${hazData.disable}`);
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "treasure") {
        const treasData =
            /** @type {{ name?: string, level?: number, category?: string }} */ (data);
        const parts = [`Treasure: ${treasData.name ?? ruleItem.name}`];
        if (treasData.category) {
            parts.push(capitalize(treasData.category));
        }
        texts.push(parts.join(". "));
    } else if (ruleItem.type === "backpack") {
        const bpData =
            /** @type {{ name?: string, level?: number, capacity?: number, bulk?: number, stowing?: boolean, traits?: string[], description?: string }} */ (
                data
            );
        const parts = [`Container: ${bpData.name ?? ruleItem.name}`];
        if (bpData.capacity) {
            parts.push(`Capacity ${bpData.capacity} Bulk`);
        }
        if (bpData.description) {
            parts.push(bpData.description);
        }
        texts.push(parts.join(". "));
    } else {
        // Generic fallback for unknown types
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
