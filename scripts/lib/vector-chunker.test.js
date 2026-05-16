import { describe, expect, it } from "bun:test";

import {
    createActionChunks,
    createChunksFromRuleItem,
    createCreatureSummaryChunk,
    createSpellChunk,
} from "./vector-chunker.js";

describe("vector-chunker", () => {
    describe("createChunksFromRuleItem", () => {
        it("creates multiple chunks for a creature (summary + per-action)", () => {
            const ruleItem = {
                id: "creature-1",
                type: "creature",
                name: "Bloodseeker",
                compendiumSource: "Compendium.pf2e.bestiary.Item.abc",
                data: {
                    name: "Bloodseeker",
                    level: 1,
                    traits: ["Animal"],
                    attributes: { ac: { value: 16 }, hp: { value: 20, max: 20 } },
                    abilities: { str: { mod: 0 }, dex: { mod: 4 } },
                    skills: { Stealth: { value: 6 } },
                    perception: 6,
                    actions: [
                        {
                            name: "Attach",
                            actionType: 1,
                            traits: [],
                            description: "Attaches to a target.",
                        },
                    ],
                    melee: [
                        {
                            name: "proboscis",
                            attack: "+8",
                            damage: "1d6+4 piercing",
                            traits: ["finesse"],
                        },
                    ],
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            // Should have at least summary + action + melee chunks
            expect(chunks.length).toBeGreaterThanOrEqual(3);
            // First chunk is summary
            expect(chunks[0].chunkIndex).toBe(0);
            expect(chunks[0].ruleItemType).toBe("creature");
            expect(chunks[0].ruleItemId).toBe("creature-1");
            expect(chunks[0].compendiumSource).toBe("Compendium.pf2e.bestiary.Item.abc");
        });

        it("creates single chunk for a spell", () => {
            const ruleItem = {
                id: "spell-1",
                type: "spell",
                name: "Fireball",
                compendiumSource: "Compendium.pf2e.spells.Item.xyz",
                data: {
                    name: "Fireball",
                    level: 3,
                    traditions: ["arcane", "primal"],
                    cast: "two actions",
                    range: "120 feet",
                    area: "20-foot burst",
                    savingThrow: "Reflex",
                    description: "A burst of fire.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Fireball");
            expect(chunks[0].ruleItemType).toBe("spell");
        });

        it("creates single chunk for equipment", () => {
            const ruleItem = {
                id: "equip-1",
                type: "equipment",
                name: "Longsword",
                compendiumSource: undefined,
                data: {
                    name: "Longsword",
                    level: 0,
                    price: "1 gp",
                    traits: ["versatile-p"],
                    description: "A standard longsword.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Longsword");
            expect(chunks[0].ruleItemType).toBe("equipment");
            expect(chunks[0].compendiumSource).toBeUndefined();
        });

        it("creates single chunk for a feat", () => {
            const ruleItem = {
                id: "feat-1",
                type: "feat",
                name: "Power Attack",
                compendiumSource: "Compendium.pf2e.feats.Item.feat1",
                data: {
                    name: "Power Attack",
                    level: 1,
                    actionType: 2,
                    traits: ["fighter", "flourish"],
                    description: "You unleash a powerful attack.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Power Attack");
            expect(chunks[0].ruleItemType).toBe("feat");
        });

        it("each chunk has correct ruleItemId and chunkIndex", () => {
            const ruleItem = {
                id: "test-id",
                type: "creature",
                name: "Test",
                compendiumSource: undefined,
                data: {
                    name: "Test",
                    level: 1,
                    traits: [],
                    actions: [
                        { name: "A1", actionType: 1, traits: [], description: "desc 1" },
                        { name: "A2", actionType: 2, traits: [], description: "desc 2" },
                    ],
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            for (let i = 0; i < chunks.length; i++) {
                expect(chunks[i].ruleItemId).toBe("test-id");
                expect(chunks[i].chunkIndex).toBe(i);
            }
        });

        it("creates rich chunk for melee child type with parent context", () => {
            const ruleItem = {
                id: "melee-1",
                type: "melee",
                name: "proboscis",
                compendiumSource: "Compendium.pf2e.bestiary.Item.melee001",
                parentId: "parent-1",
                data: {
                    name: "proboscis",
                    attack: "+8",
                    damage: "1d6+4 piercing",
                    damageType: "piercing",
                    traits: ["finesse"],
                },
            };
            const parent = { name: "Bloodseeker", type: "creature" };
            const chunks = createChunksFromRuleItem(ruleItem, parent);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Bloodseeker's proboscis");
            expect(chunks[0].text).toContain("Attack +8");
            expect(chunks[0].text).toContain("Damage 1d6+4 piercing");
            expect(chunks[0].text).toContain("Traits: finesse");
        });

        it("creates melee chunk without parent context when no parent", () => {
            const ruleItem = {
                id: "melee-1",
                type: "melee",
                name: "proboscis",
                compendiumSource: undefined,
                data: {
                    name: "proboscis",
                    attack: "+8",
                    damage: "1d6+4 piercing",
                    traits: ["finesse"],
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Melee: proboscis");
            expect(chunks[0].text).not.toContain("'s ");
        });

        it("creates rich chunk for action child type with parent context", () => {
            const ruleItem = {
                id: "action-1",
                type: "action",
                name: "Sneak",
                compendiumSource: undefined,
                parentId: "parent-1",
                data: {
                    name: "Sneak",
                    actionType: 1,
                    traits: ["move"],
                    description: "Move stealthily.",
                },
            };
            const parent = { name: "Goblin", type: "creature" };
            const chunks = createChunksFromRuleItem(ruleItem, parent);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Goblin's Sneak");
            expect(chunks[0].text).toContain("1-Action");
            expect(chunks[0].text).toContain("Traits: move");
            expect(chunks[0].text).toContain("Move stealthily.");
        });

        it("creates rich chunk for spellcastingEntry child type with parent context", () => {
            const ruleItem = {
                id: "sc-1",
                type: "spellcastingEntry",
                name: "Innate Spells",
                compendiumSource: undefined,
                parentId: "parent-1",
                data: {
                    name: "Innate Spells",
                    tradition: "occult",
                    dc: 17,
                    attackModifier: 7,
                },
            };
            const parent = { name: "Cultist", type: "creature" };
            const chunks = createChunksFromRuleItem(ruleItem, parent);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Cultist's Innate Spells");
            expect(chunks[0].text).toContain("Tradition: occult");
            expect(chunks[0].text).toContain("DC 17");
            expect(chunks[0].text).toContain("Attack +7");
        });

        it("creates named chunk for weapon child type with parent context", () => {
            const ruleItem = {
                id: "weapon-1",
                type: "weapon",
                name: "Longsword",
                compendiumSource: undefined,
                parentId: "parent-1",
                data: { name: "Longsword" },
            };
            const parent = { name: "Knight", type: "creature" };
            const chunks = createChunksFromRuleItem(ruleItem, parent);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe("Weapon: Knight's Longsword");
        });

        it("creates named chunk for armor child type with parent context", () => {
            const ruleItem = {
                id: "armor-1",
                type: "armor",
                name: "Chain Mail",
                compendiumSource: undefined,
                parentId: "parent-1",
                data: { name: "Chain Mail" },
            };
            const parent = { name: "Knight", type: "creature" };
            const chunks = createChunksFromRuleItem(ruleItem, parent);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe("Armor: Knight's Chain Mail");
        });

        it("creates class chunk with hp, key ability, saves, features", () => {
            const ruleItem = {
                id: "class-1",
                type: "class",
                name: "Fighter",
                compendiumSource: "Compendium.pf2e.classes.Item.f1",
                data: {
                    name: "Fighter",
                    hp: 10,
                    keyAbility: ["str", "dex"],
                    perception: 1,
                    savingThrows: { fortitude: 2, reflex: 1, will: 0 },
                    classFeatLevels: [1, 2, 4],
                    trainedSkills: { value: ["athletics"], additional: 2 },
                    classFeatures: [
                        { level: 1, name: "Attack of Opportunity" },
                        { level: 5, name: "Sudden Charge" },
                    ],
                    description: "Martial expert.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Class: Fighter");
            expect(chunks[0].text).toContain("HP per level: 10");
            expect(chunks[0].text).toContain("Key Ability: str or dex");
            expect(chunks[0].text).toContain("Perception: Trained");
            expect(chunks[0].text).toContain("Fort Expert");
            expect(chunks[0].text).toContain("Class feats at levels: 1, 2, 4");
            expect(chunks[0].text).toContain("Trained skills: athletics");
            expect(chunks[0].text).toContain("+2 additional skills");
            expect(chunks[0].text).toContain(
                "Class features: L1 Attack of Opportunity, L5 Sudden Charge",
            );
        });

        it("creates ancestry chunk with boosts, features, traits", () => {
            const ruleItem = {
                id: "anc-1",
                type: "ancestry",
                name: "Dwarf",
                compendiumSource: undefined,
                data: {
                    name: "Dwarf",
                    hp: 10,
                    size: "med",
                    speed: 20,
                    vision: "darkvision",
                    languages: ["Common", "Dwarven"],
                    ancestryFeatures: [{ level: 1, name: "Dwarven Lore" }],
                    traits: ["Dwarf"],
                    description: "Stout folk.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Ancestry: Dwarf");
            expect(chunks[0].text).toContain("HP: 10");
            expect(chunks[0].text).toContain("Size: Medium");
            expect(chunks[0].text).toContain("Speed: 20 ft");
            expect(chunks[0].text).toContain("Vision: darkvision");
            expect(chunks[0].text).toContain("Languages: Common, Dwarven");
            expect(chunks[0].text).toContain("Features: L1 Dwarven Lore");
            expect(chunks[0].text).toContain("Traits: Dwarf");
        });

        it("creates heritage chunk with ancestry link", () => {
            const ruleItem = {
                id: "her-1",
                type: "heritage",
                name: "Ancient Elf",
                data: {
                    name: "Ancient Elf",
                    ancestry: { name: "Elf" },
                    traits: ["Elf"],
                    description: "Elven heritage.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Heritage: Ancient Elf");
            expect(chunks[0].text).toContain("Ancestry: Elf");
            expect(chunks[0].text).toContain("Traits: Elf");
        });

        it("creates background chunk with skills and granted items", () => {
            const ruleItem = {
                id: "bg-1",
                type: "background",
                name: "Warrior",
                data: {
                    name: "Warrior",
                    trainedSkills: { value: ["Athletics"], lore: ["Warfare Lore"] },
                    grantedItems: [{ name: "Longsword" }],
                    description: "A soldier.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Background: Warrior");
            expect(chunks[0].text).toContain("Trained in: Athletics, Warfare Lore");
            expect(chunks[0].text).toContain("Granted: Longsword");
        });

        it("creates deity chunk with domains, weapons, sanctification", () => {
            const ruleItem = {
                id: "deity-1",
                type: "deity",
                name: "Sarenrae",
                data: {
                    name: "Sarenrae",
                    category: "deity",
                    attribute: ["con", "str"],
                    domains: { primary: ["healing", "sun"], alternate: ["fire"] },
                    font: ["heal", "harm"],
                    sanctification: { modal: "can", what: ["holy"] },
                    skill: ["medicine"],
                    weapons: ["scimitar"],
                    description: "Sun goddess.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Deity: Sarenrae");
            expect(chunks[0].text).toContain("Divine Ability: con, str");
            expect(chunks[0].text).toContain("Domains: healing, sun");
            expect(chunks[0].text).toContain("Font: heal, harm");
            expect(chunks[0].text).toContain("Divine Skill: medicine");
            expect(chunks[0].text).toContain("Favored Weapon: scimitar");
        });

        it("creates shield chunk with ac, hardness, hp", () => {
            const ruleItem = {
                id: "shield-1",
                type: "shield",
                name: "Steel Shield",
                data: {
                    name: "Steel Shield",
                    acBonus: 2,
                    hardness: 5,
                    hp: 20,
                    speedPenalty: 0,
                    level: 1,
                    traits: ["shield"],
                    description: "Sturdy shield.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Shield: Steel Shield");
            expect(chunks[0].text).toContain("AC +2");
            expect(chunks[0].text).toContain("Hardness 5");
            expect(chunks[0].text).toContain("HP 20");
            expect(chunks[0].text).toContain("Level 1");
        });

        it("creates consumable chunk with category, level, traits", () => {
            const ruleItem = {
                id: "cons-1",
                type: "consumable",
                name: "Healing Potion",
                data: {
                    name: "Healing Potion",
                    category: "potion",
                    level: 3,
                    traits: ["consumable", "healing"],
                    description: "Restores HP.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Consumable: Healing Potion");
            expect(chunks[0].text).toContain("Potion");
            expect(chunks[0].text).toContain("Level 3");
        });

        it("creates ammo chunk with level and traits", () => {
            const ruleItem = {
                id: "ammo-1",
                type: "ammo",
                name: "Arrows",
                data: {
                    name: "Arrows",
                    level: 2,
                    traits: ["ammunition"],
                    description: "Standard arrows.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Ammunition: Arrows");
            expect(chunks[0].text).toContain("Level 2");
            expect(chunks[0].text).toContain("Traits: ammunition");
        });

        it("creates hazard chunk with level, ac, stealth, saves", () => {
            const ruleItem = {
                id: "haz-1",
                type: "hazard",
                name: "Poison Dart Trap",
                data: {
                    name: "Poison Dart Trap",
                    level: 3,
                    isComplex: true,
                    ac: 18,
                    hp: 30,
                    stealth: 20,
                    saves: { fortitude: 10, reflex: 5, will: 0 },
                    traits: ["mechanical", "trap"],
                    description: "Hidden trap.",
                    disable: "Thievery DC 20.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Hazard: Poison Dart Trap");
            expect(chunks[0].text).toContain("Level 3");
            expect(chunks[0].text).toContain("Complex");
            expect(chunks[0].text).toContain("AC 18");
            expect(chunks[0].text).toContain("HP 30");
            expect(chunks[0].text).toContain("Stealth DC 20");
            expect(chunks[0].text).toContain("Disable: Thievery DC 20.");
        });

        it("creates hazard chunk as Simple when isComplex is false", () => {
            const ruleItem = {
                id: "haz-2",
                type: "hazard",
                name: "Pit",
                data: { name: "Pit", isComplex: false },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks[0].text).toContain("Simple");
        });

        it("creates treasure chunk with category", () => {
            const ruleItem = {
                id: "treas-1",
                type: "treasure",
                name: "Gold Ring",
                data: { name: "Gold Ring", category: "treasure" },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Treasure: Gold Ring");
            expect(chunks[0].text).toContain("Treasure");
        });

        it("creates backpack/container chunk with capacity", () => {
            const ruleItem = {
                id: "bp-1",
                type: "backpack",
                name: "Backpack",
                data: {
                    name: "Backpack",
                    capacity: 4,
                    description: "Simple container.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Container: Backpack");
            expect(chunks[0].text).toContain("Capacity 4 Bulk");
        });

        it("creates weapon chunk with category, damage, range, traits", () => {
            const ruleItem = {
                id: "wpn-1",
                type: "weapon",
                name: "Longbow",
                data: {
                    name: "Longbow",
                    category: "martial",
                    damage: "1d8 piercing",
                    range: 100,
                    level: 1,
                    traits: ["deadly-d10"],
                    description: "Ranged weapon.",
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Weapon: Longbow");
            expect(chunks[0].text).toContain("Martial");
            expect(chunks[0].text).toContain("Damage: 1d8 piercing");
            expect(chunks[0].text).toContain("Range 100 ft");
            expect(chunks[0].text).toContain("Level 1");
        });

        it("creates armor chunk with category, acBonus, dexCap", () => {
            const ruleItem = {
                id: "arm-1",
                type: "armor",
                name: "Chain Mail",
                data: {
                    name: "Chain Mail",
                    category: "heavy",
                    acBonus: 4,
                    dexCap: 1,
                    checkPenalty: -3,
                    speedPenalty: -10,
                    level: 2,
                    traits: ["bulwark"],
                },
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toContain("Armor: Chain Mail");
            expect(chunks[0].text).toContain("Heavy");
            expect(chunks[0].text).toContain("AC +4");
            expect(chunks[0].text).toContain("Dex Cap +1");
            expect(chunks[0].text).toContain("Check Penalty -3");
            expect(chunks[0].text).toContain("Speed Penalty -10 ft");
        });

        it("uses fallback for unknown type", () => {
            const ruleItem = {
                id: "unknown-1",
                type: "custom",
                name: "Custom Thing",
                data: {},
            };
            const chunks = createChunksFromRuleItem(ruleItem);

            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe("custom: Custom Thing");
        });
    });

    describe("createCreatureSummaryChunk", () => {
        it("includes creature name, level, traits, AC, HP", () => {
            const data = {
                name: "Dragon",
                level: 10,
                traits: ["Dragon", "Fire"],
                attributes: {
                    ac: { value: 30 },
                    hp: { value: 200, max: 200 },
                },
            };
            const text = createCreatureSummaryChunk(data);

            expect(text).toContain("Dragon");
            expect(text).toContain("Level 10");
            expect(text).toContain("Dragon, Fire");
            expect(text).toContain("AC 30");
            expect(text).toContain("HP 200");
        });

        it("includes all ability modifiers", () => {
            const data = {
                name: "Test",
                level: 1,
                traits: [],
                abilities: {
                    str: { mod: 4 },
                    dex: { mod: 3 },
                    con: { mod: 5 },
                    int: { mod: -2 },
                    wis: { mod: 1 },
                    cha: { mod: 0 },
                },
            };
            const text = createCreatureSummaryChunk(data);

            expect(text).toContain("STR +4");
            expect(text).toContain("DEX +3");
            expect(text).toContain("CON +5");
            expect(text).toContain("INT -2");
            expect(text).toContain("WIS +1");
            expect(text).toContain("CHA +0");
        });

        it("includes all skills with values", () => {
            const data = {
                name: "Test",
                level: 1,
                traits: [],
                skills: {
                    Acrobatics: { value: 8 },
                    Stealth: { value: 10 },
                },
            };
            const text = createCreatureSummaryChunk(data);

            expect(text).toContain("Acrobatics +8");
            expect(text).toContain("Stealth +10");
        });

        it("includes perception and speed", () => {
            const data = {
                name: "Test",
                level: 1,
                traits: [],
                perception: 7,
                attributes: { speed: "30 feet" },
            };
            const text = createCreatureSummaryChunk(data);

            expect(text).toContain("Perception +7");
            expect(text).toContain("Speed 30 feet");
        });

        it("produces human-readable text (not JSON)", () => {
            const data = { name: "Goblin", level: 1, traits: ["Humanoid"] };
            const text = createCreatureSummaryChunk(data);

            // Should not start with { or [
            expect(text.startsWith("{")).toBe(false);
            expect(text.startsWith("[")).toBe(false);
        });
    });

    describe("createActionChunks", () => {
        it("creates one chunk per action with name, type, traits, description", () => {
            const data = /** @type {import("../../shared/types.js").CreatureData} */ (
                /** @type {unknown} */ ({
                    name: "Test",
                    level: 1,
                    traits: [],
                    actions: [
                        {
                            name: "Sneak",
                            actionType: 1,
                            traits: ["move"],
                            description: "Move stealthily.",
                        },
                        {
                            name: "Hide",
                            actionType: 1,
                            traits: ["secret"],
                            description: "Become hidden.",
                        },
                    ],
                })
            );
            const chunks = createActionChunks(data);

            expect(chunks).toHaveLength(2);
            expect(chunks[0]).toContain("Sneak");
            expect(chunks[0]).toContain("move");
            expect(chunks[1]).toContain("Hide");
        });

        it("skips actions with empty descriptions", () => {
            const data = /** @type {import("../../shared/types.js").CreatureData} */ (
                /** @type {unknown} */ ({
                    name: "Test",
                    level: 1,
                    traits: [],
                    actions: [
                        { name: "Empty", actionType: 0, traits: [], description: "" },
                        {
                            name: "HasDesc",
                            actionType: 1,
                            traits: [],
                            description: "A description.",
                        },
                    ],
                })
            );
            const chunks = createActionChunks(data);

            expect(chunks).toHaveLength(1);
            expect(chunks[0]).toContain("HasDesc");
        });

        it("handles creatures with no actions", () => {
            const data = /** @type {import("../../shared/types.js").CreatureData} */ (
                /** @type {unknown} */ ({ name: "Test", level: 1, traits: [] })
            );
            const chunks = createActionChunks(data);

            expect(chunks).toHaveLength(0);
        });
    });

    describe("createSpellChunk", () => {
        it("includes spell name, rank, traditions", () => {
            const data = {
                name: "Fireball",
                level: 3,
                traditions: ["arcane", "primal"],
            };
            const text = createSpellChunk(data);

            expect(text).toContain("Fireball");
            expect(text).toContain("Rank 3");
            expect(text).toContain("arcane");
            expect(text).toContain("primal");
        });

        it("includes cast time, range, area, saving throw", () => {
            const data = {
                name: "Fireball",
                level: 3,
                cast: "two actions",
                range: "120 feet",
                area: "20-foot burst",
                savingThrow: "Reflex",
            };
            const text = createSpellChunk(data);

            expect(text).toContain("Cast: two actions");
            expect(text).toContain("Range: 120 feet");
            expect(text).toContain("Area: 20-foot burst");
            expect(text).toContain("Saving Throw: Reflex");
        });

        it("includes full description text", () => {
            const data = {
                name: "Fireball",
                level: 3,
                description: "A burst of fire explodes at a point.",
            };
            const text = createSpellChunk(data);

            expect(text).toContain("A burst of fire explodes at a point.");
        });
    });
});
