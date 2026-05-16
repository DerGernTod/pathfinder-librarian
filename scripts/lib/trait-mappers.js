/**
 * @typedef {{ type: string, name: string, compendiumSource: string, dataJson: string }} ImportableRuleItem
 */

/**
 * Builds a compendium source UUID from a pack name and item _id.
 * @param {string} packName
 * @param {string} itemId
 * @returns {string}
 */
function buildTraitSource(packName, itemId) {
    return `Compendium.pf2e.${packName}.Item.${itemId}`;
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
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
}

/**
 * Maps a Foundry trait JSON to an importable rule item.
 * @param {unknown} rawJson - The parsed Foundry JSON
 * @param {string} packName - e.g. "traits"
 * @returns {ImportableRuleItem}
 */
export function mapTrait(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const category = /** @type {string | undefined } */ (
        typeof sys.category === "string" ? sys.category : undefined
    );

    const compendiumSource = buildTraitSource(packName, raw._id ?? "");
    const descText = stripHtml(typeof description?.value === "string" ? description.value : "");

    return {
        type: "trait",
        name: raw.name ?? "Unknown Trait",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Trait",
            description: descText,
            category,
            compendiumSource,
        }),
    };
}

/**
 * Maps a Foundry condition JSON to an importable rule item.
 * @param {unknown} rawJson - The parsed Foundry JSON
 * @param {string} packName - e.g. "conditionitems"
 * @returns {ImportableRuleItem}
 */
export function mapCondition(rawJson, packName) {
    const raw =
        /** @type {{ _id?: string, name?: string, system?: Record<string, unknown> }} */ (rawJson);
    const sys = /** @type {Record<string, unknown>} */ (raw.system ?? {});
    const description = /** @type {{ value?: string } | undefined } */ (sys.description);
    const references = /** @type {Record<string, unknown> | undefined } */ (sys.references);

    const compendiumSource = buildTraitSource(packName, raw._id ?? "");
    const descText = stripHtml(typeof description?.value === "string" ? description.value : "");

    return {
        type: "condition",
        name: raw.name ?? "Unknown Condition",
        compendiumSource,
        dataJson: JSON.stringify({
            name: raw.name ?? "Unknown Condition",
            description: descText,
            category: "condition",
            compendiumSource,
            references: references ?? undefined,
        }),
    };
}
