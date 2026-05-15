/**
 * Parser for Foundry PF2e inline markup (@Check, @Damage, @Template, inline rolls).
 * Splits a description string into typed segments for rich rendering.
 *
 * @typedef {{ type: "text"; text: string }} TextSeg
 * @typedef {{ type: "check"; skill: string; dc?: number; against?: string; label?: string; options?: Record<string, string> }} CheckSeg
 * @typedef {{ type: "damage"; formula: string; damageTypes: string[]; options?: Record<string, string> }} DamageSeg
 * @typedef {{ type: "template"; shape: string; distance?: number; displayText?: string }} TemplateSeg
 * @typedef {{ type: "roll"; label?: string; formula?: string }} RollSeg
 * @typedef {TextSeg | CheckSeg | DamageSeg | TemplateSeg | RollSeg} InlineSeg
 */

/**
 * Matches @Check[...], @Damage[...], @Template[...]{...}, and [[/...]] inline
 * rolls. Roll patterns capture optional {display text}.
 */
const INLINE_RE =
    /@(Check|Damage|Template)\[((?:[^\[\]]+|\[[^\]]*\])+)\](?:\{([^}]+)\})?|\[\[\/([^\]]+)\]\](?:\{([^}]+)\})?/g;

/**
 * Parses pipe-delimited `|key:value` options from an inline parameter string.
 * @param {string[]} parts - parts after splitting on `|`
 * @returns {Record<string, string>}
 */
function parseOptions(parts) {
    /** @type {Record<string, string>} */
    const opts = {};
    for (const part of parts) {
        const colon = part.indexOf(":");
        if (colon === -1) {
            continue;
        }
        const key = part.slice(0, colon);
        const val = part.slice(colon + 1);
        opts[key] = val;
    }
    return opts;
}

/**
 * @param {string} inner - content inside @Check[...]
 * @returns {CheckSeg}
 */
function parseCheck(inner) {
    const parts = inner.split("|");
    const skill = parts[0] ?? "flat";
    /** @type {CheckSeg} */
    const seg = { type: "check", skill };
    for (const part of parts.slice(1)) {
        const colon = part.indexOf(":");
        if (colon === -1) {
            continue;
        }
        const key = part.slice(0, colon);
        const val = part.slice(colon + 1);
        if (key === "dc") {
            const n = parseInt(val, 10);
            if (!isNaN(n)) {
                seg.dc = n;
            }
        } else if (key === "against") {
            seg.against = val;
        } else if (key === "name") {
            seg.label = val;
        }
    }
    // Build options from non-standard keys
    seg.options = parseOptions(parts.slice(1));
    return seg;
}

/**
 * @param {string} inner - content inside @Damage[...]
 * @returns {DamageSeg}
 */
function parseDamage(inner) {
    // Strip @item.xxx.yyy references
    const cleaned = inner
        .replace(/@\w+(?:\.\w+)+/g, "\u2026")
        .replace(/\s+/g, " ")
        .trim();
    // Options are pipe-delimited after the main content
    const pipeIdx = cleaned.lastIndexOf("|");
    let core = cleaned;
    let optionsRaw = "";
    if (pipeIdx !== -1 && cleaned.slice(pipeIdx + 1).startsWith("options:")) {
        core = cleaned.slice(0, pipeIdx).trim();
        optionsRaw = cleaned.slice(pipeIdx + 1);
    }
    // Format: "formula[type1,type2]" — find the last bracketed type list
    const braceStart = core.lastIndexOf("[");
    if (braceStart !== -1 && core.endsWith("]")) {
        const formula = core.slice(0, braceStart).trim() || core;
        const types = core
            .slice(braceStart + 1, -1)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        /** @type {DamageSeg} */
        const seg = { type: "damage", formula, damageTypes: types };
        if (optionsRaw) {
            seg.options = parseOptions(optionsRaw.split("|"));
        }
        return seg;
    }
    /** @type {DamageSeg} */
    const seg = { type: "damage", formula: cleaned, damageTypes: [] };
    if (optionsRaw) {
        seg.options = parseOptions(optionsRaw.split("|"));
    }
    return seg;
}

/**
 * @param {string} inner - content inside @Template[...] (e.g. "emanation|distance:5")
 * @param {string | undefined} displayText - text from {...} suffix
 * @returns {TemplateSeg}
 */
