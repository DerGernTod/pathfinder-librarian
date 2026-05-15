import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import { z } from "zod";

import { createDb } from "../server/db/database.js";
import { batchUpsertRuleItems, getRuleItemBySource } from "../server/db/queries.js";
import { mapCreature, mapEffect, mapEquipment, mapFeat, mapSpell } from "./lib/foundry-mappers.js";
import { mapCondition } from "./lib/trait-mappers.js";

// Map filesystem directory names to Foundry compendium pack names.
// The pf2e repo uses "conditions" as directory but compendium UUIDs use
// "conditionitems".
const PACK_NAME_OVERRIDE = {
    conditions: "conditionitems",
};

/**
 * Spawns a process using Bun if available, otherwise throws.
 * @param {string[]} args
 * @returns {Promise<number>} exit code
 */
async function spawnProcess(args) {
    // Bun global is available at runtime
    // eslint-disable-next-line no-undef
    const proc = Bun.spawn(args);
    return proc.exited;
}

/**
 * @typedef {{ type: string, name: string, compendiumSource: string, dataJson: string, parentId?: string }} ImportableItem
 */

const IMPORT_HELP = `
Usage: bun scripts/import-foundry.js [options]

Import Pathfinder 2e data from the Foundry VTT pf2e repository into the
rule_items database. By default, clones the pf2e repo (shallow) and imports
all packs.

Options:
  --source <path>     Use a local pf2e repo instead of cloning
  --pack <names>      Comma-separated pack names to import (e.g. "bestiary-1,spells")
  --types <types>     Comma-separated entity types (creature,spell,equipment,feat,action)
  --limit <n>         Only process the first N matching files
  --db <path>         Target SQLite database [default: data/dev.sqlite]
  --dry-run           Parse and map files without writing to the database
  --verbose           Print per-pack and per-file progress
  --help              Show this help message
`;

const importArgsSchema = z.object({
    source: z.string().optional(),
    pack: z
        .string()
        .transform((v) => v.split(","))
        .optional(),
    types: z
        .string()
        .transform((v) => v.split(","))
        .optional(),
    limit: z.coerce.number().int().positive().optional(),
    db: z.string().default("data/dev.sqlite"),
    dryRun: z.boolean().default(false),
    verbose: z.boolean().default(false),
});

/** @typedef {z.infer<typeof importArgsSchema>} ImportArgs */

/**
 * Parses CLI arguments into a validated options object.
 * @param {string[]} argv
 * @returns {ImportArgs}
 */
export function parseArgs(argv) {
    if (argv.length <= 2 || argv.includes("--help") || argv.includes("-h")) {
        console.log(IMPORT_HELP);
        process.exit(0);
    }

    /** @type {Record<string, string | boolean | undefined>} */
    const raw = {};
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--source" && argv[i + 1]) {
            raw.source = argv[++i];
        } else if (arg === "--pack" && argv[i + 1]) {
            raw.pack = argv[++i];
        } else if (arg === "--types" && argv[i + 1]) {
            raw.types = argv[++i];
        } else if (arg === "--limit" && argv[i + 1]) {
            raw.limit = argv[++i];
        } else if (arg === "--db" && argv[i + 1]) {
            raw.db = argv[++i];
        } else if (arg === "--dry-run") {
            raw.dryRun = true;
        } else if (arg === "--verbose") {
            raw.verbose = true;
        }
    }

    return importArgsSchema.parse(raw);
}

/**
 * Ensures the pf2e repository is available.
 * If --source is provided, uses that path.
 * Otherwise clones the repo to temp/foundry-vtt-pf2e/.
 * @param {string | undefined} sourcePath
 * @returns {Promise<string>} - Path to the packs directory
 */
export async function ensureRepo(sourcePath) {
    if (sourcePath) {
        return join(sourcePath, "packs", "pf2e");
    }

    const targetDir = "temp/foundry-vtt-pf2e";
    const packsDir = join(targetDir, "packs", "pf2e");

    try {
        statSync(packsDir);
        return packsDir;
    } catch {
        // Directory doesn't exist, need to clone
    }

    console.log("Cloning pf2e repository (shallow, v14-dev branch)...");
    const exitCode = await spawnProcess([
        "git",
        "clone",
        "--depth",
        "1",
        "--branch",
        "v14-dev",
        "https://github.com/foundryvtt/pf2e.git",
        targetDir,
    ]);
    if (exitCode !== 0) {
        throw new Error(`git clone failed with exit code ${exitCode}`);
    }

    return packsDir;
}

/**
 * Discovers JSON files in the packs directory, grouped by pack directory.
 * @param {string} packsDir
 * @returns {Map<string, string[]>} - Map of pack directory name to file paths
 */
export function discoverFiles(packsDir) {
    /** @type {Map<string, string[]>} */
    const packs = new Map();

    function walkDir(/** @type {string} */ dir, /** @type {string} */ packName) {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath, packName || entry.name);
            } else if (
                entry.isFile() &&
                entry.name.endsWith(".json") &&
                entry.name !== "_folders.json"
            ) {
                if (!packs.has(packName)) {
                    packs.set(packName, []);
                }
                const arr = packs.get(packName);
                if (arr) {
                    arr.push(fullPath);
                }
            }
        }
    }

    walkDir(packsDir, "");
    return packs;
}

