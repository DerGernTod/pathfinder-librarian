import { describe, expect, it } from "bun:test";

import { formatCheck, formatDamage, parseFoundryInline } from "./foundry-inline.js";

describe("foundry-inline", () => {
    describe("parseFoundryInline", () => {
        it("returns plain text segments when no markup", () => {
            const result = parseFoundryInline("No special markup here.");
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: "text",
                text: "No special markup here.",
            });
        });

        it("parses @Check with DC", () => {
            const result = parseFoundryInline("You must succeed at a @Check[athletics|dc:10]");
            expect(result).toHaveLength(2);
            expect(result[0].type).toBe("text");
            expect(result[1]).toEqual({
                type: "check",
                skill: "athletics",
                dc: 10,
                options: { dc: "10" },
            });
        });

        it("parses @Check with against parameter", () => {
            const result = parseFoundryInline("@Check[fortitude|against:class]");
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: "check",
                skill: "fortitude",
                against: "class",
                options: { against: "class" },
            });
        });

        it("parses @Check with name label", () => {
            const result = parseFoundryInline("@Check[athletics|dc:23|name:Pull the Missile Free]");
            expect(result).toHaveLength(1);
            const seg = result[0];
            expect(seg.type).toBe("check");
            if (seg.type === "check") {
                expect(seg.skill).toBe("athletics");
                expect(seg.dc).toBe(23);
                expect(seg.label).toBe("Pull the Missile Free");
            }
        });

        it("parses @Damage with a single damage type", () => {
            const result = parseFoundryInline("@Damage[1d6[acid]]");
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: "damage",
                formula: "1d6",
                damageTypes: ["acid"],
            });
        });

        it("parses @Damage with multiple damage types", () => {
            const result = parseFoundryInline("@Damage[2d6[bludgeoning,magical]]");
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: "damage",
                formula: "2d6",
                damageTypes: ["bludgeoning", "magical"],
            });
        });

        it("parses @Damage with persistent damage", () => {
            const result = parseFoundryInline("@Damage[1d10[persistent,fire]]");
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: "damage",
                formula: "1d10",
                damageTypes: ["persistent", "fire"],
            });
        });

        it("parses @Damage with nested formula containing @item references", () => {
            const result = parseFoundryInline(
                "@Damage[(1d6 + @item.system.runes.potency)[persistent,acid]]",
            );
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: "damage",
                formula: "(1d6 + …)",
                damageTypes: ["persistent", "acid"],
            });
        });

        it("parses mixed content with @Check and @Damage", () => {
            const result = parseFoundryInline(
                "Target must succeed at a @Check[fortitude|dc:25] save or take @Damage[2d8[fire]].",
            );
            expect(result).toHaveLength(5);
            expect(result[0].type).toBe("text");
            expect(result[1].type).toBe("check");
            expect(result[2].type).toBe("text");
            expect(result[3].type).toBe("damage");
            expect(result[4].type).toBe("text");
        });

        it("handles @Damage without damage types", () => {
            const result = parseFoundryInline("@Damage[3d6]");
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: "damage",
                formula: "3d6",
                damageTypes: [],
            });
        });
    });

    describe("formatCheck", () => {
        it("formats a check with DC", () => {
            expect(formatCheck({ type: "check", skill: "athletics", dc: 15 })).toBe(
                "Athletics DC 15",
            );
        });

        it("formats a check with against", () => {
            expect(
                formatCheck({
                    type: "check",
                    skill: "fortitude",
                    against: "class",
                }),
            ).toBe("Fortitude vs. Class DC");
        });

        it("formats a check with label only", () => {
            expect(
                formatCheck({
                    type: "check",
                    skill: "flat",
                    label: "Confusion Recovery",
                }),
            ).toBe("Flat: Confusion Recovery");
        });

        it("formats a simple check with just skill", () => {
            expect(formatCheck({ type: "check", skill: "perception" })).toBe("Perception");
        });

        it("capitalizes the skill name", () => {
            expect(formatCheck({ type: "check", skill: "reflex", dc: 20 })).toBe("Reflex DC 20");
        });
    });

    describe("formatDamage", () => {
        it("formats damage with damage types", () => {
            expect(
                formatDamage({
                    type: "damage",
                    formula: "1d6",
                    damageTypes: ["fire"],
                }),
            ).toBe("1d6 fire");
        });

        it("formats damage with multiple types", () => {
            expect(
                formatDamage({
                    type: "damage",
                    formula: "2d6",
                    damageTypes: ["bludgeoning", "magical"],
                }),
            ).toBe("2d6 bludgeoning magical");
        });

        it("formats damage without damage types", () => {
            expect(
                formatDamage({
                    type: "damage",
                    formula: "3d8",
                    damageTypes: [],
                }),
            ).toBe("3d8");
        });

        it("formats persistent damage", () => {
            expect(
                formatDamage({
                    type: "damage",
                    formula: "1d10",
                    damageTypes: ["persistent", "acid"],
                }),
            ).toBe("1d10 persistent acid");
        });
    });
});
