import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { getRuleItemBySource } from "../db/queries.js";

// Match @UUID[path]{text} OR @UUID[path] (display text is optional)
const UUID_REGEX = /@UUID\[([^\]]+)\](?:\{([^}]+)\})?/g;
const LOCALIZE_REGEX = /@Localize\[([^\]]+)\]/g;

/**
 * Extracts a human-readable label from a Foundry compendium UUID path when no
 * display text is present.  e.g.:
 *   "Compendium.pf2e.conditionitems.Item.eIcWbB5o3pP6OIMe" → "conditionitems"
 *   "Compendium.pf2e.equipment-effects.Item.Effect: Frost Vial" → "Effect: Frost Vial"
 * @param {string} uuid
 * @returns {string}
 */
function friendlyNameFromUuid(uuid) {
    const parts = uuid.split(".");
    const last = parts[parts.length - 1] ?? uuid;
    // Pure hex IDs are not human-readable; use the pack name instead.
    // Standard compendium UUID: Compendium.pf2e.{pack}.Item.{id}
    // The pack name is at index 2.
    if (/^[0-9a-fA-F]{16,}$/.test(last)) {
        return parts[2] ?? last;
    }
    return last;
}

/**
 * Resolves @UUID[...]{Display Text} (and bare @UUID[...]) references in
 * description text. Returns structured segments.
 *
 * @param {string} text - Raw description with @UUID markup
 * @param {import("bun:sqlite").Database} database
 * @returns {{ text: string, segments: Array<{ text: string, ruleItemId?: string }> }}
 */
export function resolveUuidRefs(text, database) {
    /** @type {Array<{ text: string, ruleItemId?: string }>} */
    const segments = [];
    let lastIndex = 0;
    let match;

    UUID_REGEX.lastIndex = 0;
    while ((match = UUID_REGEX.exec(text)) !== null) {
        const compendiumSource = match[1];
        const rawDisplayText = match[2]; // undefined when no {…} block

        // Push text before this match
        if (match.index > lastIndex) {
            segments.push({ text: text.slice(lastIndex, match.index) });
        }

        // Look up the rule item by compendium source
        const item = getRuleItemBySource(database, compendiumSource);
        // Resolve display text: prefer explicit {text}, else DB name, else path component
        const displayText =
            rawDisplayText ?? (item ? item.name : friendlyNameFromUuid(compendiumSource));

        if (item) {
            segments.push({ text: displayText, ruleItemId: item.id });
        } else {
            segments.push({ text: displayText });
        }

        lastIndex = match.index + match[0].length;
    }

    // Push remaining text
    if (lastIndex < text.length) {
        segments.push({ text: text.slice(lastIndex) });
    }

    return { text, segments };
}

/**
 * Resolves @Localize[key] references in description text.
 * @param {string} text - Raw description with @Localize markup
 * @param {Map<string, string>} localizations - key→text mapping
 * @returns {string}
 */
export function resolveLocalizeRefs(text, localizations) {
    return text.replace(LOCALIZE_REGEX, (match, key) => {
        const resolved = localizations.get(/** @type {string} */ (key));
        return resolved ?? match;
    });
}

/**
 * Loads the localizations map from data/localizations.json.
 * @returns {Map<string, string>}
 */
export function loadLocalizations() {
    const filePath = join(process.cwd(), "data", "localizations.json");
    if (!existsSync(filePath)) {
        return new Map();
    }
    try {
        const content = readFileSync(filePath, "utf-8");
        const parsed = /** @type {Record<string, string>} */ (JSON.parse(content));
        return new Map(Object.entries(parsed));
    } catch {
        return new Map();
    }
}