/**
 * Processes a single Foundry JSON file and returns importable items.
 * @param {string} filePath
 * @param {string} packName
 * @param {{ types?: string[], verbose: boolean }} options
 * @returns {{ items: ImportableItem[], skipped: boolean, error: string | null }}
 */
export function processFile(filePath, packName, options) {
    try {
        const content = readFileSync(filePath, "utf-8");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const raw = JSON.parse(content);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!raw._id || !raw.type) {
            return { items: [], skipped: true, error: null };
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const type = raw.type;

        /** @type {ImportableItem[]} */
        let items = [];

        if (type === "npc" && (!options.types || options.types.includes("creature"))) {
            items = mapCreature(raw, packName);
        } else if (type === "spell" && (!options.types || options.types.includes("spell"))) {
            items = [mapSpell(raw, packName)];
        } else if (
            type === "equipment" &&
            (!options.types || options.types.includes("equipment"))
        ) {
            items = [mapEquipment(raw, packName)];
        } else if (type === "feat" && (!options.types || options.types.includes("feat"))) {
            items = [mapFeat(raw, packName)];
        } else if (type === "action" && (!options.types || options.types.includes("action"))) {
            // Standalone actions — use mapFeat-like logic but as action type
            items = [mapFeat(raw, packName)];
            // Override type to action
            items = items.map((item) => ({
                ...item,
                type: "action",
                dataJson: item.dataJson, // Keep data as-is
            }));
        } else if (type === "effect" && (!options.types || options.types.includes("effect"))) {
            items = [mapEffect(raw, packName)];
        } else if (
            type === "condition" &&
            (!options.types || options.types.includes("condition"))
        ) {
            // The pf2e repo directory is "conditions" but compendium UUIDs use
            // "conditionitems". Override to match Foundry compendium references.
            items = [
                mapCondition(
                    raw,
                    /** @type {Record<string, string>} */ (PACK_NAME_OVERRIDE)[packName] ??
                        packName,
                ),
            ];
        } else {
            return { items: [], skipped: true, error: null };
        }

        if (items.length === 0) {
            return { items: [], skipped: true, error: null };
        }

        return { items, skipped: false, error: null };
    } catch (error) {
        return {
            items: [],
            skipped: true,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Main import function. Processes Foundry JSON files and inserts into DB.
 * @param {{ source?: string, pack?: string[], types?: string[], limit?: number, db: string, dryRun: boolean, verbose: boolean }} options
 * @returns {Promise<{ inserted: number, updated: number, skipped: number, errors: number }>}
 */
export async function runImport(options) {
    const packsDir = await ensureRepo(options.source);
    const packs = discoverFiles(packsDir);

    /** @type {ImportableItem[]} */
    const allItems = [];
    let skipped = 0;
    let errors = 0;

    for (const [packName, files] of packs) {
        // Filter by --pack option
        if (options.pack && !options.pack.includes(packName)) {
            continue;
        }

        if (options.verbose) {
            console.log(`Processing pack: ${packName} (${files.length} files)`);
        }

        let fileCount = 0;
        for (const filePath of files) {
            if (options.limit && fileCount >= options.limit) {
                break;
            }

            const result = processFile(filePath, packName, options);

            if (result.error) {
                errors++;
                if (options.verbose) {
                    console.error(`Error processing ${filePath}: ${result.error}`);
                }
            } else if (result.skipped) {
                skipped++;
            } else {
                allItems.push(...result.items);
            }
            fileCount++;
        }
    }

    if (options.verbose) {
        console.log(`Parsed ${allItems.length} items, skipped ${skipped}, errors ${errors}`);
    }

    if (options.dryRun) {
        console.log(`[DRY RUN] Would import ${allItems.length} items.`);
        return { inserted: allItems.length, updated: 0, skipped, errors };
    }

    const database = createDb(options.db);

    // Phase 1: insert root items (no parentId) first
    const rootItems = allItems.filter((item) => !item.parentId);
    const rootResult = batchUpsertRuleItems(database, rootItems);

    // Phase 2: resolve parentId from compendium source → DB id, then insert children
    const childItems = allItems.filter((item) => item.parentId);
    for (const child of childItems) {
        const parent = getRuleItemBySource(database, /** @type {string} */ (child.parentId));
        if (parent) {
            child.parentId = parent.id;
        } else {
            child.parentId = undefined;
        }
    }
    const childResult = batchUpsertRuleItems(database, childItems);

    const result = {
        inserted: rootResult.inserted + childResult.inserted,
        updated: rootResult.updated + childResult.updated,
    };

    if (options.verbose) {
        console.log(`Inserted: ${result.inserted}, Updated: ${result.updated}`);
    }

    return {
        inserted: result.inserted,
        updated: result.updated,
        skipped,
        errors,
    };
}

// Only run main when executed directly
const isMain = process.argv[1] && process.argv[1].includes("import-foundry.js");
if (isMain) {
    const options = parseArgs(process.argv);
    runImport(options)
        .then((result) => {
            console.log(
                `Import complete: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`,
            );
        })
        .catch((error) => {
            console.error("Import failed:", error);
            process.exit(1);
        });
}
