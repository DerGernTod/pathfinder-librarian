import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { unlinkSync, writeFileSync } from "fs";
import { join } from "path";

import { createDb } from "../server/db/database.js";
import {
    batchUpsertRuleItems,
    getChildItems,
    getRuleItemBySource,
    getRuleItems,
} from "../server/db/queries.js";
import { discoverFiles, importFromDir, parseArgs, processFile } from "./lib/import-foundry-core.js";

const FIXTURE_DIR = join(import.meta.dirname, "../test/fixtures/foundry");

/**
 * Two-phase insert: root items first, then children with resolved parentId.
 * @param {import("bun:sqlite").Database} db
 * @param {Array<{ type: string, name: string, compendiumSource: string, dataJson: string, parentId?: string }>} items
 */
function twoPhaseInsert(db, items) {
    const rootItems = items.filter((item) => !item.parentId);
    batchUpsertRuleItems(db, rootItems);

    const childItems = items.filter((item) => item.parentId);
    for (const child of childItems) {
        const parent = getRuleItemBySource(db, /** @type {string} */ (child.parentId));
        if (parent) {
            child.parentId = parent.id;
        } else {
            child.parentId = undefined;
        }
    }
    batchUpsertRuleItems(db, childItems);
}

describe("import-foundry-core", () => {
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
            const opts = parseArgs(["bun", "script.js", "--verbose"]);

            expect(opts.source).toBeUndefined();
            expect(opts.pack).toBeUndefined();
            expect(opts.types).toBeUndefined();
            expect(opts.limit).toBeUndefined();
            expect(opts.db).toBe("data/dev.sqlite");
            expect(opts.dryRun).toBe(false);
            expect(opts.verbose).toBe(true);
        });

        it("exits with help when called with --help", () => {
            const originalExit = process.exit;
            /** @type {string[]} */
            const logs = [];
            const originalLog = console.log;
            console.log = (...args) => logs.push(String(args[0]));
            process.exit = (/** @type {number} */ code) => {
                throw { code, logs };
            };
            try {
                parseArgs(["bun", "script.js", "--help"]);
            } catch (/** @type {unknown} */ e) {
                const err = /** @type {{ code: number, logs: string[] }} */ (e);
                expect(err.code).toBe(0);
                expect(err.logs[0]).toContain("Usage:");
            } finally {
                process.exit = originalExit;
                console.log = originalLog;
            }
        });
    });

    describe("discoverFiles", () => {
        it("discovers fixture files grouped by directory", () => {
            const packs = discoverFiles(FIXTURE_DIR);

            expect(packs.size).toBeGreaterThan(0);

            let totalFiles = 0;
            for (const files of packs.values()) {
                totalFiles += files.length;
            }
            expect(totalFiles).toBe(5);
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
            const tmpPath = join(FIXTURE_DIR, "_test_no_id.json");
            writeFileSync(tmpPath, JSON.stringify({ name: "Nope" }));
            try {
                const result = processFile(tmpPath, "test", { verbose: false });
                expect(result.skipped).toBe(true);
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes action type files with type override", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_action.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "act001",
                    name: "Demoralize",
                    type: "action",
                    system: {
                        actionType: { value: "action" },
                        actions: { value: 1 },
                        description: { value: "<p>Intimidate a foe.</p>" },
                        traits: { value: ["mental", "skill"] },
                    },
                }),
            );
            try {
                const result = processFile(tmpPath, "actions", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items).toHaveLength(1);
                expect(result.items[0].type).toBe("action");
                expect(result.items[0].name).toBe("Demoralize");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes effect type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_effect.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "eff001",
                    name: "Effect: Inspire Courage",
                    type: "effect",
                    system: {
                        description: { value: "<p>+1 status bonus to attack rolls.</p>" },
                        level: { value: 1 },
                        traits: { value: ["bard", "enchantment"] },
                    },
                }),
            );
            try {
                const result = processFile(tmpPath, "spell-effects", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items).toHaveLength(1);
                expect(result.items[0].type).toBe("effect");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes condition type files with pack name override", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_condition.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "cond001",
                    name: "Blinded",
                    type: "condition",
                    system: {
                        description: { value: "<p>You cannot see.</p>" },
                    },
                }),
            );
            try {
                const result = processFile(tmpPath, "conditions", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items).toHaveLength(1);
                expect(result.items[0].type).toBe("condition");
                const data = JSON.parse(result.items[0].dataJson);
                expect(data.compendiumSource).toContain("conditionitems");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes condition type without pack name override", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_condition2.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "cond002",
                    name: "Drained",
                    type: "condition",
                    system: {
                        description: { value: "<p>You lose hit points.</p>" },
                    },
                }),
            );
            try {
                const result = processFile(tmpPath, "other-conditions", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("condition");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes class type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_class.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "class001",
                    name: "Fighter",
                    type: "class",
                    system: {
                        description: { value: "Martial." },
                        keyAbility: { value: ["str"] },
                        hp: 10,
                    },
                }),
            );
            try {
                const result = processFile(tmpPath, "classes", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items).toHaveLength(1);
                expect(result.items[0].type).toBe("class");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes ancestry type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_ancestry.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "anc001",
                    name: "Dwarf",
                    type: "ancestry",
                    system: { hp: 10 },
                }),
            );
            try {
                const result = processFile(tmpPath, "ancestries", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("ancestry");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes heritage type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_heritage.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "her001",
                    name: "Ancient Elf",
                    type: "heritage",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "heritages", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("heritage");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes background type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_background.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "bg001",
                    name: "Warrior",
                    type: "background",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "backgrounds", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("background");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes deity type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_deity.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "deity001",
                    name: "Sarenrae",
                    type: "deity",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "deities", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("deity");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes weapon type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_weapon.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "wpn001",
                    name: "Longsword",
                    type: "weapon",
                    system: { damage: { damageType: "slashing", dice: 1, die: "d8" } },
                }),
            );
            try {
                const result = processFile(tmpPath, "weapons", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("weapon");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes armor type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_armor.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "arm001",
                    name: "Chain Mail",
                    type: "armor",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "armor", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("armor");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes shield type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_shield.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "shd001",
                    name: "Steel Shield",
                    type: "shield",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "shields", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("shield");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes consumable type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_consumable.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "con001",
                    name: "Potion",
                    type: "consumable",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "consumables", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("consumable");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes ammo type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_ammo.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "ammo001",
                    name: "Arrows",
                    type: "ammo",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "ammo", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("ammo");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes hazard type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_hazard.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "haz001",
                    name: "Trap",
                    type: "hazard",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "hazards", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("hazard");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes treasure type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_treasure.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "tr001",
                    name: "Gold",
                    type: "treasure",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "treasure", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("treasure");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("processes backpack type files", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_backpack.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "bp001",
                    name: "Backpack",
                    type: "backpack",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "backpacks", { verbose: false });
                expect(result.skipped).toBe(false);
                expect(result.items[0].type).toBe("backpack");
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("skips unknown types", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_unknown.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "unk001",
                    name: "Mystery",
                    type: "kit",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "kits", { verbose: false });
                expect(result.skipped).toBe(true);
            } finally {
                unlinkSync(tmpPath);
            }
        });

        it("filters by types parameter", () => {
            const tmpPath = join(FIXTURE_DIR, "_test_filter.json");
            writeFileSync(
                tmpPath,
                JSON.stringify({
                    _id: "class002",
                    name: "Wizard",
                    type: "class",
                    system: {},
                }),
            );
            try {
                const result = processFile(tmpPath, "classes", {
                    types: ["creature"],
                    verbose: false,
                });
                expect(result.skipped).toBe(true);
            } finally {
                unlinkSync(tmpPath);
            }
        });
    });

    describe("importFromDir", () => {
        let testCounter = 0;

        function getTmpDbPath() {
            testCounter++;
            return `temp/import-it-${Date.now()}-${testCounter}.sqlite`;
        }

        it("imports all fixture files into the database", async () => {
            const result = await importFromDir(FIXTURE_DIR, {
                db: getTmpDbPath(),
                dryRun: false,
                verbose: false,
            });

            expect(result.inserted).toBeGreaterThan(0);
            expect(result.errors).toBe(0);
        });

        it("dry-run counts items without inserting", async () => {
            const result = await importFromDir(FIXTURE_DIR, {
                db: getTmpDbPath(),
                dryRun: true,
                verbose: false,
            });

            expect(result.inserted).toBeGreaterThan(0);
            expect(result.updated).toBe(0);
        });

        it("filters packs by name", async () => {
            const result = await importFromDir(FIXTURE_DIR, {
                pack: ["nonexistent-pack"],
                db: getTmpDbPath(),
                dryRun: true,
                verbose: false,
            });

            expect(result.inserted).toBe(0);
        });

        it("filters by entity types", async () => {
            const result = await importFromDir(FIXTURE_DIR, {
                types: ["spell"],
                db: getTmpDbPath(),
                dryRun: true,
                verbose: false,
            });

            expect(result.inserted).toBeGreaterThan(0);
        });

        it("respects limit option", async () => {
            const result = await importFromDir(FIXTURE_DIR, {
                limit: 1,
                db: getTmpDbPath(),
                dryRun: true,
                verbose: false,
            });

            expect(result.inserted).toBeLessThanOrEqual(5);
        });

        it("creates parent-child relationships for creature embedded items", async () => {
            const dbPath = getTmpDbPath();
            await importFromDir(FIXTURE_DIR, {
                db: dbPath,
                dryRun: false,
                verbose: false,
            });

            const db = createDb(dbPath);
            try {
                const creatures = getRuleItems(db, "creature");
                expect(creatures.length).toBeGreaterThan(0);
                for (const creature of creatures) {
                    const children = getChildItems(db, creature.id);
                    expect(children.length).toBeGreaterThan(0);
                }
            } finally {
                db.close();
            }
        });
    });

    describe("end-to-end import with fixture files", () => {
        /** @type {import("bun:sqlite").Database} */
        let db;

        beforeEach(() => {
            db = createDb(":memory:");
        });

        afterEach(() => {
            if (db) {
                db.close();
            }
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

            twoPhaseInsert(db, allItems);

            const creatures = getRuleItems(db, "creature");
            expect(creatures.length).toBeGreaterThan(0);

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

            twoPhaseInsert(db, allItems);

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

            expect(result.items.length).toBeGreaterThan(1);

            const creature = result.items[0];
            const data = JSON.parse(creature.dataJson);
            expect(data.itemRefs).toBeDefined();
            expect(data.itemRefs.length).toBeGreaterThan(0);
        });

        it("two-phase insert creates parent-child relationships in DB", () => {
            const filePath = join(FIXTURE_DIR, "creature-simple.json");
            const result = processFile(filePath, "pathfinder-bestiary", {
                verbose: false,
            });

            twoPhaseInsert(db, result.items);

            const creatures = getRuleItems(db, "creature");
            expect(creatures).toHaveLength(1);
            const creature = creatures[0];

            const children = getChildItems(db, creature.id);
            expect(children.length).toBeGreaterThan(0);
            for (const child of children) {
                expect(child.parentId).toBe(creature.id);
            }
        });

        it("is idempotent — running twice does not duplicate", () => {
            const filePath = join(FIXTURE_DIR, "creature-simple.json");
            const result = processFile(filePath, "pathfinder-bestiary", {
                verbose: false,
            });

            twoPhaseInsert(db, result.items);
            twoPhaseInsert(db, result.items);

            const creatures = getRuleItems(db, "creature");
            const bloodseekers = creatures.filter((c) => c.name === "Bloodseeker");
            expect(bloodseekers).toHaveLength(1);
        });
    });
});
