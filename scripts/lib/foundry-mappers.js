/**
 * @typedef {{ type: string, name: string, compendiumSource: string, dataJson: string, parentId?: string, itemRefs?: string[] }} ImportableRuleItem
 */

/**
 * Builds a compendium source UUID from Foundry pack name and item _id.
 * @param {string} packName
 * @param {string} itemId
 * @returns {string}
 */
export function buildCompendiumSource(packName, itemId) {
    return `Compendium.pf2e.${packName}.Item.${itemId}`;
}

/**
 * Strips HTML tags from a string.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
    return html
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
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
 * Determines the Foundry document type from a pack directory name.
 * @param {string} dirName - e.g. "pathfinder-bestiary", "spells", "equipment"
 * @returns {"creature" | "spell" | "equipment" | "feat" | "action" | "effect" | "condition" | "mixed"}
 */
export function classifyPackDirectory(dirName) {
    // Order matters: more specific patterns first
    if (/^bestiary-ability-glossary/i.test(dirName)) {
        return "action";
    }
    // All effect packs: bestiary-effects, campaign-effects, equipment-effects,
    // feat-effects, other-effects, spell-effects — must precede bestiary check
    if (/-effects$/i.test(dirName)) {
        return "effect";
    }
    if (/bestiary|monster-core|npc-gallery/i.test(dirName)) {
        return "creature";
    }
    if (/^spells/i.test(dirName)) {
        return "spell";
    }
    if (/^equipment/i.test(dirName)) {
        return "equipment";
    }
    if (/^feats/i.test(dirName)) {
        return "feat";
    }
    if (/^actions/i.test(dirName)) {
        return "action";
    }
    if (/^conditions$/i.test(dirName)) {
        return "condition";
    }
    return "mixed";
}

/**
 * Maps action type from Foundry format to our format.
 * @param {string} actionType - Foundry actionType.value
 * @param {number} actionsValue - Foundry actions.value
 * @returns {number | "reaction" | "free"}
 */
function mapActionType(actionType, actionsValue) {
    if (actionType === "reaction") {
        return "reaction";
    }
    if (actionType === "free") {
        return "free";
    }
    // "action" or "passive" — use actions.value as the number
    return actionsValue || 0;
}

/**
 * Extracts embedded items from a creature's `items[]` array.
 * Returns separate rule items for melee, action, spellcastingEntry, etc.
 * @param {Array<unknown>} items
 * @param {string} creatureSource - Compendium source of the parent creature
 * @returns {{ embeddedItems: ImportableRuleItem[], itemRefs: string[] }}
 */
export function extractEmbeddedItems(items, creatureSource) {
    /** @type {ImportableRuleItem[]} */
    const embeddedItems = [];
    /** @type {string[]} */
    const itemRefs = [];

    if (!Array.isArray(items)) {
        return { embeddedItems, itemRefs };
    }

    for (const item of items) {
        const typed =
            /** @type {{ _id?: string, name?: string, type?: string, system?: unknown }} */ (item);
        if (!typed._id || !typed.type) {
            continue;
        }

        const itemSource = buildCompendiumSource(
            creatureSource.replace("Compendium.pf2e.", "").replace(/\.Item\..*$/, ""),
            typed._id,
        );
        const sys = /** @type {Record<string, unknown>} */ (typed.system ?? {});

        if (typed.type === "melee") {
            const meleeSys =
                /** @type {{ bonus?: { value: number }, damageRolls?: Record<string, { damage: string, damageType: string }>, traits?: { value: string[] } }} */ (
                    sys
                );
            const damageEntries = meleeSys.damageRolls ?? {};
            const damageParts = Object.values(damageEntries).map(
                (d) => `${d.damage} ${d.damageType}`,
            );
            embeddedItems.push({
                type: "melee",
                name: typed.name ?? "Unnamed Melee",
                compendiumSource: itemSource,
                parentId: creatureSource,
                dataJson: JSON.stringify({
                    name: typed.name ?? "Unnamed Melee",
                    attack: `+${meleeSys.bonus?.value ?? 0}`,
                    damage: damageParts.join(" plus "),
                    traits: meleeSys.traits?.value ?? [],
                    compendiumSource: itemSource,
                }),
            });
            itemRefs.push(itemSource);
        } else if (typed.type === "action") {
            const actionSys =
                /** @type {{ actionType?: { value: string }, actions?: { value: number }, description?: { value: string }, traits?: { value: string[] } }} */ (
                    sys
                );
            const description = stripHtml(
                typeof actionSys.description?.value === "string" ? actionSys.description.value : "",
            );
            embeddedItems.push({
                type: "action",
                name: typed.name ?? "Unnamed Action",
                compendiumSource: itemSource,
                parentId: creatureSource,
                dataJson: JSON.stringify({
                    name: typed.name ?? "Unnamed Action",
                    actionType: mapActionType(
                        actionSys.actionType?.value ?? "passive",
                        actionSys.actions?.value ?? 0,
                    ),
                    traits: actionSys.traits?.value ?? [],
                    description,
                    compendiumSource: itemSource,
                }),
            });
            itemRefs.push(itemSource);
        } else if (typed.type === "spellcastingEntry") {
            const scSys =
                /** @type {{ tradition?: { value: string }, type?: { value: string }, dc?: { value: number }, attackBonus?: { value: number }, slots?: Record<string, unknown>, cantrips?: { value: string[] }, spellcasting?: { ability?: { value: string } } }} */ (
                    sys
                );
            embeddedItems.push({
                type: "spellcastingEntry",
                name: typed.name ?? "Spellcasting",
                compendiumSource: itemSource,
                parentId: creatureSource,
                dataJson: JSON.stringify({
                    name: typed.name ?? "Spellcasting",
                    tradition: scSys.tradition?.value,
                    type: scSys.type?.value,
                    dc: scSys.dc?.value,
                    attackModifier: scSys.attackBonus?.value,
                    compendiumSource: itemSource,
                }),
            });
            itemRefs.push(itemSource);
        } else if (typed.type === "weapon") {
            embeddedItems.push({
                type: "weapon",
                name: typed.name ?? "Unnamed Weapon",
                compendiumSource: itemSource,
                parentId: creatureSource,
                dataJson: JSON.stringify({
                    name: typed.name ?? "Unnamed Weapon",
                    compendiumSource: itemSource,
                }),
            });
            itemRefs.push(itemSource);
        } else if (typed.type === "armor") {
            embeddedItems.push({
                type: "armor",
                name: typed.name ?? "Unnamed Armor",
                compendiumSource: itemSource,
                parentId: creatureSource,
                dataJson: JSON.stringify({
                    name: typed.name ?? "Unnamed Armor",
                    compendiumSource: itemSource,
                }),
            });
            itemRefs.push(itemSource);
        }
        // Skip other types (effect, etc.)
    }

    return { embeddedItems, itemRefs };
}

