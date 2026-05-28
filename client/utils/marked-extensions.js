import { marked } from "marked";

/**
 * Escapes characters for safe use in HTML text content.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Escapes characters for safe use in HTML attribute values (double-quoted).
 * @param {string} str
 * @returns {string}
 */
export function escapeAttr(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** @type {Record<string, string>} */
const ACTION_MAP = {
    1: "\u2B24",
    2: "\u2B24\u2B24",
    3: "\u2B24\u2B24\u2B24",
    reaction: "\u27F3",
    free: "\u25C7",
};

/**
 * @typedef {Object} DiceToken
 * @property {"dice"} type
 * @property {string} raw
 * @property {string} formula
 */

/**
 * @typedef {Object} DcToken
 * @property {"dc"} type
 * @property {string} raw
 * @property {string} value
 */

/**
 * @typedef {Object} ConditionToken
 * @property {"condition"} type
 * @property {string} raw
 * @property {string} name
 */

/**
 * @typedef {Object} TraitToken
 * @property {"trait"} type
 * @property {string} raw
 * @property {string} name
 */

/**
 * @typedef {Object} ActionToken
 * @property {"action"} type
 * @property {string} raw
 * @property {string} actionType
 */

/** @type {TokenizerAndRendererExtension} */
const diceExtension = {
    name: "dice",
    level: "inline",
    /**
     * @param {string} src
     * @returns {number | undefined}
     */
    start(src) {
        return src.indexOf(":dice{");
    },
    /**
     * @param {string} src
     * @param {unknown[]} _tokens
     * @returns {DiceToken | undefined}
     */
    tokenizer(src, _tokens) {
        const rule = /^:dice\{([^}]+)\}/;
        const match = rule.exec(src);
        if (match) {
            return { type: "dice", raw: match[0], formula: match[1].trim() };
        }
        return undefined;
    },
    /**
     * @param {DiceToken} token
     * @returns {string}
     */
    renderer(token) {
        return `<span class="dice-badge" data-formula="${escapeAttr(token.formula)}">${escapeHtml(token.formula)}</span>`;
    },
};

/** @type {TokenizerAndRendererExtension} */
const dcExtension = {
    name: "dc",
    level: "inline",
    /**
     * @param {string} src
     * @returns {number | undefined}
     */
    start(src) {
        return src.indexOf(":dc{");
    },
    /**
     * @param {string} src
     * @param {unknown[]} _tokens
     * @returns {DcToken | undefined}
     */
    tokenizer(src, _tokens) {
        const rule = /^:dc\{([^}]+)\}/;
        const match = rule.exec(src);
        if (match) {
            return { type: "dc", raw: match[0], value: match[1].trim() };
        }
        return undefined;
    },
    /**
     * @param {DcToken} token
     * @returns {string}
     */
    renderer(token) {
        return `<span class="dc-badge">DC ${escapeHtml(token.value)}</span>`;
    },
};

/** @type {TokenizerAndRendererExtension} */
const conditionExtension = {
    name: "condition",
    level: "inline",
    /**
     * @param {string} src
     * @returns {number | undefined}
     */
    start(src) {
        return src.indexOf(":condition{");
    },
    /**
     * @param {string} src
     * @param {unknown[]} _tokens
     * @returns {ConditionToken | undefined}
     */
    tokenizer(src, _tokens) {
        const rule = /^:condition\{([^}]+)\}/;
        const match = rule.exec(src);
        if (match) {
            return { type: "condition", raw: match[0], name: match[1].trim() };
        }
        return undefined;
    },
    /**
     * @param {ConditionToken} token
     * @returns {string}
     */
    renderer(token) {
        return `<span class="condition-badge">${escapeHtml(token.name)}</span>`;
    },
};

/** @type {TokenizerAndRendererExtension} */
const traitExtension = {
    name: "trait",
    level: "inline",
    /**
     * @param {string} src
     * @returns {number | undefined}
     */
    start(src) {
        return src.indexOf(":trait{");
    },
    /**
     * @param {string} src
     * @param {unknown[]} _tokens
     * @returns {TraitToken | undefined}
     */
    tokenizer(src, _tokens) {
        const rule = /^:trait\{([^}]+)\}/;
        const match = rule.exec(src);
        if (match) {
            return { type: "trait", raw: match[0], name: match[1].trim() };
        }
        return undefined;
    },
    /**
     * @param {TraitToken} token
     * @returns {string}
     */
    renderer(token) {
        return `<span class="trait-badge">${escapeHtml(token.name)}</span>`;
    },
};

/** @type {TokenizerAndRendererExtension} */
const actionExtension = {
    name: "action",
    level: "inline",
    /**
     * @param {string} src
     * @returns {number | undefined}
     */
    start(src) {
        return src.indexOf(":action{");
    },
    /**
     * @param {string} src
     * @param {unknown[]} _tokens
     * @returns {ActionToken | undefined}
     */
    tokenizer(src, _tokens) {
        const rule = /^:action\{([^}]+)\}/;
        const match = rule.exec(src);
        if (match) {
            return { type: "action", raw: match[0], actionType: match[1].trim() };
        }
        return undefined;
    },
    /**
     * @param {ActionToken} token
     * @returns {string}
     */
    renderer(token) {
        const symbol = ACTION_MAP[token.actionType] ?? token.actionType;
        return `<span class="action-icon" data-actions="${escapeAttr(token.actionType)}">${escapeHtml(symbol)}</span>`;
    },
};

marked.use({
    extensions: [diceExtension, dcExtension, conditionExtension, traitExtension, actionExtension],
});
