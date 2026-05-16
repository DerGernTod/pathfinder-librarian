/**
 * Exports pf2e localization strings to data/localizations.json.
 *
 * The server uses data/localizations.json to resolve @Localize[key] references
 * embedded in rule item descriptions (see server/utils/foundry-refs.js).
 *
 * Run this once after cloning the pf2e repo (or whenever it is updated):
 *   bun scripts/export-localizations.js [--source <path>]
 */
import { mkdirSync, statSync } from "fs";
import { join } from "path";

import { z } from "zod";

import { extractLocalizations, writeLocalizations } from "./lib/localize-extractor.js";

const HELP = `
Usage: bun scripts/export-localizations.js [options]

Reads static/lang/en.json from the pf2e system module and flattens it into
data/localizations.json for use by the server's @Localize resolver.

Options:
  --source <path>   Path to the pf2e system module root [default: temp/foundry-vtt-pf2e]
  --out <path>      Output file path [default: data/localizations.json]
  --help            Show this help message
`;

const argsSchema = z.object({
    source: z.string().default("temp/foundry-vtt-pf2e"),
    out: z.string().default("data/localizations.json"),
});

/**
 * @param {string[]} argv
 * @returns {z.infer<typeof argsSchema>}
 */
function parseArgs(argv) {
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(HELP);
        process.exit(0);
    }

    /** @type {Record<string, string>} */
    const raw = {};
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--source" && argv[i + 1]) {
            raw.source = argv[++i];
        } else if (arg === "--out" && argv[i + 1]) {
            raw.out = argv[++i];
        }
    }
    return argsSchema.parse(raw);
}

const isMain = process.argv[1] && process.argv[1].includes("export-localizations.js");
if (isMain) {
    const options = parseArgs(process.argv);

    try {
        statSync(options.source);
    } catch {
        console.error(
            `pf2e source not found at "${options.source}". ` +
                "Clone it first with:\n" +
                "  git clone --depth 1 --branch v14-dev " +
                "https://github.com/foundryvtt/pf2e.git temp/foundry-vtt-pf2e",
        );
        process.exit(1);
    }

    const localizations = extractLocalizations(options.source);

    if (localizations.size === 0) {
        console.error(
            `No localizations found in "${options.source}". ` +
                "Ensure static/lang/en.json exists in the pf2e root.",
        );
        process.exit(1);
    }

    // Ensure the output directory exists
    const outDir = join(options.out, "..");
    mkdirSync(outDir, { recursive: true });

    writeLocalizations(localizations, options.out);
    console.log(`Exported ${localizations.size} strings to ${options.out}`);
}