/**
 * Maps a Foundry NPC JSON to an array of importable rule items.
 * Returns the creature item + all extracted embedded items.
 * @param {unknown} rawJson - The parsed Foundry JSON
 * @param {string} packName - e.g. "pathfinder-bestiary"
 * @returns {ImportableRuleItem[]}
 */
export function mapCreature(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, type?: string, system?: Record<string, unknown>, items?: Array<unknown> }} */ (
            rawJson
        );
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const abilities = /** @type {Record<string, { mod: number }>} */ (sys.abilities ?? {});
    const attributes = /** @type {Record<string, unknown>} */ (sys.attributes ?? {});
    const ac = /** @type {{ value?: number, details?: string } | undefined } */ (attributes.ac);
    const hp =
        /** @type {{ value?: number, max?: number, details?: string } | undefined } */ (
            attributes.hp
        );
    const speed =
        /** @type {{ value?: number, otherSpeeds?: Array<{ type: string, value: number }> } | undefined } */ (
            attributes.speed
        );
    const details = /** @type {Record<string, unknown>} */ (sys.details ?? {});
    const levelObj = /** @type {{ value?: number } | undefined } */ (details.level);
    const langs =
        /** @type {{ value?: string[], details?: string } | undefined } */ (details.languages);
    const pubNotes = /** @type {string | undefined } */ (
        typeof details.publicNotes === "string" ? details.publicNotes : undefined
    );
    const saves = /** @type {Record<string, { value?: number }>} */ ({
        fortitude: /** @type {{ value?: number } | undefined } */ (attributes.fortitude),
        reflex: /** @type {{ value?: number } | undefined } */ (attributes.reflex),
        will: /** @type {{ value?: number } | undefined } */ (attributes.will),
    });
    const perception = /** @type {{ mod?: number } | undefined } */ (sys.perception);
    const skills = /** @type {Record<string, { base?: number }>} */ (sys.skills ?? {});
    const traits = /** @type {{ value?: string[], rarity?: string } | undefined } */ (sys.traits);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    // Extract embedded items
    const { embeddedItems, itemRefs } = extractEmbeddedItems(raw.items ?? [], compendiumSource);

    // Build speed string
    let speedStr = "";
    if (speed) {
        speedStr = `${speed.value ?? 0} feet`;
        if (Array.isArray(speed.otherSpeeds)) {
            for (const other of speed.otherSpeeds) {
                speedStr += `, ${other.type} ${other.value} feet`;
            }
        }
    }

    // Build mapped skills
    const mappedSkills = /** @type {Record<string, { value: number }>} */ ({});
    for (const [key, val] of Object.entries(skills)) {
        if (val && typeof val.base === "number") {
            mappedSkills[capitalize(key)] = { value: val.base };
        }
    }

    const creatureData = {
        name: raw.name ?? "Unknown Creature",
        type: "NPC",
        level: levelObj?.value ?? 0,
        rarity: traits?.rarity,
        traits: (traits?.value ?? []).map((t) => capitalize(t)),
        perception: perception?.mod,
        languages: langs ? { value: langs.value ?? [], details: langs.details } : undefined,
        attributes: {
            ac: ac ? { value: ac.value ?? 0, details: ac.details } : undefined,
            hp: hp ? { value: hp.max ?? 0, max: hp.max ?? 0, details: hp.details } : undefined,
            fortitude: saves.fortitude ? { value: saves.fortitude.value ?? 0 } : undefined,
            reflex: saves.reflex ? { value: saves.reflex.value ?? 0 } : undefined,
            will: saves.will ? { value: saves.will.value ?? 0 } : undefined,
            speed: speedStr || undefined,
        },
        abilities: {
            str: abilities.str ? { mod: abilities.str.mod } : undefined,
            dex: abilities.dex ? { mod: abilities.dex.mod } : undefined,
            con: abilities.con ? { mod: abilities.con.mod } : undefined,
            int: abilities.int ? { mod: abilities.int.mod } : undefined,
            wis: abilities.wis ? { mod: abilities.wis.mod } : undefined,
            cha: abilities.cha ? { mod: abilities.cha.mod } : undefined,
        },
        skills: Object.keys(mappedSkills).length > 0 ? mappedSkills : undefined,
        description: pubNotes ? stripHtml(pubNotes) : undefined,
        compendiumSource,
        itemRefs,
    };

    const creatureItem = /** @type {ImportableRuleItem} */ ({
        type: "creature",
        name: raw.name ?? "Unknown Creature",
        compendiumSource,
        dataJson: JSON.stringify(creatureData),
    });

    return [creatureItem, ...embeddedItems];
}

