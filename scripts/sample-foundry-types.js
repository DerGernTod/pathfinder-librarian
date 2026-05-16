import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const HELP = `
Usage: bun scripts/sample-foundry-types.js [options]

Pick random samples of each Foundry item type and dump their
system data so we can decide what to extract.

Options:
  --source <path>     Use a local pf2e repo instead of cloning
  --samples <n>       Number of samples per type [default: 5]
  --out <path>        Write output to file instead of stdout
  --help              Show this help message
`;

/**
 * @param {string[]} args
 * @returns {Promise<number>}
 */
async function spawnProcess(args) {
    // eslint-disable-next-line no-undef
    const proc = Bun.spawn(args);
    return proc.exited;
}

/**
 * @param {string | undefined} sourcePath
 * @returns {Promise<string>}
 */
async function ensureRepo(sourcePath) {
    if (sourcePath) {
        return join(sourcePath, "packs", "pf2e");
    }
    const targetDir = "temp/foundry-vtt-pf2e";
    const packsDir = join(targetDir, "packs", "pf2e");
    try {
        statSync(packsDir);
        return packsDir;
    } catch {
        // need to clone
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
 * @param {string} packsDir
 * @returns {Map<string, string[]>}
 */
function discoverFiles(packsDir) {
    /** @type {Map<string, string[]>} */
    const packs = new Map();
    /**
     * @param {string} dir
     * @param {string} packName
     */
    function walkDir(dir, packName) {
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
 * Seeded-ish shuffle using Fisher-Yates.
 * @param {unknown[]} array
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * @typedef {{ file: string, pack: string, raw: Record<string, unknown> }} ParsedFile
 */

/**
 * @param {Map<string, string[]>} packs
 * @param {number} sampleCount
 * @returns {Map<string, ParsedFile[]>}
 */
function sampleByType(packs, sampleCount) {
    /** @type {Map<string, ParsedFile[]>} */
    const byType = new Map();

    for (const [packName, files] of packs) {
        for (const filePath of files) {
            try {
                const content = readFileSync(filePath, "utf-8");
                const raw = /** @type {Record<string, unknown>} */ (JSON.parse(content));
                if (!raw.type) {
                    continue;
                }
                const type = String(raw.type);
                if (!byType.has(type)) {
                    byType.set(type, []);
                }
                byType.get(type)?.push({
                    file: filePath,
                    pack: packName,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    raw,
                });
            } catch {
                // skip
            }
        }
    }

    /** @type {Map<string, ParsedFile[]>} */
    const sampled = new Map();
    for (const [type, items] of byType) {
        shuffle(items);
        sampled.set(type, items.slice(0, sampleCount));
    }

    return sampled;
}

/**
 * Strips HTML tags from a string.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
    return html
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .trim();
}

/**
 * Truncates a value for display.
 * @param {unknown} val
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(val, maxLen = 300) {
    const str = typeof val === "string" ? val : JSON.stringify(val);
    if (!str) {
        return "";
    }
    const clean = stripHtml(str);
    if (clean.length > maxLen) {
        return clean.slice(0, maxLen) + "...";
    }
    return clean;
}

/**
 * @param {Record<string, unknown>} sys
 * @returns {Record<string, unknown>}
 */
function extractInterestingFields(sys) {
    /** @type {Record<string, unknown>} */
    const out = {};

    for (const [key, val] of Object.entries(sys)) {
        if (key === "description" || key === "publication") {
            // Skip long prose / pub metadata — we know these exist
            continue;
        }
        if (val === null || val === undefined || val === "" || val === 0) {
            continue;
        }
        if (typeof val === "object" && !Array.isArray(val) && val !== null) {
            const inner = /** @type {Record<string, unknown>} */ (val);
            const innerKeys = Object.keys(inner);
            // Flatten single-key sub-objects like { value: X }
            if (
                innerKeys.length === 1 &&
                innerKeys[0] === "value" &&
                typeof inner.value !== "object"
            ) {
                out[key] = inner.value;
            } else {
                // Keep complex objects but truncate string values inside
                /** @type {Record<string, unknown>} */
                const cleaned = {};
                for (const [ik, iv] of Object.entries(inner)) {
                    if (typeof iv === "string" && iv.length > 200) {
                        cleaned[ik] = truncate(iv, 200);
                    } else if (typeof iv === "object" && iv !== null) {
                        cleaned[ik] = JSON.stringify(iv);
                    } else {
                        cleaned[ik] = iv;
                    }
                }
                out[key] = cleaned;
            }
        } else if (Array.isArray(val)) {
            if (val.length > 0) {
                // Show first 3 elements
                const preview = val.slice(0, 3);
                out[key] =
                    val.length > 3
                        ? [...preview.map(String), `... (+${val.length - 3} more)`]
                        : preview;
            }
        } else {
            out[key] = val;
        }
    }
    return out;
}

/**
 * @param {Map<string, ParsedFile[]>} sampled
 * @returns {string}
 */
function buildReport(sampled) {
    const importedTypes = new Set([
        "npc",
        "spell",
        "equipment",
        "feat",
        "action",
        "condition",
        "effect",
    ]);

    const lines = [];
    const sortedTypes = [...sampled.keys()].sort();

    for (const type of sortedTypes) {
        const items = sampled.get(type) ?? [];
        const marker = importedTypes.has(type) ? "IMPORTED" : "NOT IMPORTED";
        lines.push(`\n${"=".repeat(72)}`);
        lines.push(`TYPE: ${type}  [${marker}]  (${items.length} samples)`);
        lines.push("=".repeat(72));

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const raw = item.raw;
            const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
            const desc = /** @type {{ value?: string } | undefined } */ (sys.description);
            const rules = /** @type {unknown[] | undefined } */ (sys.rules);

            lines.push(`\n--- Sample ${i + 1}: ${String(raw.name ?? "(unnamed)")} ---`);
            lines.push(`Pack: ${item.pack}`);
            lines.push(`ID: ${String(raw._id ?? "n/a")}`);

            // Description (truncated)
            if (desc?.value) {
                lines.push(`Description: ${truncate(desc.value, 500)}`);
            }

            // Rules elements
            if (rules && rules.length > 0) {
                lines.push(
                    `Rules (${rules.length}): ${JSON.stringify(rules.slice(0, 2))}${rules.length > 2 ? ` ... (+${rules.length - 2} more)` : ""}`,
                );
            }

            // Items array (embedded items for NPCs etc)
            const embedded = /** @type {Array<Record<string, unknown>> | undefined } */ (raw.items);
            if (embedded && embedded.length > 0) {
                const typeCounts = new Map();
                for (const emb of embedded) {
                    const t = String(emb.type ?? "unknown");
                    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
                }
                lines.push(
                    `Embedded items (${embedded.length}): ${[...typeCounts.entries()]
                        .map(([t, c]) => `${t}×${c}`)
                        .join(", ")}`,
                );
            }

            // Structured fields
            const interesting = extractInterestingFields(sys);
            const skipKeys = new Set(["description", "publication", "rules"]);
            for (const [key, val] of Object.entries(interesting)) {
                if (skipKeys.has(key)) {
                    continue;
                }
                lines.push(`  ${key}: ${JSON.stringify(val)}`);
            }
        }
    }

    return lines.join("\n");
}

// --- main ---
const argv = process.argv;
if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    process.exit(0);
}

/** @type {string | undefined} */
let source;
/** @type {number} */
let samples = 5;
/** @type {string | undefined} */
let outPath;

for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--source" && argv[i + 1]) {
        source = argv[++i];
    } else if (argv[i] === "--samples" && argv[i + 1]) {
        samples = parseInt(argv[++i], 10) || 5;
    } else if (argv[i] === "--out" && argv[i + 1]) {
        outPath = argv[++i];
    }
}

const packsDir = await ensureRepo(source);
console.log(`Scanning: ${packsDir}`);

const packs = discoverFiles(packsDir);
const sampled = sampleByType(packs, samples);
const report = buildReport(sampled);

if (outPath) {
    const { writeFileSync } = await import("fs");
    writeFileSync(outPath, report, "utf-8");
    console.log(`Report written to ${outPath}`);
} else {
    console.log(report);
}
