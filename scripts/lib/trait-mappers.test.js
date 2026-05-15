import { describe, expect, it } from "bun:test";

import { mapCondition, mapTrait } from "./trait-mappers.js";

describe("trait-mappers", () => {
    describe("mapTrait", () => {
        it("maps well-formed trait JSON", () => {
            const raw = {
                _id: "trait001",
                name: "Humanoid",
                type: "trait",
                system: {
                    description: { value: "<p>Humanoid creatures are human-shaped.</p>" },
                    category: "creature",
                },
            };
            const result = mapTrait(raw, "traits");

            expect(result.type).toBe("trait");
            expect(result.name).toBe("Humanoid");
            expect(result.compendiumSource).toBe("Compendium.pf2e.traits.Item.trait001");

            const data = JSON.parse(result.dataJson);
            expect(data.name).toBe("Humanoid");
            expect(data.description).toBe("Humanoid creatures are human-shaped.");
            expect(data.category).toBe("creature");
        });

        it("handles missing description gracefully", () => {
            const raw = {
                _id: "trait002",
                name: "Fire",
                type: "trait",
                system: {},
            };
            const result = mapTrait(raw, "traits");
            const data = JSON.parse(result.dataJson);

            expect(data.description).toBe("");
        });

        it("handles missing system gracefully", () => {
            const raw = {
                _id: "trait003",
                name: "Cold",
            };
            const result = mapTrait(raw, "traits");

            expect(result.name).toBe("Cold");
            expect(result.type).toBe("trait");
        });
    });

    describe("mapCondition", () => {
        it("maps well-formed condition JSON", () => {
            const raw = {
                _id: "cond001",
                name: "Enfeebled",
                type: "condition",
                system: {
                    description: {
                        value: "<p>You take a status penalty to Strength-based rolls.</p>",
                    },
                    references: { some: "data" },
                },
            };
            const result = mapCondition(raw, "conditionitems");

            expect(result.type).toBe("condition");
            expect(result.name).toBe("Enfeebled");
            expect(result.compendiumSource).toBe("Compendium.pf2e.conditionitems.Item.cond001");

            const data = JSON.parse(result.dataJson);
            expect(data.name).toBe("Enfeebled");
            expect(data.description).toBe("You take a status penalty to Strength-based rolls.");
            expect(data.category).toBe("condition");
            expect(data.references).toEqual({ some: "data" });
        });

        it("handles missing description gracefully", () => {
            const raw = {
                _id: "cond002",
                name: "Clumsy",
                type: "condition",
                system: {},
            };
            const result = mapCondition(raw, "conditionitems");
            const data = JSON.parse(result.dataJson);

            expect(data.description).toBe("");
        });
    });
});
