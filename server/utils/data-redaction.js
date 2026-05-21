/**
 * @typedef {import("../../shared/types.js").CreatureData} CreatureData
 */

/**
 * Fields to keep when redacting creature data for player mode.
 * Only observable/informational fields that a character could perceive.
 * @type {ReadonlySet<string>}
 */
const PLAYER_ALLOWED_FIELDS = new Set([
    "name",
    "size",
    "type",
    "rarity",
    "traits",
    "blurb",
    "traitRefs",
]);

/**
 * Strips detailed creature fields (AC, HP, saves, abilities, melee, spellcasting,
 * actions) from a CreatureData object, keeping only observable information.
 * Sets `redacted: true` on the returned object.
 *
 * @param {CreatureData} data - Full creature data from the database.
 * @returns {CreatureData & { redacted: true }} Redacted creature data.
 */
export function redactCreatureDataForPlayer(data) {
    /** @type {Record<string, unknown>} */
    const result = { redacted: true };

    for (const key of PLAYER_ALLOWED_FIELDS) {
        if (key in data) {
            // @ts-expect-error — indexing CreatureData with a known-allowed key
            result[key] = data[key];
        }
    }

    return /** @type {CreatureData & { redacted: true }} */ (result);
}

/**
 * Strips numeric/stat lines from a creature-type RAG context section.
 * Keeps the header line and observable characteristics (name, size, type, traits, blurb).
 *
 * @param {string} sectionText - A single RAG context section for a creature entry.
 * @returns {string} Redacted section text.
 */
export function redactRagCreatureSection(sectionText) {
    const lines = sectionText.split("\n");
    /** @type {string[]} */
    const kept = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Always keep the header line: "--- Name (creature) [ID: ...] ---"
        if (trimmed.startsWith("---") && trimmed.endsWith("---")) {
            kept.push(line);
            continue;
        }

        // Keep lines that look like observable info: size, type, rarity, traits, blurb
        if (isObservableLine(trimmed)) {
            kept.push(line);
            continue;
        }

        // Skip lines that look like numeric stats
        if (isStatLine(trimmed)) {
            continue;
        }

        // Keep lines that are purely descriptive/narrative (no numbers or stat keywords)
        if (!hasStatKeywords(trimmed)) {
            kept.push(line);
        }
    }

    return kept.join("\n");
}

/**
 * Checks if a line looks like a numeric stat line.
 * @param {string} line
 * @returns {boolean}
 */
function isStatLine(line) {
    if (line === "") {
        return false;
    }

    // Match common stat patterns: "AC 21", "HP 55/55", "Fort +10", "Ref +9", etc.
    if (/^(AC|HP|Fort|Ref|Will|Perception|Initiative|Speed)\s/i.test(line)) {
        return true;
    }

    // Ability score lines: "STR +2", "DEX +4", etc.
    if (/^(STR|DEX|CON|INT|WIS|CHA)\s/i.test(line)) {
        return true;
    }

    // Skill modifier lines: "Acrobatics +9", "Athletics +7", etc.
    if (/^[A-Z][a-zA-Z]+\s[+-]\d+/.test(line)) {
        return true;
    }

    // Lines that start with a numeric modifier like "+9" or "-2"
    if (/^[+-]\d+/.test(line)) {
        return true;
    }

    // Melee/attack lines containing dice notation or attack bonuses
    if (/\d+d\d+/.test(line)) {
        return true;
    }

    // DC values
    if (/DC\s*\d+/i.test(line)) {
        return true;
    }

    return false;
}

/**
 * Checks if a line contains stat-related keywords that suggest mechanics.
 * @param {string} line
 * @returns {boolean}
 */
function hasStatKeywords(line) {
    const lower = line.toLowerCase();
    const statKeywords = [
        "armor class",
        "hit points",
        "saving throw",
        "ability modifier",
        "attack bonus",
        "damage dice",
        "melee strike",
        "ranged strike",
        "spell dc",
        "spell attack",
        "save bonus",
        "skill modifier",
        "ability score",
        "ability mod",
        "saving throw",
        "fortitude save",
        "reflex save",
        "will save",
        "speed",
        "languages",
        "perception",
        "initiative",
    ];

    return statKeywords.some((kw) => lower.includes(kw));
}

/**
 * Checks if a line is an observable/informational line that players can see.
 * @param {string} line
 * @returns {boolean}
 */
function isObservableLine(line) {
    // Trait lines: "Traits: Goblin, Humanoid"
    if (/^traits?:/i.test(line)) {
        return true;
    }

    // Size lines: "Size: Medium" or just "Medium creature"
    if (/^size:/i.test(line)) {
        return true;
    }

    // Rarity lines
    if (/^rarity:/i.test(line)) {
        return true;
    }

    // Type lines
    if (/^type:/i.test(line)) {
        return true;
    }

    // Blurb/description lines
    if (/^blurb:/i.test(line)) {
        return true;
    }

    // Description: lines (narrative, not stat-based)
    if (/^description:/i.test(line)) {
        return true;
    }

    return false;
}
