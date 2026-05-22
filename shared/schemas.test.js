import { describe, expect, it } from "bun:test";

import { customStatBlockSchema, messageBlockSchema } from "./schemas.js";

describe("customStatBlockSchema", () => {
    it("validates a minimal valid block with name and level only", () => {
        const block = {
            type: /** @type {const} */ ("custom-stat-block"),
            title: "Sylvaris",
            data: { name: "Sylvaris", level: 5 },
        };
        expect(customStatBlockSchema.parse(block)).toEqual(block);
    });

    it("validates a full block with all optional fields", () => {
        const block = {
            type: /** @type {const} */ ("custom-stat-block"),
            title: "Orc Warchief",
            data: {
                name: "Orc Warchief",
                type: "Humanoid",
                level: 6,
                rarity: "unique",
                traits: ["Orc", "Humanoid"],
                perception: 12,
                languages: { value: ["Common", "Orcish"], details: "also speaks Draconic" },
                size: "lg",
                blurb: "A fearsome orc leader",
                attributes: {
                    ac: { value: 22, details: "armor" },
                    hp: { value: 120, max: 120, details: "regeneration 5" },
                    fortitude: { value: 15, saveDetail: "+1 status from courage" },
                    reflex: { value: 10, saveDetail: "" },
                    will: { value: 13, saveDetail: "" },
                    speed: "25 feet",
                },
                abilities: {
                    str: { mod: 5 },
                    dex: { mod: 2 },
                    con: { mod: 4 },
                    int: { mod: 0 },
                    wis: { mod: 1 },
                    cha: { mod: 2 },
                },
                skills: { Athletics: { value: 15 }, Intimidation: { value: 12 } },
                melee: [
                    {
                        name: "Greataxe",
                        attack: "+15",
                        damage: "2d12+5 slashing",
                        damageType: "slashing",
                        traits: ["sweep", "versatile piercing"],
                    },
                ],
                actions: [
                    {
                        name: "Rage",
                        actionType: 1,
                        traits: ["concentrate", "emotion", "mental"],
                        description: "The orc flies into a rage.",
                    },
                    {
                        name: "Roar",
                        actionType: /** @type {const} */ ("reaction"),
                        traits: ["auditory", "emotion", "fear"],
                        description: "The orc lets out a terrifying roar.",
                    },
                ],
                spellcasting: [
                    {
                        name: "Orc Innate Spells",
                        tradition: "divine",
                        type: "innate",
                        dc: 22,
                        attackModifier: 14,
                        slots: {
                            "3rd": [{ name: "Heroism", rank: 3 }],
                        },
                        cantrips: [{ name: "Vitality Lash", rank: 0 }],
                    },
                ],
                description: "The leader of the Bloodmoon clan.",
            },
        };
        expect(customStatBlockSchema.parse(block)).toEqual(block);
    });

    it("rejects block missing required title", () => {
        const block = {
            type: "custom-stat-block",
            data: { name: "Sylvaris", level: 5 },
        };
        expect(() => customStatBlockSchema.parse(block)).toThrow();
    });

    it("rejects block missing required data", () => {
        const block = {
            type: "custom-stat-block",
            title: "Sylvaris",
        };
        expect(() => customStatBlockSchema.parse(block)).toThrow();
    });

    it("rejects block with data missing name", () => {
        const block = {
            type: "custom-stat-block",
            title: "Sylvaris",
            data: { level: 5 },
        };
        expect(() => customStatBlockSchema.parse(block)).toThrow();
    });

    it("rejects block with data missing level", () => {
        const block = {
            type: "custom-stat-block",
            title: "Sylvaris",
            data: { name: "Sylvaris" },
        };
        expect(() => customStatBlockSchema.parse(block)).toThrow();
    });
});

describe("messageBlockSchema union", () => {
    it("accepts custom-stat-block blocks", () => {
        const block = {
            type: /** @type {const} */ ("custom-stat-block"),
            title: "Sylvaris",
            data: { name: "Sylvaris", level: 5 },
        };
        expect(messageBlockSchema.parse(block)).toEqual(block);
    });

    it("still accepts text blocks", () => {
        const block = { type: /** @type {const} */ ("text"), markdown: "Hello" };
        expect(messageBlockSchema.parse(block)).toEqual(block);
    });

    it("still accepts callout blocks", () => {
        const block = {
            type: /** @type {const} */ ("callout"),
            title: "Note",
            markdown: "Hello",
        };
        expect(messageBlockSchema.parse(block)).toEqual(block);
    });

    it("still accepts stat-block blocks", () => {
        const block = { type: /** @type {const} */ ("stat-block"), ruleItemId: "abc-123" };
        expect(messageBlockSchema.parse(block)).toEqual(block);
    });

    it("still accepts rule-detail blocks", () => {
        const block = { type: /** @type {const} */ ("rule-detail"), ruleItemId: "abc-123" };
        expect(messageBlockSchema.parse(block)).toEqual(block);
    });
});
