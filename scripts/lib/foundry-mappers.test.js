import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

import {
    buildCompendiumSource,
    classifyPackDirectory,
    extractEmbeddedItems,
    mapAmmo,
    mapAncestry,
    mapArmor,
    mapBackpack,
    mapBackground,
    mapClass,
    mapConsumable,
    mapCreature,
    mapDeity,
    mapEffect,
    mapEquipment,
    mapFeat,
    mapHazard,
    mapHeritage,
    mapShield,
    mapSpell,
    mapTreasure,
    mapWeapon,
} from "./foundry-mappers.js";

const FIXTURE_DIR = join(import.meta.dirname, "../../test/fixtures/foundry");

function loadFixture(/** @type {string} */ name) {
    return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf-8"));
}

describe("foundry-mappers", () => {
    describe("buildCompendiumSource", () => {
        it("builds compendium source UUID from pack name and item id", () => {
            const result = buildCompendiumSource("pathfinder-bestiary", "abc123");
            expect(result).toBe("Compendium.pf2e.pathfinder-bestiary.Item.abc123");
        });

        it("handles nested pack paths", () => {
            const result = buildCompendiumSource("spells/spells/rank-3", "spell001");
            expect(result).toBe("Compendium.pf2e.spells/spells/rank-3.Item.spell001");
        });
    });

    describe("classifyPackDirectory", () => {
        it("classifies bestiary directories as creature", () => {
            expect(classifyPackDirectory("pathfinder-bestiary")).toBe("creature");
            expect(classifyPackDirectory("pathfinder-bestiary-2")).toBe("creature");
            expect(classifyPackDirectory("pathfinder-bestiary-3")).toBe("creature");
            expect(classifyPackDirectory("pathfinder-monster-core")).toBe("creature");
            expect(classifyPackDirectory("npc-gallery")).toBe("creature");
        });

        it("classifies spell directories as spell", () => {
            expect(classifyPackDirectory("spells")).toBe("spell");
            expect(classifyPackDirectory("spells/spells/rank-3")).toBe("spell");
        });

        it("classifies equipment directories as equipment", () => {
            expect(classifyPackDirectory("equipment")).toBe("equipment");
        });

        it("classifies feat directories as feat", () => {
            expect(classifyPackDirectory("feats")).toBe("feat");
        });

        it("classifies action directories as action", () => {
            expect(classifyPackDirectory("actions")).toBe("action");
            expect(classifyPackDirectory("bestiary-ability-glossary-srd")).toBe("action");
        });

        it("classifies effect pack directories as effect", () => {
            expect(classifyPackDirectory("bestiary-effects")).toBe("effect");
            expect(classifyPackDirectory("campaign-effects")).toBe("effect");
            expect(classifyPackDirectory("equipment-effects")).toBe("effect");
            expect(classifyPackDirectory("feat-effects")).toBe("effect");
            expect(classifyPackDirectory("other-effects")).toBe("effect");
            expect(classifyPackDirectory("spell-effects")).toBe("effect");
        });

        it("does not falsely classify non-effect directories", () => {
            expect(classifyPackDirectory("actions")).toBe("action");
            expect(classifyPackDirectory("feats")).toBe("feat");
        });

        it("returns mixed for unknown directories", () => {
            expect(classifyPackDirectory("unknown-pack")).toBe("mixed");
            expect(classifyPackDirectory("")).toBe("mixed");
        });
    });

    describe("mapCreature", () => {
        it("maps simple creature with correct CreatureData shape", () => {
            const raw = loadFixture("creature-simple.json");
            const result = mapCreature(raw, "pathfinder-bestiary");

            // mapCreature returns array: [creatureItem, ...embeddedItems]
            expect(Array.isArray(result)).toBe(true);
            const [creature] = result;
            expect(creature.name).toBe("Bloodseeker");
            expect(creature.type).toBe("creature");
            expect(creature.compendiumSource).toBe(
                "Compendium.pf2e.pathfinder-bestiary.Item.simplecreature001",
            );

            const data = JSON.parse(creature.dataJson);
            expect(data.name).toBe("Bloodseeker");
            expect(data.level).toBe(1);
        });

        it("maps abilities from Foundry format", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.abilities.str.mod).toBe(0);
            expect(data.abilities.dex.mod).toBe(4);
            expect(data.abilities.con.mod).toBe(2);
            expect(data.abilities.int.mod).toBe(-5);
            expect(data.abilities.wis.mod).toBe(1);
            expect(data.abilities.cha.mod).toBe(-3);
        });

        it("maps attributes correctly", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.attributes.ac.value).toBe(16);
            expect(data.attributes.hp.value).toBe(20);
            expect(data.attributes.hp.max).toBe(20);
            expect(data.attributes.fortitude.value).toBe(6);
            expect(data.attributes.reflex.value).toBe(10);
            expect(data.attributes.will.value).toBe(3);
        });

        it("maps speed from value field", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.attributes.speed).toBe("25 feet");
        });

        it("maps skills from base field", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.skills.Acrobatics.value).toBe(6);
            expect(data.skills.Stealth.value).toBe(6);
        });

        it("maps traits with capitalization", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.traits).toEqual(["Animal"]);
        });

        it("maps rarity from traits.rarity", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.rarity).toBe("common");
        });

        it("maps level from system.details.level.value", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.level).toBe(1);
        });

        it("maps languages from system.details.languages", () => {
            const raw = loadFixture("creature-spellcaster.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.languages.value).toEqual(["Common", "Infernal"]);
            expect(data.languages.details).toBe("celestial scripts");
        });

        it("strips HTML tags from description", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.description).toBe("A large mosquito-like creature.");
        });

        it("maps perception", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.perception).toBe(6);
        });

        it("builds correct compendium_source", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");

            expect(creature.compendiumSource).toBe(
                "Compendium.pf2e.pathfinder-bestiary.Item.simplecreature001",
            );
        });

        it("maps spellcaster creature with fly speed", () => {
            const raw = loadFixture("creature-spellcaster.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(data.attributes.speed).toBe("25 feet, fly 20 feet");
        });

        it("includes itemRefs for embedded items", () => {
            const raw = loadFixture("creature-simple.json");
            const [creature] = mapCreature(raw, "pathfinder-bestiary");
            const data = JSON.parse(creature.dataJson);

            expect(Array.isArray(data.itemRefs)).toBe(true);
            expect(data.itemRefs.length).toBeGreaterThan(0);
        });

        it("embedded items have parentId set to creature's compendium source", () => {
            const raw = loadFixture("creature-simple.json");
            const result = mapCreature(raw, "pathfinder-bestiary");

            const creatureSource = result[0].compendiumSource;
            const embeddedItems = result.slice(1);

            expect(embeddedItems.length).toBeGreaterThan(0);
            for (const item of embeddedItems) {
                expect(item.parentId).toBe(creatureSource);
            }
        });
    });

    describe("extractEmbeddedItems", () => {
        it("extracts melee items with correct data", () => {
            const raw = loadFixture("creature-simple.json");
            const creatureSource = buildCompendiumSource("pathfinder-bestiary", raw._id);
            const { embeddedItems } = extractEmbeddedItems(raw.items, creatureSource);

            const meleeItems = embeddedItems.filter((i) => i.type === "melee");
            expect(meleeItems).toHaveLength(1);
            expect(meleeItems[0].name).toBe("proboscis");

            const meleeData = JSON.parse(meleeItems[0].dataJson);
            expect(meleeData.attack).toContain("+8");
            expect(meleeData.damage).toBe("1d6+4 piercing");
            expect(meleeData.traits).toEqual(["finesse"]);
        });

        it("sets parentId on each embedded item", () => {
            const raw = loadFixture("creature-simple.json");
            const creatureSource = buildCompendiumSource("pathfinder-bestiary", raw._id);
            const { embeddedItems } = extractEmbeddedItems(raw.items, creatureSource);

            expect(embeddedItems.length).toBeGreaterThan(0);
            for (const item of embeddedItems) {
                expect(item.parentId).toBe(creatureSource);
            }
        });

        it("extracts action items with mapped actionType", () => {
            const raw = loadFixture("creature-simple.json");
            const creatureSource = buildCompendiumSource("pathfinder-bestiary", raw._id);
            const { embeddedItems } = extractEmbeddedItems(raw.items, creatureSource);

            const actionItems = embeddedItems.filter((i) => i.type === "action");
            expect(actionItems).toHaveLength(2);

            // Attach is 1-action
            const attachItem = actionItems.find((a) => a.name === "Attach");
            expect(attachItem).toBeDefined();
            if (!attachItem) {
                return;
            }
            const attachData = JSON.parse(attachItem.dataJson);
            expect(attachData.actionType).toBe(1);

            // Blood Drain is passive (0)
            const bloodItem = actionItems.find((a) => a.name === "Blood Drain");
            expect(bloodItem).toBeDefined();
            if (!bloodItem) {
                return;
            }
            const bloodData = JSON.parse(bloodItem.dataJson);
            expect(bloodData.actionType).toBe(0);
        });

        it("extracts spellcasting entries", () => {
            const raw = loadFixture("creature-spellcaster.json");
            const creatureSource = buildCompendiumSource("pathfinder-bestiary", raw._id);
            const { embeddedItems } = extractEmbeddedItems(raw.items, creatureSource);

            const spellcastingItems = embeddedItems.filter((i) => i.type === "spellcastingEntry");
            expect(spellcastingItems).toHaveLength(1);
            expect(spellcastingItems[0].name).toBe("Cultist Divine Spells");

            const scData = JSON.parse(spellcastingItems[0].dataJson);
            expect(scData.tradition).toBe("divine");
            expect(scData.dc).toBe(17);
            expect(scData.attackModifier).toBe(7);
        });

        it("skips non-relevant embedded item types", () => {
            const items = [
                {
                    _id: "effect001",
                    name: "Some Effect",
                    type: "effect",
                    system: {},
                },
            ];
            const { embeddedItems } = extractEmbeddedItems(items, "Compendium.test");

            expect(embeddedItems).toHaveLength(0);
        });

        it("returns correct itemRefs", () => {
            const raw = loadFixture("creature-simple.json");
            const creatureSource = buildCompendiumSource("pathfinder-bestiary", raw._id);
            const { itemRefs } = extractEmbeddedItems(raw.items, creatureSource);

            expect(itemRefs).toHaveLength(3);
            expect(itemRefs[0]).toContain("melee001");
        });
    });

    describe("mapSpell", () => {
        it("maps spell with correct data", () => {
            const raw = loadFixture("spell.json");
            const result = mapSpell(raw, "spells");

            expect(result.name).toBe("Fireball");
            expect(result.type).toBe("spell");
            expect(result.compendiumSource).toBe("Compendium.pf2e.spells.Item.spell001");

            const data = JSON.parse(result.dataJson);
            expect(data.name).toBe("Fireball");
            expect(data.level).toBe(3);
            expect(data.traditions).toEqual(["arcane", "primal"]);
            expect(data.cast).toBe("two actions");
            expect(data.range).toBe("120 feet");
            expect(data.area).toBe("20-foot burst");
            expect(data.savingThrow).toBe("Reflex");
        });

        it("strips HTML from spell description", () => {
            const raw = loadFixture("spell.json");
            const result = mapSpell(raw, "spells");
            const data = JSON.parse(result.dataJson);

            expect(data.description).toBe(
                "A burst of fire explodes at a point you designate within range.",
            );
        });

        it("handles minimal spell data", () => {
            const result = mapSpell(
                {
                    _id: "min001",
                    name: "Cantrip",
                    type: "spell",
                    system: { level: { value: 0 } },
                },
                "spells",
            );
            const data = JSON.parse(result.dataJson);

            expect(data.name).toBe("Cantrip");
            expect(data.level).toBe(0);
        });
    });

    describe("mapEquipment", () => {
        it("maps equipment with correct data", () => {
            const raw = loadFixture("equipment.json");
            const result = mapEquipment(raw, "equipment");

            expect(result.name).toBe("Longsword");
            expect(result.type).toBe("equipment");
            expect(result.compendiumSource).toBe("Compendium.pf2e.equipment.Item.equip001");

            const data = JSON.parse(result.dataJson);
            expect(data.name).toBe("Longsword");
            expect(data.level).toBe(0);
            expect(data.price).toBe("1 gp");
            expect(data.traits).toEqual(["versatile-p"]);
        });

        it("strips HTML from equipment description", () => {
            const raw = loadFixture("equipment.json");
            const result = mapEquipment(raw, "equipment");
            const data = JSON.parse(result.dataJson);

            expect(data.description).toBe("A standard longsword.");
        });
    });

    describe("mapFeat", () => {
        it("maps feat with correct data", () => {
            const raw = loadFixture("feat.json");
            const result = mapFeat(raw, "feats");

            expect(result.name).toBe("Power Attack");
            expect(result.type).toBe("feat");
            expect(result.compendiumSource).toBe("Compendium.pf2e.feats.Item.feat001");

            const data = JSON.parse(result.dataJson);
            expect(data.name).toBe("Power Attack");
            expect(data.level).toBe(1);
            expect(data.actionType).toBe(2);
            expect(data.traits).toEqual(["fighter", "flourish"]);
        });

        it("strips HTML from feat description", () => {
            const raw = loadFixture("feat.json");
            const result = mapFeat(raw, "feats");
            const data = JSON.parse(result.dataJson);

            expect(data.description).toBe("You unleash a particularly powerful attack.");
        });
    });

    describe("mapEffect", () => {
        it("maps well-formed effect JSON", () => {
            const raw = {
                _id: "effect001",
                name: "Effect: Frost Vial",
                type: "effect",
                system: {
                    description: {
                        value: "<p>Granted by @UUID[Compendium.pf2e.equipment-srd.Item.Frost Vial]</p>\n<p>You take a status penalty to your Speeds.</p>",
                    },
                    level: { value: 3 },
                    traits: { value: ["alchemical", "cold"] },
                },
            };
            const result = mapEffect(raw, "equipment-effects");

            expect(result.type).toBe("effect");
            expect(result.name).toBe("Effect: Frost Vial");
            expect(result.compendiumSource).toBe(
                "Compendium.pf2e.equipment-effects.Item.effect001",
            );

            const data = JSON.parse(result.dataJson);
            expect(data.name).toBe("Effect: Frost Vial");
            expect(data.level).toBe(3);
            expect(data.description).toContain("You take a status penalty to your Speeds.");
            expect(data.description).not.toContain("<p>"); // HTML stripped
            expect(data.traits).toEqual(["alchemical", "cold"]);
        });

        it("handles missing description gracefully", () => {
            const raw = {
                _id: "effect002",
                name: "Effect: Simple Buff",
                type: "effect",
                system: {
                    level: { value: 1 },
                },
            };
            const result = mapEffect(raw, "spell-effects");
            const data = JSON.parse(result.dataJson);

            expect(data.description).toBe("");
            expect(data.traits).toEqual([]);
            expect(data.level).toBe(1);
        });

        it("handles missing system gracefully", () => {
            const raw = {
                _id: "effect003",
                name: "Minimal Effect",
            };
            const result = mapEffect(raw, "other-effects");

            expect(result.name).toBe("Minimal Effect");
            expect(result.type).toBe("effect");

            const data = JSON.parse(result.dataJson);
            expect(data.level).toBe(0);
            expect(data.description).toBe("");
        });

        it("classifies conditions directory", () => {
            expect(classifyPackDirectory("conditions")).toBe("condition");
        });

        it("strips HTML tags including nested @UUID from description", () => {
            const raw = {
                _id: "effect004",
                name: "Complex Effect",
                type: "effect",
                system: {
                    description: {
                        value: "<p>Granted by @UUID[Compendium.pf2e.equipment-srd.Item.Some Item]</p>\n<ul><li>Point 1</li><li>Point 2</li></ul>",
                    },
                },
            };
            const result = mapEffect(raw, "equipment-effects");
            const data = JSON.parse(result.dataJson);

            // @UUID markup stays in text (server resolves it) but HTML tags are stripped
            expect(data.description).toContain(
                "@UUID[Compendium.pf2e.equipment-srd.Item.Some Item]",
            );
            expect(data.description).not.toContain("<p>");
            expect(data.description).not.toContain("<ul>");
            expect(data.description).toContain("Point 1");
        });
    });

    describe("mapClass", () => {
        it("maps class with features and stats", () => {
            const raw = {
                _id: "class001",
                name: "Fighter",
                system: {
                    description: { value: "<p>Martial expert.</p>" },
                    keyAbility: { value: ["str", "dex"] },
                    hp: 10,
                    perception: 1,
                    savingThrows: { fortitude: 2, reflex: 1, will: 0 },
                    attacks: { simple: 2, martial: 2, advanced: 1, unarmed: 2 },
                    defenses: { unarmored: 1, light: 2, heavy: 2 },
                    trainedSkills: { value: ["athletics"], additional: 2 },
                    classFeatLevels: { value: [1, 2, 4, 6] },
                    ancestryFeatLevels: { value: [1, 5, 9, 13] },
                    generalFeatLevels: { value: [3, 7, 11, 15] },
                    skillFeatLevels: { value: [2, 4, 6, 8] },
                    skillIncreaseLevels: { value: [3, 5, 7, 9] },
                    spellcasting: 0,
                    items: {
                        a: { level: 1, name: "Attack of Opportunity", uuid: "Compendium.feat.aoo" },
                        b: { level: 5, name: "Sudden Charge", uuid: "Compendium.feat.sc" },
                    },
                    traits: { rarity: "common" },
                },
            };
            const result = mapClass(raw, "classes");

            expect(result.type).toBe("class");
            expect(result.name).toBe("Fighter");
            expect(result.compendiumSource).toBe("Compendium.pf2e.classes.Item.class001");

            const data = JSON.parse(result.dataJson);
            expect(data.keyAbility).toEqual(["str", "dex"]);
            expect(data.hp).toBe(10);
            expect(data.perception).toBe(1);
            expect(data.savingThrows).toEqual({ fortitude: 2, reflex: 1, will: 0 });
            expect(data.attacks).toEqual({
                simple: 2,
                martial: 2,
                advanced: 1,
                unarmed: 2,
                other: undefined,
            });
            expect(data.defenses).toEqual({ unarmored: 1, light: 2, heavy: 2 });
            expect(data.trainedSkills).toEqual({ value: ["athletics"], additional: 2 });
            expect(data.classFeatLevels).toEqual([1, 2, 4, 6]);
            expect(data.classFeatures).toHaveLength(2);
            expect(data.classFeatures[0].name).toBe("Attack of Opportunity");
            expect(data.description).toBe("Martial expert.");
            expect(data.rarity).toBe("common");
        });

        it("handles minimal class data", () => {
            const result = mapClass({ _id: "c2", name: "Bare" }, "classes");
            const data = JSON.parse(result.dataJson);

            expect(data.hp).toBe(0);
            expect(data.keyAbility).toEqual([]);
            expect(data.classFeatures).toEqual([]);
        });
    });

    describe("mapAncestry", () => {
        it("maps ancestry with boosts, flaws, features", () => {
            const raw = {
                _id: "anc001",
                name: "Dwarf",
                system: {
                    description: { value: "<p>Stout and sturdy.</p>" },
                    boosts: { str: { value: ["str", "con"] } },
                    flaws: { cha: { value: ["cha"] } },
                    hp: 10,
                    size: "med",
                    speed: 20,
                    vision: "darkvision",
                    reach: 5,
                    hands: 2,
                    languages: { value: ["Common", "Dwarven"], custom: "undercommon" },
                    additionalLanguages: { count: 2, value: ["Giant", "Gnomish"] },
                    items: {
                        x: { level: 1, name: "Dwarven Lore", uuid: "Compendium.feat.dl" },
                    },
                    traits: { rarity: "common", value: ["dwarf"] },
                },
            };
            const result = mapAncestry(raw, "ancestries");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("ancestry");
            expect(data.hp).toBe(10);
            expect(data.size).toBe("med");
            expect(data.speed).toBe(20);
            expect(data.vision).toBe("darkvision");
            expect(data.boosts).toEqual({ str: { value: ["str", "con"] } });
            expect(data.flaws).toEqual({ cha: { value: ["cha"] } });
            expect(data.languages).toEqual(["Common", "Dwarven"]);
            expect(data.additionalLanguages).toEqual({ count: 2, value: ["Giant", "Gnomish"] });
            expect(data.ancestryFeatures).toHaveLength(1);
            expect(data.traits).toEqual(["Dwarf"]);
            expect(data.description).toBe("Stout and sturdy.");
        });

        it("handles missing ancestry fields with defaults", () => {
            const result = mapAncestry({ _id: "a2", name: "X" }, "ancestries");
            const data = JSON.parse(result.dataJson);

            expect(data.hp).toBe(0);
            expect(data.size).toBe("med");
            expect(data.speed).toBe(25);
            expect(data.vision).toBe("normal");
            expect(data.reach).toBe(5);
            expect(data.hands).toBe(2);
        });
    });

    describe("mapHeritage", () => {
        it("maps heritage with ancestry link", () => {
            const raw = {
                _id: "her001",
                name: "Ancient Elf",
                system: {
                    description: { value: "<p>Elven heritage.</p>" },
                    ancestry: { name: "Elf", slug: "elf", uuid: "Compendium.anc.elf" },
                    traits: { rarity: "uncommon", value: ["elf"] },
                },
            };
            const result = mapHeritage(raw, "heritages");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("heritage");
            expect(data.ancestry).toEqual({ name: "Elf", slug: "elf" });
            expect(data.traits).toEqual(["Elf"]);
            expect(data.description).toBe("Elven heritage.");
        });

        it("handles heritage without ancestry", () => {
            const result = mapHeritage({ _id: "h2", name: "Unknown" }, "heritages");
            const data = JSON.parse(result.dataJson);

            expect(data.ancestry).toBeUndefined();
        });
    });

    describe("mapBackground", () => {
        it("maps background with skills and granted items", () => {
            const raw = {
                _id: "bg001",
                name: "Warrior",
                system: {
                    description: { value: "<p>You were a soldier.</p>" },
                    boosts: { str: { value: ["str"] }, cha: { value: ["cha"] } },
                    trainedSkills: { value: ["Athletics", "Intimidation"], lore: ["Warfare Lore"] },
                    items: {
                        i: { name: "Sword", uuid: "Compendium.item.sword" },
                    },
                    traits: { rarity: "common" },
                },
            };
            const result = mapBackground(raw, "backgrounds");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("background");
            expect(data.trainedSkills).toEqual({
                value: ["Athletics", "Intimidation"],
                lore: ["Warfare Lore"],
            });
            expect(data.grantedItems).toEqual([{ name: "Sword", uuid: "Compendium.item.sword" }]);
            expect(data.description).toBe("You were a soldier.");
        });
    });

    describe("mapDeity", () => {
        it("maps deity with domains and sanctification", () => {
            const raw = {
                _id: "deity001",
                name: "Sarenrae",
                system: {
                    description: { value: "<p>Goddess of the sun.</p>" },
                    category: "deity",
                    attribute: ["con", "str"],
                    domains: { primary: ["healing", "sun"], alternate: ["fire"] },
                    font: ["heal", "harm"],
                    sanctification: { modal: "can", what: ["holy"] },
                    skill: ["medicine"],
                    spells: { rank1: "heal" },
                    weapons: ["scimitar"],
                },
            };
            const result = mapDeity(raw, "deities");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("deity");
            expect(data.category).toBe("deity");
            expect(data.attribute).toEqual(["con", "str"]);
            expect(data.domains).toEqual({ primary: ["healing", "sun"], alternate: ["fire"] });
            expect(data.font).toEqual(["heal", "harm"]);
            expect(data.sanctification).toEqual({ modal: "can", what: ["holy"] });
            expect(data.skill).toEqual(["medicine"]);
            expect(data.spells).toEqual({ rank1: "heal" });
            expect(data.weapons).toEqual(["scimitar"]);
            expect(data.description).toBe("Goddess of the sun.");
        });

        it("handles minimal deity", () => {
            const result = mapDeity({ _id: "d2", name: "X" }, "deities");
            const data = JSON.parse(result.dataJson);

            expect(data.category).toBe("deity");
            expect(data.attribute).toEqual([]);
            expect(data.domains).toBeUndefined();
            expect(data.sanctification).toBeUndefined();
        });
    });

    describe("mapWeapon", () => {
        it("maps weapon with all fields", () => {
            const raw = {
                _id: "wpn001",
                name: "Longbow",
                system: {
                    description: { value: "<p>A ranged weapon.</p>" },
                    level: { value: 1 },
                    price: { value: { gp: 4 }, per: 1 },
                    traits: { rarity: "common", value: ["deadly-d10", "volley"] },
                    category: "martial",
                    group: "bow",
                    damage: { damageType: "piercing", dice: 1, die: "d8" },
                    range: { value: 100 },
                    reload: { value: 0 },
                    baseItem: "longbow",
                    bulk: 2,
                },
            };
            const result = mapWeapon(raw, "weapons");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("weapon");
            expect(data.level).toBe(1);
            expect(data.price).toBe("4 gp per 1");
            expect(data.category).toBe("martial");
            expect(data.group).toBe("bow");
            expect(data.damage).toBe("1d8 piercing");
            expect(data.range).toBe(100);
            expect(data.reload).toBe(0);
            expect(data.baseItem).toBe("longbow");
            expect(data.bulk).toBe(2);
            expect(data.rarity).toBe("common");
            expect(data.traits).toEqual(["deadly-d10", "volley"]);
            expect(data.description).toBe("A ranged weapon.");
        });

        it("handles weapon with string reload", () => {
            const raw = {
                _id: "wpn002",
                name: "Crossbow",
                system: {
                    reload: "-",
                    damage: { damageType: "piercing", dice: 1, die: "d8" },
                },
            };
            const result = mapWeapon(raw, "weapons");
            const data = JSON.parse(result.dataJson);

            expect(data.reload).toBe("-");
        });
    });

    describe("mapArmor", () => {
        it("maps armor with all fields", () => {
            const raw = {
                _id: "arm001",
                name: "Half Plate",
                system: {
                    description: { value: "<p>Heavy armor.</p>" },
                    level: { value: 2 },
                    price: { value: { gp: 18 } },
                    traits: { rarity: "common", value: ["bulwark"] },
                    acBonus: 4,
                    category: "heavy",
                    group: "plate",
                    checkPenalty: -3,
                    dexCap: 1,
                    speedPenalty: -10,
                    strength: 16,
                    baseItem: "half-plate",
                    bulk: 3,
                },
            };
            const result = mapArmor(raw, "armor");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("armor");
            expect(data.acBonus).toBe(4);
            expect(data.category).toBe("heavy");
            expect(data.checkPenalty).toBe(-3);
            expect(data.dexCap).toBe(1);
            expect(data.speedPenalty).toBe(-10);
            expect(data.strength).toBe(16);
            expect(data.bulk).toBe(3);
            expect(data.description).toBe("Heavy armor.");
        });
    });

    describe("mapShield", () => {
        it("maps shield with all fields", () => {
            const raw = {
                _id: "shd001",
                name: "Steel Shield",
                system: {
                    description: { value: "<p>A sturdy shield.</p>" },
                    level: { value: 1 },
                    price: { value: { gp: 2 } },
                    traits: { rarity: "common", value: [] },
                    acBonus: 2,
                    hardness: 5,
                    hp: { max: 20, value: 20 },
                    speedPenalty: 0,
                    baseItem: "steel-shield",
                    bulk: 1,
                },
            };
            const result = mapShield(raw, "shields");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("shield");
            expect(data.acBonus).toBe(2);
            expect(data.hardness).toBe(5);
            expect(data.hp).toBe(20);
            expect(data.bulk).toBe(1);
            expect(data.description).toBe("A sturdy shield.");
        });
    });

    describe("mapConsumable", () => {
        it("maps consumable with all fields", () => {
            const raw = {
                _id: "con001",
                name: "Healing Potion",
                system: {
                    description: { value: "<p>Restores HP.</p>" },
                    level: { value: 3 },
                    price: { value: { gp: 10 } },
                    traits: { rarity: "common", value: ["consumable", "healing", "magical"] },
                    category: "potion",
                    bulk: 0,
                    usage: "held-in-one-hand",
                },
            };
            const result = mapConsumable(raw, "consumables");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("consumable");
            expect(data.category).toBe("potion");
            expect(data.bulk).toBe(0);
            expect(data.usage).toBe("held-in-one-hand");
            expect(data.level).toBe(3);
            expect(data.description).toBe("Restores HP.");
        });
    });

    describe("mapAmmo", () => {
        it("maps ammo with all fields", () => {
            const raw = {
                _id: "ammo001",
                name: "Arrows",
                system: {
                    description: { value: "<p>Standard arrows.</p>" },
                    level: { value: 0 },
                    price: { value: { sp: 1 } },
                    traits: { rarity: "common", value: [] },
                    baseItem: "arrows",
                    bulk: 0,
                    quantity: 10,
                },
            };
            const result = mapAmmo(raw, "ammo");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("ammo");
            expect(data.baseItem).toBe("arrows");
            expect(data.quantity).toBe(10);
            expect(data.level).toBe(0);
            expect(data.description).toBe("Standard arrows.");
        });
    });

    describe("mapHazard", () => {
        it("maps hazard with all fields", () => {
            const raw = {
                _id: "haz001",
                name: "Poison Dart Trap",
                system: {
                    details: {
                        description: "<p>A hidden trap.</p>",
                        disable: "<p>Thievery DC 20.</p>",
                        isComplex: true,
                        level: { value: 3 },
                        reset: "<p>Resets after 1 hour.</p>",
                        routine: "<p>Fires a dart.</p>",
                    },
                    attributes: {
                        ac: { value: 18 },
                        hardness: 8,
                        hp: { max: 30, value: 30 },
                        stealth: { value: 20, details: "<p>hidden</p>" },
                    },
                    saves: { fortitude: { value: 10 }, reflex: { value: 5 }, will: { value: 0 } },
                    traits: {
                        rarity: "common",
                        value: ["mechanical", "trap"],
                        size: { value: "med" },
                    },
                },
            };
            const result = mapHazard(raw, "hazards");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("hazard");
            expect(data.level).toBe(3);
            expect(data.isComplex).toBe(true);
            expect(data.description).toBe("A hidden trap.");
            expect(data.disable).toBe("Thievery DC 20.");
            expect(data.reset).toBe("Resets after 1 hour.");
            expect(data.routine).toBe("Fires a dart.");
            expect(data.ac).toBe(18);
            expect(data.hardness).toBe(8);
            expect(data.hp).toBe(30);
            expect(data.stealth).toBe(20);
            expect(data.stealthDetails).toBe("hidden");
            expect(data.saves).toEqual({ fortitude: 10, reflex: 5, will: 0 });
            expect(data.size).toBe("med");
            expect(data.traits).toEqual(["Mechanical", "Trap"]);
        });

        it("handles hazard with minimal data", () => {
            const result = mapHazard({ _id: "hz2", name: "Pit" }, "hazards");
            const data = JSON.parse(result.dataJson);

            expect(data.level).toBe(0);
            expect(data.isComplex).toBe(false);
            expect(data.ac).toBe(0);
            expect(data.saves).toBeUndefined();
        });
    });

    describe("mapTreasure", () => {
        it("maps treasure with all fields", () => {
            const raw = {
                _id: "tr001",
                name: "Gold Ring",
                system: {
                    level: { value: 2 },
                    price: { value: { gp: 5 } },
                    traits: { rarity: "common" },
                    category: "treasure",
                    bulk: 0,
                },
            };
            const result = mapTreasure(raw, "treasure");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("treasure");
            expect(data.level).toBe(2);
            expect(data.price).toBe("5 gp");
            expect(data.category).toBe("treasure");
            expect(data.bulk).toBe(0);
        });
    });

    describe("mapBackpack", () => {
        it("maps backpack with all fields", () => {
            const raw = {
                _id: "bp001",
                name: "Backpack",
                system: {
                    description: { value: "<p>A simple backpack.</p>" },
                    level: { value: 0 },
                    price: { value: { sp: 5 } },
                    traits: { rarity: "common", value: [] },
                    bulk: { capacity: 4, heldOrStowed: 0, ignored: 0, value: 1 },
                    stowing: true,
                    usage: "worn",
                },
            };
            const result = mapBackpack(raw, "backpacks");
            const data = JSON.parse(result.dataJson);

            expect(result.type).toBe("backpack");
            expect(data.capacity).toBe(4);
            expect(data.bulk).toBe(1);
            expect(data.stowing).toBe(true);
            expect(data.usage).toBe("worn");
            expect(data.description).toBe("A simple backpack.");
        });
    });
});