function parseTemplate(inner, displayText) {
    const parts = inner.split("|");
    const shape = parts[0] ?? "emanation";
    /** @type {TemplateSeg} */
    const seg = {
        type: "template",
        shape,
        displayText: displayText ?? undefined,
    };
    for (const part of parts.slice(1)) {
        const colon = part.indexOf(":");
        if (colon !== -1 && part.slice(0, colon) === "distance") {
            const n = parseInt(part.slice(colon + 1), 10);
            if (!isNaN(n)) {
                seg.distance = n;
            }
        }
    }
    return seg;
}

/**
 * Parses [[/gmr ...]], [[/act ...]] inline roll directives.
 * @param {string} inner - content inside [[/...]]
 * @param {string | undefined} displayText - optional {...} display text
 * @returns {RollSeg}
 */
function parseInlineRoll(inner, displayText) {
    const hashIdx = inner.indexOf("#");
    const formula = hashIdx === -1 ? inner.trim() : inner.slice(0, hashIdx).trim();
    const hashLabel = hashIdx === -1 ? undefined : inner.slice(hashIdx + 1).trim();
    // Prefer explicit {display text} over #label from formula body
    return { type: "roll", label: displayText ?? hashLabel, formula };
}

/**
 * Parses a Foundry description string, splitting out @Check, @Damage, @Template,
 * and [[/...]] inline markup into typed segments. Plain text between matches becomes
 * TextSeg entries.
 * @param {string} text
 * @returns {InlineSeg[]}
 */
export function parseFoundryInline(text) {
    /** @type {InlineSeg[]} */
    const result = [];
    let last = 0;
    INLINE_RE.lastIndex = 0;
    let m;
    while ((m = INLINE_RE.exec(text)) !== null) {
        if (m.index > last) {
            result.push({ type: "text", text: text.slice(last, m.index) });
        }
        if (m[4] !== undefined) {
            // [[/gmr ...]] or [[/act ...]] inline roll
            result.push(parseInlineRoll(m[4], m[5]));
        } else if (m[1] === "Check") {
            result.push(parseCheck(m[2]));
        } else if (m[1] === "Damage") {
            result.push(parseDamage(m[2]));
        } else if (m[1] === "Template") {
            result.push(parseTemplate(m[2], m[3]));
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) {
        result.push({ type: "text", text: text.slice(last) });
    }
    return result;
}

/**
 * Formats a CheckSeg as a compact human-readable label.
 * @param {CheckSeg} seg
 * @returns {string}
 */
export function formatCheck(seg) {
    const skill = seg.skill.charAt(0).toUpperCase() + seg.skill.slice(1);
    if (seg.against) {
        const vs = seg.against.charAt(0).toUpperCase() + seg.against.slice(1);
        return `${skill} vs. ${vs} DC`;
    }
    if (seg.dc !== undefined) {
        return `${skill} DC ${seg.dc}`;
    }
    if (seg.label) {
        return `${skill}: ${seg.label}`;
    }
    return skill;
}

/**
 * Formats a DamageSeg as a compact human-readable label.
 * @param {DamageSeg} seg
 * @returns {string}
 */
export function formatDamage(seg) {
    if (seg.damageTypes.length > 0) {
        return `${seg.formula} ${seg.damageTypes.join(" ")}`;
    }
    return seg.formula;
}

/**
 * @param {TemplateSeg} seg
 * @returns {string}
 */
export function formatTemplate(seg) {
    const shape = seg.shape.charAt(0).toUpperCase() + seg.shape.slice(1);
    if (seg.distance !== undefined) {
        return `${seg.distance}-ft ${shape}`;
    }
    return shape;
}

/**
 * @param {RollSeg} seg
 * @returns {string}
 */
export function formatRoll(seg) {
    if (seg.label) {
        return seg.label;
    }
    if (seg.formula && seg.formula.startsWith("/act ")) {
        return seg.formula.slice(5);
    }
    return seg.formula ?? "";
}

/**
 * Maps common option keys to human-readable labels for tooltips.
 * @param {Record<string, string> | undefined} options
 * @returns {string}
 */
export function optionsTooltip(options) {
    if (!options) {
        return "";
    }
    return Object.entries(options)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
}
