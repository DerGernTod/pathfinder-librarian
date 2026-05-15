import { beforeEach, describe, expect, it } from "bun:test";

import { createDb } from "../db/database.js";
import * as queries from "../db/queries.js";
import { loadLocalizations, resolveLocalizeRefs, resolveUuidRefs } from "./foundry-refs.js";

describe("foundry-refs", () => {
    /** @type {import("bun:sqlite").Database} */
    let db;

    beforeEach(() => {
        db = createDb(":memory:");
        // Seed some rule items for UUID resolution
        queries.batchUpsertRuleItems(db, [
            {
                type: "action",
                name: "Shield Block",
                compendiumSource: "Compendium.pf2e.actions.Item.ShieldBlock",
                dataJson: JSON.stringify({
                    name: "Shield Block",
                    description: "You snap your shield into place.",
                }),
            },
            {
                type: "action",
                name: "Sneak",
                compendiumSource: "Compendium.pf2e.actions.Item.Sneak",
                dataJson: JSON.stringify({
                    name: "Sneak",
                    description: "You can attempt to move to another place...",
                }),
            },
        ]);
    });

    describe("resolveUuidRefs", () => {
        it("resolves known @UUID references to segments with ruleItemId", () => {
            const text =
                "You can @UUID[Compendium.pf2e.actions.Item.ShieldBlock]{Shield Block} to reduce damage.";
            const result = resolveUuidRefs(text, db);

            expect(result.segments).toHaveLength(3);
            expect(result.segments[0].text).toBe("You can ");
            expect(result.segments[1].text).toBe("Shield Block");
            expect(result.segments[1].ruleItemId).toBeDefined();
            expect(result.segments[2].text).toBe(" to reduce damage.");
        });

        it("resolves unknown compendium source without ruleItemId", () => {
            const text = "Use @UUID[Compendium.pf2e.unknown.Item.Foo]{Unknown Thing} carefully.";
            const result = resolveUuidRefs(text, db);

            expect(result.segments).toHaveLength(3);
            expect(result.segments[1].text).toBe("Unknown Thing");
            expect(result.segments[1].ruleItemId).toBeUndefined();
        });

        it("handles multiple @UUID refs in one string", () => {
            const text =
                "@UUID[Compendium.pf2e.actions.Item.ShieldBlock]{Shield Block} and @UUID[Compendium.pf2e.actions.Item.Sneak]{Sneak}";
            const result = resolveUuidRefs(text, db);

            expect(result.segments).toHaveLength(3);
            expect(result.segments[0].text).toBe("Shield Block");
            expect(result.segments[0].ruleItemId).toBeDefined();
            expect(result.segments[1].text).toBe(" and ");
            expect(result.segments[2].text).toBe("Sneak");
            expect(result.segments[2].ruleItemId).toBeDefined();
        });

        it("returns single segment when text has no refs", () => {
            const text = "No references here.";
            const result = resolveUuidRefs(text, db);

            expect(result.segments).toHaveLength(1);
            expect(result.segments[0].text).toBe("No references here.");
            expect(result.segments[0].ruleItemId).toBeUndefined();
        });

        it("handles empty string", () => {
            const result = resolveUuidRefs("", db);
            expect(result.segments).toHaveLength(0);
        });

        it("resolves bare @UUID without display text using DB item name", () => {
            const text = "@UUID[Compendium.pf2e.actions.Item.ShieldBlock]";
            const result = resolveUuidRefs(text, db);

            expect(result.segments).toHaveLength(1);
            expect(result.segments[0].text).toBe("Shield Block");
            expect(result.segments[0].ruleItemId).toBeDefined();
        });

        it("resolves bare @UUID without display text for unknown source using friendly name", () => {
            const text = "@UUID[Compendium.pf2e.equipment-effects.Item.Effect: Frost Vial]";
            const result = resolveUuidRefs(text, db);

            expect(result.segments).toHaveLength(1);
            // Should extract "Effect: Frost Vial" from the UUID path
            expect(result.segments[0].text).toBe("Effect: Frost Vial");
            expect(result.segments[0].ruleItemId).toBeUndefined();
        });

        it("resolves bare @UUID with opaque hex ID using pack name", () => {
            const text = "@UUID[Compendium.pf2e.conditionitems.Item.a1b2c3d4e5f6a7b8]";
            const result = resolveUuidRefs(text, db);

            expect(result.segments).toHaveLength(1);
            // Pure hex ID → falls back to pack name "conditionitems"
            expect(result.segments[0].text).toBe("conditionitems");
            expect(result.segments[0].ruleItemId).toBeUndefined();
        });

        it("mixes bare @UUID and @UUID with display text in one string", () => {
            const text =
                "Use @UUID[Compendium.pf2e.actions.Item.ShieldBlock]{Shield Block} then @UUID[Compendium.pf2e.equipment-effects.Item.Effect: Frost Vial]";
            const result = resolveUuidRefs(text, db);

            expect(result.segments).toHaveLength(4);
            expect(result.segments[0].text).toBe("Use ");
            expect(result.segments[1].text).toBe("Shield Block");
            expect(result.segments[1].ruleItemId).toBeDefined();
            expect(result.segments[2].text).toBe(" then ");
            expect(result.segments[3].text).toBe("Effect: Frost Vial");
            expect(result.segments[3].ruleItemId).toBeUndefined();
        });
    });

    describe("resolveLocalizeRefs", () => {
        it("resolves known @Localize key", () => {
            const localizations = new Map();
            localizations.set("PF2E.Actions.ShieldBlock", "Shield Block");
            const text = "Use @Localize[PF2E.Actions.ShieldBlock] to block.";
            const result = resolveLocalizeRefs(text, localizations);

            expect(result).toBe("Use Shield Block to block.");
        });

        it("keeps raw key as fallback for unknown key", () => {
            const localizations = new Map();
            const text = "Use @Localize[PF2E.Unknown.Key] carefully.";
            const result = resolveLocalizeRefs(text, localizations);

            expect(result).toBe("Use @Localize[PF2E.Unknown.Key] carefully.");
        });

        it("resolves multiple keys in one string", () => {
            const localizations = new Map();
            localizations.set("PF2E.Key1", "Value1");
            localizations.set("PF2E.Key2", "Value2");
            const text = "@Localize[PF2E.Key1] and @Localize[PF2E.Key2]";
            const result = resolveLocalizeRefs(text, localizations);

            expect(result).toBe("Value1 and Value2");
        });

        it("returns unchanged text when no @Localize refs", () => {
            const localizations = new Map();
            const text = "No references here.";
            const result = resolveLocalizeRefs(text, localizations);

            expect(result).toBe("No references here.");
        });
    });

    describe("loadLocalizations", () => {
        it("returns empty map when file does not exist", () => {
            const result = loadLocalizations();
            expect(result).toBeInstanceOf(Map);
        });
    });
});