/**
 * Maps a Foundry spell JSON to an importable rule item.
 * @param {unknown} rawJson - The parsed Foundry JSON
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapSpell(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const traditions = /** @type {{ value?: string[] } | undefined } */ (sys.traditions);
    const cast = /** @type {{ value?: string } | undefined } */ (sys.cast);
    const range = /** @type {{ value?: string } | undefined } */ (sys.range);
    const area = /** @type {{ value?: number, type?: string } | undefined } */ (sys.area);
    const savingThrow = /** @type {{ value?: string } | undefined } */ (sys.savingThrow);
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const traits = /** @type {{ value?: string[] } | undefined } */ (sys.traits);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    let areaStr = "";
    if (area) {
        areaStr = area.type ? `${area.value}-foot ${area.type}` : String(area.value ?? "");
    }

    return {
        type: "spell",
        name: raw.name ?? "Unknown Spell",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Spell",
            level: level?.value ?? 0,
            traditions: traditions?.value ?? [],
            cast: cast?.value ?? "",
            range: range?.value ?? "",
            area: areaStr || undefined,
            savingThrow: savingThrow?.value ? capitalize(savingThrow.value) : undefined,
            description: description?.value ? stripHtml(description.value) : "",
            traits: traits?.value ?? [],
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry equipment JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapEquipment(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const price = /** @type {{ value?: Record<string, number> } | undefined } */ (sys.price);
    const traits = /** @type {{ value?: string[] } | undefined } */ (sys.traits);
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    // Format price
    let priceStr = "";
    if (price?.value) {
        const parts = [];
        if (price.value.pp) {
            parts.push(`${price.value.pp} pp`);
        }
        if (price.value.gp) {
            parts.push(`${price.value.gp} gp`);
        }
        if (price.value.sp) {
            parts.push(`${price.value.sp} sp`);
        }
        if (price.value.cp) {
            parts.push(`${price.value.cp} cp`);
        }
        priceStr = parts.join(", ");
    }

    return {
        type: "equipment",
        name: raw.name ?? "Unknown Equipment",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Equipment",
            level: level?.value ?? 0,
            price: priceStr || undefined,
            traits: traits?.value ?? [],
            description: description?.value ? stripHtml(description.value) : "",
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry effect JSON (from equipment-effects, spell-effects,
 * bestiary-effects, etc.) to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapEffect(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const traits = /** @type {{ value?: string[] } | undefined } */ (sys.traits);
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "effect",
        name: raw.name ?? "Unknown Effect",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Effect",
            level: level?.value ?? 0,
            description: description?.value ? stripHtml(description.value) : "",
            traits: traits?.value ?? [],
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry feat JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapFeat(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const actionType = /** @type {{ value?: string } | undefined } */ (sys.actionType);
    const actions = /** @type {{ value?: number } | undefined } */ (sys.actions);
    const traits = /** @type {{ value?: string[] } | undefined } */ (sys.traits);
    const prerequisites = /** @type {{ value?: string } | undefined } */ (sys.prerequisites);
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "feat",
        name: raw.name ?? "Unknown Feat",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Feat",
            level: level?.value ?? 0,
            actionType: mapActionType(actionType?.value ?? "passive", actions?.value ?? 0),
            traits: traits?.value ?? [],
            prerequisites: prerequisites?.value || undefined,
            description: description?.value ? stripHtml(description.value) : "",
            compendiumSource,
        }),
    };
}
