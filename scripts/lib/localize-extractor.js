import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Flattens a nested object into a Map of dot-separated key paths to string values.
 * @param {Record<string, unknown>} obj - The nested object to flatten
 * @param {string} prefix - Key prefix for recursion
 * @returns {Map<string, string>}
 */
function flattenObject(obj, prefix = "") {
    /** @type {Map<string, string>} */
    const result = new Map();
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "string") {
            result.set(fullKey, value);
        } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            const nested = flattenObject(/** @type {Record<string, unknown>} */ (value), fullKey);
            for (const [k, v] of nested) {
                result.set(k, v);
            }
        }
    }
    return result;
}

/**
 * Extracts localizations from PF2e system module localization files.
 * @param {string} pf2eRootDir - Root directory of the pf2e system module
 * @returns {Map<string, string>}
 */
export function extractLocalizations(pf2eRootDir) {
    const candidates = [
        join(pf2eRootDir, "localization", "en.json"),
        join(pf2eRootDir, "lang", "en.json"),
    ];

    for (const filePath of candidates) {
        if (existsSync(filePath)) {
            const content = readFileSync(filePath, "utf-8");
            const parsed = /** @type {Record<string, unknown>} */ (JSON.parse(content));
            return flattenObject(parsed);
        }
    }

    return new Map();
}

/**
 * Loads localizations from a data directory's localizations.json.
 * @param {string} dataDir - Directory containing localizations.json
 * @returns {Map<string, string>}
 */
export function loadLocalizationsFromFile(dataDir) {
    const filePath = join(dataDir, "localizations.json");
    if (!existsSync(filePath)) {
        return new Map();
    }
    const content = readFileSync(filePath, "utf-8");
    const parsed = /** @type {Record<string, string>} */ (JSON.parse(content));
    return new Map(Object.entries(parsed));
}

/**
 * Writes localizations map to a JSON file.
 * @param {Map<string, string>} localizations
 * @param {string} outputPath
 */
export function writeLocalizations(localizations, outputPath) {
    const obj = Object.fromEntries(localizations);
    writeFileSync(outputPath, JSON.stringify(obj, null, 2), "utf-8");
}
