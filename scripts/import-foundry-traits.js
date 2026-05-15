import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import { z } from "zod";

import { createDb } from "../server/db/database.js";
import { batchUpsertRuleItems } from "../server/db/queries.js";
import { mapCondition, mapTrait } from "./lib/trait-mappers.js";

const IMPORT_HELP = `
Usage: bun scripts/import-foundry-traits.js [options]

Import Pathfinder 2e traits and conditions from the Foundry VTT pf2e system module
into the rule_items database. Targets system module packs (traits, conditionitems).

Options:
  --source <path>     Path to the pf2e system module root directory
  --db <path>         Target SQLite database [default: data/dev.sqlite]
  --dry-run           Parse and map files without writing to the database
  --verbose           Print per-pack and per-file progress
  --help              Show this help message
`;

const importArgsSchema = z.object({
    source: z.string().optional(),
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
 * Ensures the pf2e system module is available.
 * @param {string | undefined} sourcePath
 * @returns {string} - Path to the pf2e system module root
 */
export function ensureSource(sourcePath) {
    if (sourcePath) {
        return sourcePath;
    }

    const targetDir = "temp/foundry-vtt-pf2e";
    try {
        statSync(join(targetDir, "packs"));
        return targetDir;
    } catch {
        throw new Error("pf2e system module not found. Clone it first or provide --source path.");
    }
}

/**
 * Discovers JSON files in the trait/condition pack directories.
 * @param {string} pf2eRoot
 * @returns {{ traits: string[], conditions: string[] }}
 */
export function discoverTraitFiles(pf2eRoot) {
    /** @type {string[]} */
    const traits = [];
    /** @type {string[]} */
    const conditions = [];

    const packsDir = join(pf2eRoot, "packs", "pf2e");

    function walkDir(/** @type {string} */ dir, /** @type {string} */ packName) {
        if (!statSync(dir, { throwIfNoEntry: false })) {
            return;
        }
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
                if (packName.includes("conditionitems") || packName.includes("condition")) {
                    conditions.push(fullPath);
                } else {
                    traits.push(fullPath);
                }
            }
        }
    }

    // Walk trait packs
    const traitDir = join(packsDir, "traits");
    if (statSync(traitDir, { throwIfNoEntry: false })) {
        walkDir(traitDir, "traits");
    }

    // Walk condition packs
    const conditionDir = join(packsDir, "conditionitems");
    if (statSync(conditionDir, { throwIfNoEntry: false })) {
        walkDir(conditionDir, "conditionitems");
    }

    return { traits, conditions };
}

/**
 * Main import function for traits and conditions.
 * @param {{ source?: string, db: string, dryRun: boolean, verbose: boolean }} options
 * @returns {{ inserted: number, updated: number, skipped: number, errors: number }}
 */
export function runImport(options) {
    const pf2eRoot = ensureSource(options.source);
    const { traits, conditions } = discoverTraitFiles(pf2eRoot);

    /** @type {Array<{ type: string, name: string, compendiumSource: string, dataJson: string }>} */
    const allItems = [];
    let skipped = 0;
    let errors = 0;

    // Process traits
    for (const filePath of traits) {
        try {
            const content = readFileSync(filePath, "utf-8");
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const raw = JSON.parse(content);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (!raw._id || !raw.name) {
                skipped++;
                continue;
            }
            allItems.push(mapTrait(raw, "traits"));
        } catch (error) {
            errors++;
            if (options.verbose) {
                // oxlint-disable-next-line no-console
                console.error(
                    `Error processing ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    // Process conditions
    for (const filePath of conditions) {
        try {
            const content = readFileSync(filePath, "utf-8");
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const raw = JSON.parse(content);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (!raw._id || !raw.name) {
                skipped++;
                continue;
            }
            allItems.push(mapCondition(raw, "conditionitems"));
        } catch (error) {
            errors++;
            if (options.verbose) {
                // oxlint-disable-next-line no-console
                console.error(
                    `Error processing ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    if (options.verbose) {
        console.log(
            `Parsed ${allItems.length} items (${traits.length} traits, ${conditions.length} conditions), skipped ${skipped}, errors ${errors}`,
        );
    }

    if (options.dryRun) {
        console.log(`[DRY RUN] Would import ${allItems.length} items.`);
        return { inserted: allItems.length, updated: 0, skipped, errors };
    }

    const database = createDb(options.db);
    const result = batchUpsertRuleItems(database, allItems);

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
const isMain = process.argv[1] && process.argv[1].includes("import-foundry-traits.js");
if (isMain) {
    const options = parseArgs(process.argv);
    const result = runImport(options);
    console.log(
        `Import complete: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`,
    );
}
