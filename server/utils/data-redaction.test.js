import { describe, expect, it } from "bun:test";
/** @typedef {import("../../shared/types.js").CreatureData} CreatureData */

import { redactCreatureDataForPlayer, redactRagCreatureSection } from "./data-redaction.js";

describe("data-redaction", () => {
    describe("redactCreatureDataForPlayer", () => {
        /** @type {CreatureData} */
        const fullCreatureData = {
            name: "Orc Warrior",
            type: "Humanoid",
            level: 1,
            rarity: "common",
            traits: ["Orc", "Humanoid"],
            size: "med",
            blurb: "A fierce tribal warrior",
            perception: 7,
            languages: { value: ["Common", "Orcish"] },
            initiative: "perception",
            publication: { license: "OGL", title: "Bestiary" },
            privateNotes: "GM notes here",
            attributes: {
                ac: { value: 15 },
                hp: { value: 23, max: 23 },
                fortitude: { value: 9 },
                reflex: { value: 8 },
                will: { value: 6 },
                speed: "20 feet",
            },
            abilities: {
                str: { mod: 4 },
                dex: { mod: 2 },
                con: { mod: 2 },
                int: { mod: -1 },
                wis: { mod: -1 },
                cha: { mod: 0 },
            },
            skills: { Athletics: { value: 12 }, Intimidation: { value: 8 } },
            melee: [
                {
                    name: "Greataxe",
                    attack: "+9",
                    damage: "1d12+4 slashing",
                    damageType: "slashing",
                },
            ],
            spellcasting: [{ name: "Orc Spells", tradition: "divine", dc: 14 }],
            actions: [
                {
                    name: "Ferocity",
                    actionType: "reaction",
                    description: "When reduced to 0 HP...",
                },
            ],
            description: "A hulking green-skinned warrior.",
            compendiumSource: "Bestiary p.42",
            itemRefs: ["ref-1", "ref-2"],
            traitRefs: [
                { name: "Orc", ruleItemId: "id-orc" },
                { name: "Humanoid", ruleItemId: "id-humanoid" },
            ],
        };

        it("keeps only observable fields", () => {
            const result = redactCreatureDataForPlayer(fullCreatureData);

            expect(result.name).toBe("Orc Warrior");
            expect(result.type).toBe("Humanoid");
            expect(result.rarity).toBe("common");
            expect(result.traits).toEqual(["Orc", "Humanoid"]);
            expect(result.size).toBe("med");
            expect(result.blurb).toBe("A fierce tribal warrior");
            expect(result.traitRefs).toEqual([
                { name: "Orc", ruleItemId: "id-orc" },
                { name: "Humanoid", ruleItemId: "id-humanoid" },
            ]);
        });

        it("sets redacted to true", () => {
            const result = redactCreatureDataForPlayer(fullCreatureData);

            expect(result.redacted).toBe(true);
        });

        it("strips all numeric/mechanic fields", () => {
            const result = redactCreatureDataForPlayer(fullCreatureData);

            expect(result.level).toBeUndefined();
            expect(result.perception).toBeUndefined();
            expect(result.languages).toBeUndefined();
            expect(result.initiative).toBeUndefined();
            expect(result.attributes).toBeUndefined();
            expect(result.abilities).toBeUndefined();
            expect(result.skills).toBeUndefined();
            expect(result.melee).toBeUndefined();
            expect(result.spellcasting).toBeUndefined();
            expect(result.actions).toBeUndefined();
            expect(result.description).toBeUndefined();
            expect(result.compendiumSource).toBeUndefined();
            expect(result.itemRefs).toBeUndefined();
            expect(result.publication).toBeUndefined();
            expect(result.privateNotes).toBeUndefined();
        });

        it("handles minimal creature data gracefully", () => {
            /** @type {CreatureData} */
            const minimal = { name: "Shadow", level: 0, traits: ["Undead"] };
            const result = redactCreatureDataForPlayer(minimal);

            expect(result.name).toBe("Shadow");
            expect(result.traits).toEqual(["Undead"]);
            expect(result.redacted).toBe(true);
        });

        it("handles empty creature data gracefully", () => {
            // @ts-expect-error — intentionally passing empty object to test robustness
            const result = redactCreatureDataForPlayer({});

            expect(result.redacted).toBe(true);
            expect(result.name).toBeUndefined();
        });

        it("does not copy disallowed fields even if present", () => {
            /** @type {CreatureData} */
            const data = { name: "Test", level: 5, traits: [], attributes: { ac: { value: 20 } } };
            const result = redactCreatureDataForPlayer(data);

            expect(result.level).toBeUndefined();
            expect(result.attributes).toBeUndefined();
        });
    });

    describe("redactRagCreatureSection", () => {
        it("preserves header line", () => {
            const text = "--- Orc Warrior (creature) [ID: abc-123] ---\nSome stat info";
            const result = redactRagCreatureSection(text);

            expect(result).toContain("--- Orc Warrior (creature) [ID: abc-123] ---");
        });

        it("strips AC and HP lines", () => {
            const text = [
                "--- Orc (creature) [ID: abc] ---",
                "AC 21; Fort +10, Ref +9, Will +7",
                "HP 55/55",
            ].join("\n");
            const result = redactRagCreatureSection(text);

            expect(result).not.toContain("AC 21");
            expect(result).not.toContain("HP 55");
        });

        it("strips ability score lines", () => {
            const text = ["--- Orc (creature) [ID: abc] ---", "STR +4, DEX +2, CON +3"].join("\n");
            const result = redactRagCreatureSection(text);

            expect(result).not.toContain("STR +4");
            expect(result).not.toContain("DEX +2");
        });

        it("preserves observable trait and size lines", () => {
            const text = [
                "--- Orc (creature) [ID: abc] ---",
                "Traits: Orc, Humanoid",
                "Size: Medium",
                "Rarity: Common",
            ].join("\n");
            const result = redactRagCreatureSection(text);

            expect(result).toContain("Traits: Orc, Humanoid");
            expect(result).toContain("Size: Medium");
            expect(result).toContain("Rarity: Common");
        });

        it("preserves blurb lines", () => {
            const text = ["--- Orc (creature) [ID: abc] ---", "Blurb: A fierce warrior"].join("\n");
            const result = redactRagCreatureSection(text);

            expect(result).toContain("Blurb: A fierce warrior");
        });

        it("strips dice notation lines", () => {
            const text = [
                "--- Orc (creature) [ID: abc] ---",
                "Melee greataxe +9 (damage 1d12+4 slashing)",
            ].join("\n");
            const result = redactRagCreatureSection(text);

            expect(result).not.toContain("1d12+4");
        });

        it("strips DC values", () => {
            const text = ["--- Orc (creature) [ID: abc] ---", "Spell DC 17, attack +7"].join("\n");
            const result = redactRagCreatureSection(text);

            expect(result).not.toContain("DC 17");
        });

        it("preserves plain narrative lines without stats", () => {
            const text = [
                "--- Orc (creature) [ID: abc] ---",
                "A towering green-skinned humanoid.",
            ].join("\n");
            const result = redactRagCreatureSection(text);

            expect(result).toContain("A towering green-skinned humanoid.");
        });

        it("handles empty string", () => {
            const result = redactRagCreatureSection("");
            expect(result).toBe("");
        });

        it("strips skill modifier lines", () => {
            const text = ["--- Goblin (creature) [ID: abc] ---", "Athletics +7, Stealth +9"].join(
                "\n",
            );
            const result = redactRagCreatureSection(text);

            expect(result).not.toContain("Athletics +7");
            expect(result).not.toContain("Stealth +9");
        });
    });
});
