import { readFileSync, statSync } from "fs";
import { join } from "path";

import { z } from "zod";

import { createDb } from "../server/db/database.js";
import { batchUpsertRuleItems } from "../server/db/queries.js";
import { extractLocalizations } from "./lib/localize-extractor.js";

const IMPORT_HELP = `
Usage: bun scripts/import-foundry-traits.js [options]

Import Pathfinder 2e traits from the Foundry VTT pf2e system source code into
the rule_items database. Trait definitions are read from:
  src/scripts/config/traits.ts  (trait slugs, localization keys, categories)
  static/lang/en.json           (human-readable names and descriptions)

Note: conditions live in the packs directory and are already handled by
      import-foundry.js — this script only imports traits.

Options:
  --source <path>     Path to the pf2e system module root directory
                      [default: temp/foundry-vtt-pf2e]
  --db <path>         Target SQLite database [default: data/dev.sqlite]
  --dry-run           Parse and map files without writing to the database
  --verbose           Print per-item and summary progress
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
 * Ensures the pf2e system module source is available.
 * @param {string | undefined} sourcePath
 * @returns {string} - Path to the pf2e system module root
 */
export function ensureSource(sourcePath) {
    if (sourcePath) {
        return sourcePath;
    }

    const targetDir = "temp/foundry-vtt-pf2e";
    try {
        statSync(join(targetDir, "src", "scripts", "config", "traits.ts"));
        return targetDir;
    } catch {
        throw new Error(
            "pf2e system module not found at temp/foundry-vtt-pf2e. " +
                "Clone it first with: git clone --depth 1 --branch v14-dev " +
                "https://github.com/foundryvtt/pf2e.git temp/foundry-vtt-pf2e\n" +
                "Or provide --source <path>.",
        );
    }
}

/**
 * Maps a traits.ts block name to a semantic category string.
 * @type {Record<string, string>}
 */
const CATEGORY_MAP = {
    ancestryTraits: "ancestry",
    elementTraits: "element",
    energyDamageTypes: "energy",
    magicTraditions: "tradition",
    sanctificationTraits: "sanctification",
    creatureTraits: "creature",
    backgroundTraits: "background",
    classTraits: "class",
    damageTraits: "damage",
    spellTraits: "spell",
    weaponTraits: "weapon",
    npcAttackTraits: "npc-attack",
    featTraits: "feat",
    consumableTraits: "consumable",
    weaponActionTraits: "weapon-action",
    actionTraits: "action",
    effectTraits: "effect",
    preciousMaterials: "material",
    otherArmorTags: "armor-tag",
    otherConsumableTags: "consumable-tag",
    otherWeaponTags: "weapon-tag",
};

/**
 * Parses the traits.ts TypeScript source file into a map of
 * slug -> { localizationKey, category }.
 *
 * The TypeScript file defines many `const xxxTraits = { key: "PF2E.TraitXxx" }`
 * objects. We extract each directly-defined entry (skipping spread operators)
 * and assign the category based on which block it first appears in.
 *
 * @param {string} traitsFilePath
 * @returns {Map<string, { localizationKey: string, category: string }>}
 */
export function parseTraitsTs(traitsFilePath) {
    const content = readFileSync(traitsFilePath, "utf-8");
    const lines = content.split("\n");

    /** @type {Map<string, { localizationKey: string, category: string }>} */
    const traits = new Map();

    /** @type {string | null} */
    let currentBlockName = null;

    for (const line of lines) {
        // Detect const block start: `const xxxTraits = {` or
        // `const xxxTraits: Record<X, Y> = {`
        const blockStart = line.match(/^(?:export\s+)?const\s+(\w+)(?:\s*:\s*[^=]+)?\s*=/);
        if (blockStart) {
            currentBlockName = blockStart[1] ?? null;
            continue;
        }

        // Detect block end
        if (line.startsWith("};")) {
            currentBlockName = null;
            continue;
        }

        if (!currentBlockName) {
            continue;
        }

        // Skip spread lines like `    ...ancestryTraits,`
        if (line.trim().startsWith("...")) {
            continue;
        }

        // Match trait entry: `  key: "PF2E.TraitXxx",` or
        // `  "hyphenated-key": "PF2E.TraitXxx",`
        const traitMatch = line.match(/^\s+(?:["'])?([\w-]+)(?:["'])?\s*:\s*"(PF2E\.\w+)"/);
        if (traitMatch) {
            const slug = traitMatch[1];
            const localizationKey = traitMatch[2];
            // Only record the first occurrence (spreads re-export from earlier blocks)
            if (!traits.has(slug)) {
                const category = CATEGORY_MAP[currentBlockName] ?? "other";
                traits.set(slug, { localizationKey, category });
            }
        }
    }

    return traits;
}

/**
 * Builds importable rule items from parsed trait definitions and the
 * flattened localization map from en.json.
 *
 * Name:        localizations.get("PF2E.TraitFire")        → "Fire"
 * Description: localizations.get("PF2E.TraitDescriptionFire") → "..."
 *
 * @param {Map<string, { localizationKey: string, category: string }>} traitDefs
 * @param {Map<string, string>} localizations
 * @returns {Array<{ type: string, name: string, compendiumSource: string, dataJson: string }>}
 */
export function buildTraitItems(traitDefs, localizations) {
    /** @type {Array<{ type: string, name: string, compendiumSource: string, dataJson: string }>} */
    const items = [];

    for (const [slug, { localizationKey, category }] of traitDefs) {
        const name = localizations.get(localizationKey) ?? slug;

        // Description key: "PF2E.TraitFire" → "PF2E.TraitDescriptionFire"
        const descKey = localizationKey.replace(/^PF2E\.Trait/, "PF2E.TraitDescription");
        const rawDescription = localizations.get(descKey) ?? "";
        // Strip HTML tags from description
        const description = rawDescription
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, " ")
            .trim();

        // Use a stable, unique source key for traits (not a Foundry UUID)
        const compendiumSource = `pf2e.trait.${slug}`;

        items.push({
            type: "trait",
            name,
            compendiumSource,
            dataJson: JSON.stringify({
                name,
                description,
                category,
                slug,
                compendiumSource,
            }),
        });
    }

    return items;
}

/**
 * Main import function. Parses pf2e TypeScript trait definitions and
 * inserts them into the rule_items database.
 *
 * @param {{ source?: string, db: string, dryRun: boolean, verbose: boolean }} options
 * @returns {{ inserted: number, updated: number, skipped: number, errors: number }}
 */
export function runImport(options) {
    const pf2eRoot = ensureSource(options.source);
    const traitsFilePath = join(pf2eRoot, "src", "scripts", "config", "traits.ts");

    let traitDefs;
    try {
        traitDefs = parseTraitsTs(traitsFilePath);
    } catch (error) {
        console.error(
            `Failed to parse traits.ts: ${error instanceof Error ? error.message : String(error)}`,
        );
        return { inserted: 0, updated: 0, skipped: 0, errors: 1 };
    }

    if (options.verbose) {
        console.log(`Parsed ${traitDefs.size} trait definitions from traits.ts`);
    }

    const localizations = extractLocalizations(pf2eRoot);

    if (options.verbose) {
        console.log(`Loaded ${localizations.size} localization strings from en.json`);
    }

    const allItems = buildTraitItems(traitDefs, localizations);

    if (options.verbose) {
        console.log(`Built ${allItems.length} trait items`);
    }

    if (options.dryRun) {
        console.log(`[DRY RUN] Would import ${allItems.length} trait items.`);
        return { inserted: allItems.length, updated: 0, skipped: 0, errors: 0 };
    }

    const database = createDb(options.db);
    const result = batchUpsertRuleItems(database, allItems);

    if (options.verbose) {
        console.log(`Inserted: ${result.inserted}, Updated: ${result.updated}`);
    }

    return {
        inserted: result.inserted,
        updated: result.updated,
        skipped: 0,
        errors: 0,
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
