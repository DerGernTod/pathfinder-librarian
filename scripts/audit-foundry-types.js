import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const AUDIT_HELP = `
Usage: bun scripts/audit-foundry-types.js [options]

Scan all Foundry pf2e pack JSON files and produce a summary of all
document types, which packs they appear in, and sample entries.

Options:
  --source <path>     Use a local pf2e repo instead of cloning
  --samples <n>       Number of sample names per type/pack combo [default: 3]
  --help              Show this help message
`;

/**
 * Spawns a process using Bun.
 * @param {string[]} args
 * @returns {Promise<number>}
 */
async function spawnProcess(args) {
    // eslint-disable-next-line no-undef
    const proc = Bun.spawn(args);
    return proc.exited;
}

/**
 * Ensures the pf2e repository is available.
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
 * Discovers JSON files in the packs directory, grouped by pack.
 * @param {string} packsDir
 * @returns {Map<string, string[]>}
 */
function discoverFiles(packsDir) {
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
 * @typedef {{ type: string, pack: string, name: string, hasRules: boolean, topLevelKeys: string[], systemKeys: string[] }} AuditEntry
 */

/**
 * Scans all files and collects type/pack info.
 * @param {Map<string, string[]>} packs
 * @returns {{ entries: AuditEntry[], parseErrors: number }}
 */
function scanFiles(packs) {
    /** @type {AuditEntry[]} */
    const entries = [];
    let parseErrors = 0;

    for (const [packName, files] of packs) {
        for (const filePath of files) {
            try {
                const content = readFileSync(filePath, "utf-8");
                const raw = /** @type {Record<string, unknown>} */ (JSON.parse(content));
                if (typeof raw.type !== "string") {
                    continue;
                }

                const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
                const hasRules = Array.isArray(sys.rules) && sys.rules.length > 0;

                entries.push({
                    type: raw.type,
                    pack: packName,
                    name: /** @type {string} */ (raw.name ?? "(unnamed)"),
                    hasRules,
                    topLevelKeys: Object.keys(raw).filter(
                        (k) => k !== "system" && k !== "items" && k !== "token",
                    ),
                    systemKeys: Object.keys(sys),
                });
            } catch {
                parseErrors++;
            }
        }
    }

    return { entries, parseErrors };
}

/**
 * @param {AuditEntry[]} entries
 * @param {number} sampleCount
 */
function printReport(entries, sampleCount) {
    // Group by type, then by pack
    /** @type {Map<string, Map<string, { count: number, samples: string[], hasRulesCount: number, systemKeys: Set<string> }>>} */
    const typePackMap = new Map();

    let totalItems = 0;
    let totalImported = 0;

    for (const entry of entries) {
        if (!typePackMap.has(entry.type)) {
            typePackMap.set(entry.type, new Map());
        }
        const packMap = typePackMap.get(entry.type);
        if (!packMap) {
            continue;
        }

        if (!packMap.has(entry.pack)) {
            packMap.set(entry.pack, {
                count: 0,
                samples: [],
                hasRulesCount: 0,
                systemKeys: new Set(),
            });
        }
        const info = packMap.get(entry.pack);
        if (!info) {
            continue;
        }

        info.count++;
        if (info.samples.length < sampleCount) {
            info.samples.push(entry.name);
        }
        if (entry.hasRules) {
            info.hasRulesCount++;
        }
        for (const key of entry.systemKeys) {
            info.systemKeys.add(key);
        }
    }

    // Sort types by total count descending
    /** @type {Map<string, number>} */
    const typeTotals = new Map();
    for (const [type, packMap] of typePackMap) {
        let total = 0;
        for (const info of packMap.values()) {
            total += info.count;
        }
        typeTotals.set(type, total);
    }

    const sortedTypes = Array.from(typeTotals.keys()).sort(
        (a, b) => (typeTotals.get(b) ?? 0) - (typeTotals.get(a) ?? 0),
    );

    // Currently imported types
    const importedTypes = new Set([
        "npc",
        "spell",
        "equipment",
        "feat",
        "action",
        "condition",
        "effect",
        "class",
        "ancestry",
        "heritage",
        "background",
        "deity",
        "weapon",
        "armor",
        "shield",
        "consumable",
        "ammo",
        "hazard",
        "treasure",
        "backpack",
    ]);

    for (const type of sortedTypes) {
        const packMap = typePackMap.get(type);
        if (!packMap) {
            continue;
        }
        const total = typeTotals.get(type) ?? 0;
        totalItems += total;

        const marker = importedTypes.has(type) ? " [IMPORTED]" : " [NOT IMPORTED]";
        console.log(`--- ${type} (${total} items)${marker} ---`);

        // Sort packs by count descending
        const sortedPacks = [...packMap.entries()].sort((a, b) => b[1].count - a[1].count);

        if (importedTypes.has(type)) {
            totalImported += total;
        }

        for (const [pack, info] of sortedPacks) {
            const rulesTag =
                info.hasRulesCount > 0 ? ` | ${info.hasRulesCount} have system.rules` : "";
            console.log(`  ${pack}: ${info.count} items${rulesTag}`);
            for (const sample of info.samples) {
                console.log(`    - ${sample}`);
            }
            if (info.systemKeys.size > 0 && !importedTypes.has(type)) {
                console.log(`    system keys: ${[...info.systemKeys].sort().join(", ")}`);
            }
        }
        console.log();
    }

    console.log("=== Summary ===");
    console.log(`Total items:       ${totalItems}`);
    console.log(
        `Currently imported: ${totalImported} (${((totalImported / totalItems) * 100).toFixed(1)}%)`,
    );
    console.log(
        `Not imported:      ${totalItems - totalImported} (${(((totalItems - totalImported) / totalItems) * 100).toFixed(1)}%)`,
    );
    console.log();

    const notImported = Array.from(sortedTypes).filter((t) => !importedTypes.has(t));
    if (notImported.length > 0) {
        console.log("Unimported types by total count:");
        for (const type of notImported) {
            console.log(
                `  ${type}: ${typeTotals.get(type) ?? 0} items in ${typePackMap.get(type)?.size ?? 0} packs`,
            );
        }
    }
}

// --- main ---
const argv = process.argv;

if (argv.includes("--help") || argv.includes("-h")) {
    console.log(AUDIT_HELP);
    process.exit(0);
}

/** @type {string | undefined} */
let source;
/** @type {number} */
let samples = 3;

for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--source" && argv[i + 1]) {
        source = argv[++i];
    } else if (argv[i] === "--samples" && argv[i + 1]) {
        samples = parseInt(argv[++i], 10) || 3;
    }
}

const packsDir = await ensureRepo(source);
console.log(`Scanning packs in: ${packsDir}\n`);

const packs = discoverFiles(packsDir);
const totalFiles = [...packs.values()].reduce((sum, files) => sum + files.length, 0);
console.log(`Found ${packs.size} packs, ${totalFiles} JSON files\n`);

const { entries, parseErrors } = scanFiles(packs);

if (parseErrors > 0) {
    console.log(`Parse errors: ${parseErrors}\n`);
}

printReport(entries, samples);
