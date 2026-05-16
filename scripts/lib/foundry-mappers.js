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
 * Formats a price object from Foundry into a readable string.
 * @param {{ value?: Record<string, number>, per?: number } | undefined} price
 * @returns {string | undefined}
 */
function formatPrice(price) {
    if (!price?.value) {
        return undefined;
    }
    const raw =
        /** @type {Record<string, number>} */
        (typeof price.value === "string" ? JSON.parse(price.value) : price.value);
    const parts = [];
    if (raw["pp"]) {
        parts.push(`${raw["pp"]} pp`);
    }
    if (raw["gp"]) {
        parts.push(`${raw["gp"]} gp`);
    }
    if (raw["sp"]) {
        parts.push(`${raw["sp"]} sp`);
    }
    if (raw["cp"]) {
        parts.push(`${raw["cp"]} cp`);
    }
    const base = parts.join(", ");
    if (!base) {
        return undefined;
    }
    return price.per ? `${base} per ${price.per}` : base;
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

/**
 * Maps a Foundry class JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapClass(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const keyAbility = /** @type {{ value?: string[] } | undefined } */ (sys.keyAbility);
    const hp = /** @type {number | undefined } */ (sys.hp);
    const perception = /** @type {number | undefined } */ (sys.perception);
    const savingThrows =
        /** @type {{ fortitude?: number, reflex?: number, will?: number } | undefined } */ (
            sys.savingThrows
        );
    const attacks =
        /** @type {{ simple?: number, martial?: number, advanced?: number, unarmed?: number, other?: { name: string, rank: number } } | undefined } */ (
            sys.attacks
        );
    const defenses =
        /** @type {{ unarmored?: number, light?: number, medium?: number, heavy?: number } | undefined } */ (
            sys.defenses
        );
    const trainedSkills =
        /** @type {{ value?: string[], additional?: number } | undefined } */ (sys.trainedSkills);
    const classFeatLevels = /** @type {{ value?: number[] } | undefined } */ (sys.classFeatLevels);
    const ancestryFeatLevels =
        /** @type {{ value?: number[] } | undefined } */ (sys.ancestryFeatLevels);
    const generalFeatLevels =
        /** @type {{ value?: number[] } | undefined } */ (sys.generalFeatLevels);
    const skillFeatLevels = /** @type {{ value?: number[] } | undefined } */ (sys.skillFeatLevels);
    const skillIncreaseLevels =
        /** @type {{ value?: number[] } | undefined } */ (sys.skillIncreaseLevels);
    const spellcasting = /** @type {number | undefined } */ (sys.spellcasting);
    const items = /** @type {Record<string, unknown> | undefined } */ (sys.items);
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    /** @type {Array<{ level: number, name: string, uuid: string }>} */
    const classFeatures = [];
    if (items && typeof items === "object") {
        for (const entry of Object.values(items)) {
            const item =
                /** @type {{ level?: number, name?: string, uuid?: string } | undefined } */ (
                    entry && typeof entry === "object" ? entry : undefined
                );
            if (item?.name && item?.uuid) {
                classFeatures.push({
                    level: item.level ?? 0,
                    name: item.name,
                    uuid: item.uuid,
                });
            }
        }
    }

    return {
        type: "class",
        name: raw.name ?? "Unknown Class",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Class",
            description: description?.value ? stripHtml(description.value) : "",
            keyAbility: keyAbility?.value ?? [],
            hp: hp ?? 0,
            perception: perception ?? 0,
            savingThrows: savingThrows
                ? {
                      fortitude: savingThrows.fortitude ?? 0,
                      reflex: savingThrows.reflex ?? 0,
                      will: savingThrows.will ?? 0,
                  }
                : undefined,
            attacks: attacks
                ? {
                      simple: attacks.simple ?? 0,
                      martial: attacks.martial ?? 0,
                      advanced: attacks.advanced ?? 0,
                      unarmed: attacks.unarmed ?? 0,
                      other: attacks.other ?? undefined,
                  }
                : undefined,
            defenses: defenses ?? undefined,
            trainedSkills: trainedSkills
                ? {
                      value: trainedSkills.value ?? [],
                      additional: trainedSkills.additional ?? 0,
                  }
                : undefined,
            classFeatLevels: classFeatLevels?.value ?? [],
            ancestryFeatLevels: ancestryFeatLevels?.value ?? [],
            generalFeatLevels: generalFeatLevels?.value ?? [],
            skillFeatLevels: skillFeatLevels?.value ?? [],
            skillIncreaseLevels: skillIncreaseLevels?.value ?? [],
            spellcasting: spellcasting ?? undefined,
            classFeatures: classFeatures.sort((a, b) => a.level - b.level),
            rarity: traits?.rarity,
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry ancestry JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapAncestry(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const boosts = /** @type {Record<string, { value: string[] }> | undefined } */ (sys.boosts);
    const flaws = /** @type {Record<string, { value: string[] }> | undefined } */ (sys.flaws);
    const hp = /** @type {number | undefined } */ (sys.hp);
    const size = /** @type {string | undefined } */ (sys.size);
    const speed = /** @type {number | undefined } */ (sys.speed);
    const vision = /** @type {string | undefined } */ (sys.vision);
    const reach = /** @type {number | undefined } */ (sys.reach);
    const hands = /** @type {number | undefined } */ (sys.hands);
    const languages = /** @type {{ value?: string[], custom?: string } | undefined } */ (
        sys.languages
    );
    const additionalLanguages =
        /** @type {{ count?: number, value?: string[], custom?: string } | undefined } */ (
            sys.additionalLanguages
        );
    const items = /** @type {Record<string, unknown> | undefined } */ (sys.items);
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    /** @type {Array<{ level: number, name: string, uuid: string }>} */
    const ancestryFeatures = [];
    if (items && typeof items === "object") {
        for (const entry of Object.values(items)) {
            const item =
                /** @type {{ level?: number, name?: string, uuid?: string } | undefined } */ (
                    entry && typeof entry === "object" ? entry : undefined
                );
            if (item?.name && item?.uuid) {
                ancestryFeatures.push({
                    level: item.level ?? 0,
                    name: item.name,
                    uuid: item.uuid,
                });
            }
        }
    }

    return {
        type: "ancestry",
        name: raw.name ?? "Unknown Ancestry",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Ancestry",
            description: description?.value ? stripHtml(description.value) : "",
            boosts,
            flaws,
            hp: hp ?? 0,
            size: size ?? "med",
            speed: speed ?? 25,
            vision: vision ?? "normal",
            reach: reach ?? 5,
            hands: hands ?? 2,
            languages: languages?.value ?? [],
            additionalLanguages: additionalLanguages
                ? {
                      count: additionalLanguages.count ?? 0,
                      value: additionalLanguages.value ?? [],
                  }
                : undefined,
            ancestryFeatures: ancestryFeatures.sort((a, b) => a.level - b.level),
            rarity: traits?.rarity,
            traits: (traits?.value ?? []).map((t) => capitalize(t)),
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry heritage JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapHeritage(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const ancestry = /** @type {{ name?: string, slug?: string, uuid?: string } | undefined } */ (
        sys.ancestry
    );
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "heritage",
        name: raw.name ?? "Unknown Heritage",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Heritage",
            description: description?.value ? stripHtml(description.value) : "",
            ancestry: ancestry ? { name: ancestry.name, slug: ancestry.slug } : undefined,
            rarity: traits?.rarity,
            traits: (traits?.value ?? []).map((t) => capitalize(t)),
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry background JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapBackground(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const boosts = /** @type {Record<string, { value: string[] }> | undefined } */ (sys.boosts);
    const trainedSkills =
        /** @type {{ value?: string[], lore?: string[] } | undefined } */ (sys.trainedSkills);
    const items = /** @type {Record<string, unknown> | undefined } */ (sys.items);
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    /** @type {Array<{ name: string, uuid: string }>} */
    const grantedItems = [];
    if (items && typeof items === "object") {
        for (const entry of Object.values(items)) {
            const item = /** @type {{ name?: string, uuid?: string } | undefined } */ (
                entry && typeof entry === "object" ? entry : undefined
            );
            if (item?.name && item?.uuid) {
                grantedItems.push({ name: item.name, uuid: item.uuid });
            }
        }
    }

    return {
        type: "background",
        name: raw.name ?? "Unknown Background",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Background",
            description: description?.value ? stripHtml(description.value) : "",
            boosts,
            trainedSkills: trainedSkills
                ? {
                      value: trainedSkills.value ?? [],
                      lore: trainedSkills.lore ?? [],
                  }
                : undefined,
            grantedItems,
            rarity: traits?.rarity,
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry deity JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapDeity(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const category = /** @type {string | undefined } */ (sys.category);
    const attribute = /** @type {string[] | undefined } */ (sys.attribute);
    const domains =
        /** @type {{ primary?: string[], alternate?: string[] } | undefined } */ (sys.domains);
    const font = /** @type {string[] | undefined } */ (sys.font);
    const sanctification =
        /** @type {{ modal?: string, what?: string[] } | undefined } */ (sys.sanctification);
    const skill = /** @type {string[] | undefined } */ (sys.skill);
    const spells = /** @type {Record<string, string> | undefined } */ (sys.spells);
    const weapons = /** @type {string[] | undefined } */ (sys.weapons);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "deity",
        name: raw.name ?? "Unknown Deity",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Deity",
            description: description?.value ? stripHtml(description.value) : "",
            category: category ?? "deity",
            attribute: attribute ?? [],
            domains: domains
                ? {
                      primary: domains.primary ?? [],
                      alternate: domains.alternate ?? [],
                  }
                : undefined,
            font: font ?? [],
            sanctification: sanctification
                ? {
                      modal: sanctification.modal,
                      what: sanctification.what ?? [],
                  }
                : undefined,
            skill: skill ?? [],
            spells: spells ?? {},
            weapons: weapons ?? [],
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry weapon JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapWeapon(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const price = /** @type {{ value?: Record<string, number>, per?: number } | undefined } */ (
        sys.price
    );
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);
    const category = /** @type {string | undefined } */ (sys.category);
    const group = /** @type {string | undefined } */ (sys.group);
    const damage =
        /** @type {{ damageType?: string, dice?: number, die?: string } | undefined } */ (
            sys.damage
        );
    const range = /** @type {{ value?: number } | undefined } */ (sys.range);
    const reload = /** @type {{ value?: number } | string | undefined } */ (sys.reload);
    const baseItem = /** @type {string | undefined } */ (sys.baseItem);
    const bulk = /** @type {number | undefined } */ (sys.bulk);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "weapon",
        name: raw.name ?? "Unknown Weapon",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Weapon",
            level: level?.value ?? 0,
            price: formatPrice(price),
            category: category ?? "simple",
            group: group ?? undefined,
            damage: damage
                ? `${damage.dice ?? 1}${damage.die ?? "d6"} ${damage.damageType ?? "bludgeoning"}`
                : undefined,
            range: range?.value ?? undefined,
            reload: typeof reload === "object" ? reload?.value : (reload ?? undefined),
            baseItem: baseItem ?? undefined,
            bulk: bulk ?? 0,
            rarity: traits?.rarity,
            traits: traits?.value ?? [],
            description: description?.value ? stripHtml(description.value) : "",
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry armor JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapArmor(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const price = /** @type {{ value?: Record<string, number>, per?: number } | undefined } */ (
        sys.price
    );
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);
    const acBonus = /** @type {number | undefined } */ (sys.acBonus);
    const category = /** @type {string | undefined } */ (sys.category);
    const group = /** @type {string | undefined } */ (sys.group);
    const checkPenalty = /** @type {number | undefined } */ (sys.checkPenalty);
    const dexCap = /** @type {number | undefined } */ (sys.dexCap);
    const speedPenalty = /** @type {number | undefined } */ (sys.speedPenalty);
    const strength = /** @type {number | undefined } */ (sys.strength);
    const baseItem = /** @type {string | undefined } */ (sys.baseItem);
    const bulk = /** @type {number | undefined } */ (sys.bulk);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "armor",
        name: raw.name ?? "Unknown Armor",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Armor",
            level: level?.value ?? 0,
            price: formatPrice(price),
            category: category ?? "light",
            group: group ?? undefined,
            acBonus: acBonus ?? 0,
            checkPenalty: checkPenalty ?? 0,
            dexCap: dexCap ?? 0,
            speedPenalty: speedPenalty ?? 0,
            strength: strength ?? 0,
            baseItem: baseItem ?? undefined,
            bulk: bulk ?? 0,
            rarity: traits?.rarity,
            traits: traits?.value ?? [],
            description: description?.value ? stripHtml(description.value) : "",
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry shield JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapShield(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const price = /** @type {{ value?: Record<string, number>, per?: number } | undefined } */ (
        sys.price
    );
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);
    const acBonus = /** @type {number | undefined } */ (sys.acBonus);
    const hardness = /** @type {number | undefined } */ (sys.hardness);
    const hp = /** @type {{ max?: number, value?: number } | undefined } */ (sys.hp);
    const speedPenalty = /** @type {number | undefined } */ (sys.speedPenalty);
    const baseItem = /** @type {string | undefined } */ (sys.baseItem);
    const bulk = /** @type {number | undefined } */ (sys.bulk);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "shield",
        name: raw.name ?? "Unknown Shield",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Shield",
            level: level?.value ?? 0,
            price: formatPrice(price),
            acBonus: acBonus ?? 0,
            hardness: hardness ?? 0,
            hp: hp?.max ?? 0,
            speedPenalty: speedPenalty ?? 0,
            baseItem: baseItem ?? undefined,
            bulk: bulk ?? 0,
            rarity: traits?.rarity,
            traits: traits?.value ?? [],
            description: description?.value ? stripHtml(description.value) : "",
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry consumable JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapConsumable(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const price = /** @type {{ value?: Record<string, number>, per?: number } | undefined } */ (
        sys.price
    );
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);
    const category = /** @type {string | undefined } */ (sys.category);
    const bulk = /** @type {number | undefined } */ (sys.bulk);
    const usage = /** @type {string | undefined } */ (sys.usage);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "consumable",
        name: raw.name ?? "Unknown Consumable",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Consumable",
            level: level?.value ?? 0,
            price: formatPrice(price),
            category: category ?? "other",
            bulk: bulk ?? 0,
            usage: usage ?? undefined,
            rarity: traits?.rarity,
            traits: traits?.value ?? [],
            description: description?.value ? stripHtml(description.value) : "",
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry ammo JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapAmmo(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const price = /** @type {{ value?: Record<string, number>, per?: number } | undefined } */ (
        sys.price
    );
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);
    const baseItem = /** @type {string | undefined } */ (sys.baseItem);
    const bulk = /** @type {number | undefined } */ (sys.bulk);
    const quantity = /** @type {number | undefined } */ (sys.quantity);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "ammo",
        name: raw.name ?? "Unknown Ammo",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Ammo",
            level: level?.value ?? 0,
            price: formatPrice(price),
            baseItem: baseItem ?? undefined,
            bulk: bulk ?? 0,
            quantity: quantity ?? 1,
            rarity: traits?.rarity,
            traits: traits?.value ?? [],
            description: description?.value ? stripHtml(description.value) : "",
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry hazard JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapHazard(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown>, items?: Array<unknown> }} */ (
            rawJson
        );
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const details =
        /** @type {{ description?: string, disable?: string, isComplex?: boolean, level?: { value: number }, reset?: string, routine?: string } | undefined } */ (
            sys.details
        );
    const attributes =
        /** @type {{ ac?: { value: number }, hardness?: number, hp?: { max: number, value: number }, stealth?: { value: number, details?: string } } | undefined } */ (
            sys.attributes
        );
    const saves =
        /** @type {{ fortitude?: { value: number }, reflex?: { value: number }, will?: { value: number } } | undefined } */ (
            sys.saves
        );
    const traits =
        /** @type {{ rarity?: string, value?: string[], size?: { value: string } } | undefined } */ (
            sys.traits
        );

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "hazard",
        name: raw.name ?? "Unknown Hazard",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Hazard",
            level: details?.level?.value ?? 0,
            isComplex: details?.isComplex ?? false,
            description: details?.description ? stripHtml(details.description) : "",
            disable: details?.disable ? stripHtml(details.disable) : undefined,
            reset: details?.reset ? stripHtml(details.reset) : undefined,
            routine: details?.routine ? stripHtml(details.routine) : undefined,
            ac: attributes?.ac?.value ?? 0,
            hardness: attributes?.hardness ?? 0,
            hp: attributes?.hp?.max ?? 0,
            stealth: attributes?.stealth?.value ?? 0,
            stealthDetails: attributes?.stealth?.details
                ? stripHtml(attributes.stealth.details)
                : undefined,
            saves: saves
                ? {
                      fortitude: saves.fortitude?.value ?? 0,
                      reflex: saves.reflex?.value ?? 0,
                      will: saves.will?.value ?? 0,
                  }
                : undefined,
            size: traits?.size?.value ?? "med",
            rarity: traits?.rarity,
            traits: (traits?.value ?? []).map((t) => capitalize(t)),
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry treasure JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapTreasure(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const price = /** @type {{ value?: Record<string, number>, per?: number } | undefined } */ (
        sys.price
    );
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);
    const category = /** @type {string | undefined } */ (sys.category);
    const bulk = /** @type {number | undefined } */ (sys.bulk);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "treasure",
        name: raw.name ?? "Unknown Treasure",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Treasure",
            level: level?.value ?? 0,
            price: formatPrice(price),
            category: category ?? undefined,
            bulk: bulk ?? 0,
            rarity: traits?.rarity,
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry backpack JSON to an importable rule item.
 * @param {unknown} rawJson
 * @param {string} packName
 * @returns {ImportableRuleItem}
 */
export function mapBackpack(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const level = /** @type {{ value?: number } | undefined } */ (sys.level);
    const price = /** @type {{ value?: Record<string, number>, per?: number } | undefined } */ (
        sys.price
    );
    const traits = /** @type {{ rarity?: string, value?: string[] } | undefined } */ (sys.traits);
    const bulk =
        /** @type {{ capacity?: number, heldOrStowed?: number, ignored?: number, value?: number } | undefined } */ (
            sys.bulk
        );
    const stowing = /** @type {boolean | undefined } */ (sys.stowing);
    const usage = /** @type {string | undefined } */ (sys.usage);

    const compendiumSource = buildCompendiumSource(packName, raw._id ?? "");

    return {
        type: "backpack",
        name: raw.name ?? "Unknown Backpack",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Backpack",
            level: level?.value ?? 0,
            price: formatPrice(price),
            capacity: bulk?.capacity ?? 0,
            bulk: bulk?.value ?? 0,
            stowing: stowing ?? false,
            usage: usage ?? undefined,
            rarity: traits?.rarity,
            traits: traits?.value ?? [],
            description: description?.value ? stripHtml(description.value) : "",
            compendiumSource,
        }),
    };
}
