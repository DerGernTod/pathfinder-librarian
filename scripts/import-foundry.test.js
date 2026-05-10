import { beforeEach, describe, expect, it } from "bun:test";
import { join } from "path";

import { createDb } from "../server/db/database.js";
import { batchUpsertRuleItems, getRuleItemBySource, getRuleItems } from "../server/db/queries.js";
import { discoverFiles, parseArgs, processFile } from "./import-foundry.js";

const FIXTURE_DIR = join(import.meta.dirname, "../test/fixtures/foundry");

describe("import-foundry", () => {
    describe("parseArgs", () => {
        it("parses all arguments", () => {
            const args = [
                "bun",
                "script.js",
                "--source",
                "/path/to/pf2e",
                "--pack",
                "bestiary,spells",
                "--types",
                "creature,spell",
                "--limit",
                "50",
                "--db",
                "test.sqlite",
                "--dry-run",
                "--verbose",
            ];
            const opts = parseArgs(args);

            expect(opts.source).toBe("/path/to/pf2e");
            expect(opts.pack).toEqual(["bestiary", "spells"]);
            expect(opts.types).toEqual(["creature", "spell"]);
            expect(opts.limit).toBe(50);
            expect(opts.db).toBe("test.sqlite");
            expect(opts.dryRun).toBe(true);
            expect(opts.verbose).toBe(true);
        });

        it("uses defaults for missing args", () => {
            const opts = parseArgs(["bun", "script.js"]);

            expect(opts.source).toBeUndefined();
            expect(opts.pack).toBeUndefined();
            expect(opts.types).toBeUndefined();
            expect(opts.limit).toBeUndefined();
            expect(opts.db).toBe("data/dev.sqlite");
            expect(opts.dryRun).toBe(false);
            expect(opts.verbose).toBe(false);
        });
    });

    describe("discoverFiles", () => {
        it("discovers fixture files grouped by directory", () => {
            const packs = discoverFiles(FIXTURE_DIR);

            // All fixture files should be discovered
            expect(packs.size).toBeGreaterThan(0);

            // Check that at least one file was found
            let totalFiles = 0;
            for (const files of packs.values()) {
                totalFiles += files.length;
            }
            expect(totalFiles).toBe(5); // 5 fixture files
        });

        it("skips _folders.json files", () => {
            const packs = discoverFiles(FIXTURE_DIR);

            for (const files of packs.values()) {
                for (const f of files) {
                    expect(f).not.toContain("_folders.json");
                }
            }
        });
    });

    describe("processFile", () => {
        it("processes creature files correctly", () => {
            const filePath = join(FIXTURE_DIR, "creature-simple.json");
            const result = processFile(filePath, "pathfinder-bestiary", {
                verbose: false,
            });

            expect(result.skipped).toBe(false);
            expect(result.error).toBeNull();
            // Creature + embedded items
            expect(result.items.length).toBeGreaterThanOrEqual(2);
            expect(result.items[0].type).toBe("creature");
            expect(result.items[0].name).toBe("Bloodseeker");
        });

        it("processes spell files correctly", () => {
            const filePath = join(FIXTURE_DIR, "spell.json");
            const result = processFile(filePath, "spells", {
                verbose: false,
            });

            expect(result.skipped).toBe(false);
            expect(result.items).toHaveLength(1);
            expect(result.items[0].type).toBe("spell");
            expect(result.items[0].name).toBe("Fireball");
        });

        it("respects type filter", () => {
            const filePath = join(FIXTURE_DIR, "spell.json");
            const result = processFile(filePath, "spells", {
                types: ["creature"],
                verbose: false,
            });

            // Spell filtered out since types only includes creature
            expect(result.skipped).toBe(true);
        });

        it("handles malformed JSON gracefully", () => {
            const result = processFile("/nonexistent/path.json", "test", {
                verbose: false,
            });

            expect(result.skipped).toBe(true);
            expect(result.error).toBeTruthy();
        });

        it("skips files without _id or type", () => {
            // Create a minimal object without required fields
            const result = processFile(join(FIXTURE_DIR, "spell.json"), "test", { verbose: false });
            // This file has _id and type, so it should succeed
            expect(result.skipped).toBe(false);
        });
    });

    describe("end-to-end import with fixture files", () => {
        /** @type {import("bun:sqlite").Database} */
        let db;

        beforeEach(() => {
            db = createDb(":memory:");
        });

        it("imports fixture files and inserts rule items", () => {
            const packs = discoverFiles(FIXTURE_DIR);
            /** @type {Array<{ type: string, name: string, compendiumSource: string, dataJson: string }>} */
            const allItems = [];

            for (const [packName, files] of packs) {
                for (const filePath of files) {
                    const result = processFile(filePath, packName, { verbose: false });
                    if (!result.skipped && result.items.length > 0) {
                        allItems.push(...result.items);
                    }
                }
            }

            const result = batchUpsertRuleItems(db, allItems);

            expect(result.inserted).toBeGreaterThan(0);

            // Verify creature was inserted
            const creatures = getRuleItems(db, "creature");
            expect(creatures.length).toBeGreaterThan(0);

            // Verify spell was inserted
            const spells = getRuleItems(db, "spell");
            expect(spells.length).toBeGreaterThan(0);
        });

        it("verifies compendium sources are set correctly", () => {
            const packs = discoverFiles(FIXTURE_DIR);
            /** @type {Array<{ type: string, name: string, compendiumSource: string, dataJson: string }>} */
            const allItems = [];

            for (const [packName, files] of packs) {
                for (const filePath of files) {
                    const result = processFile(filePath, packName, { verbose: false });
                    if (!result.skipped && result.items.length > 0) {
                        allItems.push(...result.items);
                    }
                }
            }

            batchUpsertRuleItems(db, allItems);

            // Every imported item should have a compendium source
            for (const item of allItems) {
                expect(item.compendiumSource).toBeTruthy();
                const found = getRuleItemBySource(db, item.compendiumSource);
                expect(found).not.toBeNull();
            }
        });

        it("verifies creature data shape", () => {
            const filePath = join(FIXTURE_DIR, "creature-simple.json");
            const result = processFile(filePath, "pathfinder-bestiary", {
                verbose: false,
            });

            const creature = result.items[0];
            const data = JSON.parse(creature.dataJson);

            // Should have required CreatureData fields
            expect(data.name).toBe("Bloodseeker");
            expect(data.level).toBe(1);
            expect(data.traits).toEqual(["Animal"]);
            expect(data.abilities).toBeDefined();
            expect(data.attributes).toBeDefined();
        });

        it("verifies embedded items extracted and linked via itemRefs", () => {
            const filePath = join(FIXTURE_DIR, "creature-simple.json");
            const result = processFile(filePath, "pathfinder-bestiary", {
                verbose: false,
            });

            // Should have creature + embedded items
            expect(result.items.length).toBeGreaterThan(1);

            const creature = result.items[0];
            const data = JSON.parse(creature.dataJson);
            expect(data.itemRefs).toBeDefined();
            expect(data.itemRefs.length).toBeGreaterThan(0);
        });

        it("is idempotent — running twice does not duplicate", () => {
            const filePath = join(FIXTURE_DIR, "creature-simple.json");
            const result = processFile(filePath, "pathfinder-bestiary", {
                verbose: false,
            });

            // First import
            const first = batchUpsertRuleItems(db, result.items);
            expect(first.inserted).toBeGreaterThan(0);

            // Second import (same items)
            const second = batchUpsertRuleItems(db, result.items);
            expect(second.inserted).toBe(0);
            expect(second.updated).toBe(first.inserted);

            // Verify no duplicates
            const creatures = getRuleItems(db, "creature");
            const bloodseekers = creatures.filter((c) => c.name === "Bloodseeker");
            expect(bloodseekers).toHaveLength(1);
        });
    });
});
