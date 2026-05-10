import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

import {
    buildCompendiumSource,
    classifyPackDirectory,
    extractEmbeddedItems,
    mapCreature,
    mapEquipment,
    mapFeat,
    mapSpell,
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
            const items = [{ _id: "effect001", name: "Some Effect", type: "effect", system: {} }];
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
                { _id: "min001", name: "Cantrip", type: "spell", system: { level: { value: 0 } } },
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
});
