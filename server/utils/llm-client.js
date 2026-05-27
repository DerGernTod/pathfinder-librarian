import { GEMINI_API_BASE, GEMINI_MODEL } from "../../shared/constants.js";
import { dualPassResponseSchema, geminiResponseSchema } from "../../shared/schemas.js";
import { getMockResponse } from "./mock-response.js";

/**
 * Recursively removes `additionalProperties` keys from a schema object.
 * Gemini API does not support additionalProperties in responseSchema.
 * @param {Record<string, unknown>} schema
 * @returns {Record<string, unknown>}
 */
export function stripAdditionalProperties(schema) {
    const cleaned = /** @type {Record<string, unknown>} */ ({});
    for (const [key, value] of Object.entries(schema)) {
        if (key === "additionalProperties") {
            continue; // skip this key entirely
        }
        if (Array.isArray(value)) {
            cleaned[key] = value.map((item) =>
                typeof item === "object" && item !== null
                    ? stripAdditionalProperties(/** @type {Record<string, unknown>} */ (item))
                    : item,
            );
        } else if (typeof value === "object" && value !== null) {
            cleaned[key] = stripAdditionalProperties(
                /** @type {Record<string, unknown>} */ (value),
            );
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

export class RetryableError extends Error {
    /** @param {string} message */
    constructor(message) {
        super(message);
        this.name = "RetryableError";
    }
}

/**
 * @typedef {import("../../shared/types.js").MessageBlock} MessageBlock
 */

/**
 * Builds the Gemini response schema matching the MessageBlock union.
 * @param {{ withScratchpad?: boolean }} [options]
 * @returns {Record<string, unknown>}
 */
export function buildGeminiResponseSchema(options) {
    const withScratchpad = options?.withScratchpad ?? false;
    const textBlock = {
        type: "object",
        properties: {
            type: { type: "string", enum: ["text"] },
            markdown: { type: "string" },
            italic: { type: "boolean" },
        },
        required: ["type", "markdown"],
    };

    const calloutBlock = {
        type: "object",
        properties: {
            type: { type: "string", enum: ["callout"] },
            title: { type: "string" },
            markdown: { type: "string" },
        },
        required: ["type", "title", "markdown"],
    };

    const statBlockMessage = {
        type: "object",
        description:
            "Emit ONLY when you have a ruleItemId from reference data. Requires the ruleItemId field. Do NOT include a data field.",
        properties: {
            type: { type: "string", enum: ["stat-block"] },
            title: { type: "string" },
            ruleItemId: { type: "string" },
        },
        // title is marked optional so Gemini's anyOf handling never drops
        // a stat-block just because two schemas share the ruleItemId field.
        required: ["type", "ruleItemId"],
    };

    const customStatBlockMessage = {
        type: "object",
        description:
            "Use when creating or inventing a creature NOT found in reference data. Includes inline stats in the data field. NEVER use stat-block for invented creatures — use custom-stat-block instead.",
        properties: {
            type: { type: "string", enum: ["custom-stat-block"] },
            title: {
                type: "string",
                description: "Display name for the stat block heading.",
            },
            data: {
                type: "object",
                description: "Full inline creature stats. Provide as much detail as possible.",
                properties: {
                    name: {
                        type: "string",
                        description: "The creature's name.",
                    },
                    type: {
                        type: "string",
                        description:
                            "Short creature type classification, e.g. 'Dragon', 'Animal', 'Humanoid', 'Undead', 'Fey'. NOT a narrative description or rules explanation.",
                    },
                    level: {
                        type: "number",
                        description: "Integer level from -1 to 25 for Pathfinder 2e.",
                    },
                    rarity: {
                        type: "string",
                        description: "One of: Common, Uncommon, Rare, or Unique.",
                    },
                    traits: {
                        type: "array",
                        items: { type: "string", description: "A single trait label." },
                        description:
                            "Array of short trait labels, e.g. ['Dragon', 'Aquatic', 'Cold'].",
                    },
                    perception: {
                        type: "number",
                        description: "Perception skill modifier value.",
                    },
                    languages: {
                        type: "object",
                        properties: { value: { type: "array", items: { type: "string" } } },
                    },
                    size: {
                        type: "string",
                        description:
                            "Size category: Tiny, Small, Medium, Large, Huge, or Gargantuan.",
                    },
                    blurb: {
                        type: "string",
                        description:
                            "One-sentence flavor description of the creature's appearance or nature. Keep it brief.",
                    },
                    attributes: {
                        type: "object",
                        properties: {
                            ac: {
                                type: "object",
                                properties: {
                                    value: { type: "number" },
                                    details: { type: "string" },
                                },
                            },
                            hp: {
                                type: "object",
                                properties: {
                                    value: { type: "number" },
                                    max: { type: "number" },
                                    details: { type: "string" },
                                },
                            },
                            fortitude: {
                                type: "object",
                                properties: {
                                    value: { type: "number" },
                                    saveDetail: { type: "string" },
                                },
                            },
                            reflex: {
                                type: "object",
                                properties: {
                                    value: { type: "number" },
                                    saveDetail: { type: "string" },
                                },
                            },
                            will: {
                                type: "object",
                                properties: {
                                    value: { type: "number" },
                                    saveDetail: { type: "string" },
                                },
                            },
                            speed: { type: "string" },
                        },
                    },
                    abilities: {
                        type: "object",
                        properties: {
                            str: { type: "object", properties: { mod: { type: "number" } } },
                            dex: { type: "object", properties: { mod: { type: "number" } } },
                            con: { type: "object", properties: { mod: { type: "number" } } },
                            int: { type: "object", properties: { mod: { type: "number" } } },
                            wis: { type: "object", properties: { mod: { type: "number" } } },
                            cha: { type: "object", properties: { mod: { type: "number" } } },
                        },
                    },
                    skills: {
                        type: "object",
                        additionalProperties: {
                            type: "object",
                            properties: { value: { type: "number" } },
                        },
                    },
                    melee: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                attack: { type: "string" },
                                damage: { type: "string" },
                                damageType: { type: "string" },
                                traits: { type: "array", items: { type: "string" } },
                            },
                        },
                    },
                    actions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                actionType: {
                                    anyOf: [
                                        { type: "integer" },
                                        { type: "string", enum: ["reaction", "free"] },
                                    ],
                                },
                                traits: { type: "array", items: { type: "string" } },
                                description: {
                                    type: "string",
                                    description:
                                        "Full narrative description. Can be multiple paragraphs. Include lore, behavior, and appearance.",
                                },
                            },
                        },
                    },
                    spellcasting: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                tradition: { type: "string" },
                                type: { type: "string" },
                                dc: { type: "number" },
                                attackModifier: { type: "number" },
                                slots: {
                                    type: "object",
                                    additionalProperties: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                name: { type: "string" },
                                                rank: { type: "number" },
                                            },
                                        },
                                    },
                                },
                                cantrips: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            rank: { type: "number" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    description: { type: "string" },
                },
                required: ["name", "level"],
            },
        },
        required: ["type", "title", "data"],
    };

    const ruleDetailBlock = {
        type: "object",
        properties: {
            type: { type: "string", enum: ["rule-detail"] },
            ruleItemId: { type: "string" },
        },
        required: ["type", "ruleItemId"],
    };

    const blocksArraySchema = {
        type: "array",
        items: {
            anyOf: [
                textBlock,
                calloutBlock,
                customStatBlockMessage,
                statBlockMessage,
                ruleDetailBlock,
            ],
        },
    };

    if (withScratchpad) {
        return {
            type: "object",
            properties: {
                internal_reasoning_scratchpad: {
                    type: "string",
                    description:
                        "CRITICAL: Write down your step-by-step logic, trait filtering, and rule classifications here FIRST before populating any other field.",
                },
                blocks: blocksArraySchema,
            },
            required: ["internal_reasoning_scratchpad", "blocks"],
        };
    }

    return blocksArraySchema;
}

/**
 * Builds a system prompt for the Gemini API call.
 * @param {string} ragContext - RAG-retrieved text chunks (empty string if none)
 * @param {string} mode - "player" or "gm" — adjusts prompt tone and focus
 * @param {boolean} [ungrounded=false] - When true, appends instructions for ungrounded responses
 * @returns {string}
 */
export function buildSystemPrompt(ragContext, mode, ungrounded) {
    const roleGuidance =
        mode === "gm"
            ? "You are advising a Game Master. Focus on encounter building, rules arbitration, NPC management, and running engaging games."
            : "You are advising a player. Focus on character options, combat tactics, spell selection, and understanding rules.";

    const ragSection = ragContext.length > 0 ? `\n\n## Reference Data\n${ragContext}` : "";

    const ungroundedSection =
        ungrounded === true
            ? `\n\n## IMPORTANT — No Reference Data Available
The database search returned NO matching results for the user's question. You must:
1. Begin your response with a text block that says: "I don't have specific data in my database about this topic, but here's what I can share based on general Pathfinder 2e knowledge:"
2. Clearly indicate throughout your response that this information is from general knowledge, not verified database entries.
3. Avoid presenting speculation as fact. If you're genuinely unsure, say so.
4. NEVER emit stat-block or rule-detail blocks — you have no verified data to reference. You MAY emit custom-stat-block blocks for invented creatures — these include inline data rather than DB references.`
            : "";

    const playerRestrictions = `

## Player Mode Restrictions
You are responding to a PLAYER, not the Game Master. You must protect confidential game information:
- NEVER reveal creature mechanics: AC, HP, saves, ability scores, skill modifiers, attack bonuses, damage dice, DCs, or spell details
- Describe creatures narratively: appearance, size, observable traits, general behavior — what a character would see, not stat numbers
- If the reference data contains a creature, you MAY emit a stat-block but only observable info will be shown to the player
- For lore questions, share only what is commonly known in the game world — preserve mysteries and secrets for the GM to reveal
- When in doubt, err on the side of revealing less. Suggest "Ask your GM for more details" when appropriate`;

    return `You are a Pathfinder 2e RPG assistant. ${roleGuidance}${mode === "player" ? playerRestrictions : ""}

## Output Format
You MUST respond with a JSON array of message blocks. Do NOT include any text outside the JSON array. Do NOT wrap the output in markdown code fences.

## Block Types

### text
Freeform markdown for narrative, explanations, or bullet lists. Use standard markdown formatting:
- **bold** for emphasis, *italic* for flavor text
- \`code\` for game terms like \`DC 15\`
- - Bullet lists for enumerations
- 1. Numbered lists for sequences
- > Blockquotes for quoted rules
Use "italic: true" for in-character dialogue or flavor text.
- Example: { "type": "text", "markdown": "You deal **2d6 fire damage** to the target. The creature must succeed at a **DC 15** Fortitude save." }

### callout
Important rules, key mechanics, or highlighted information. "title" is the heading. "markdown" body supports same formatting as text blocks.
- Example: { "type": "callout", "title": "Critical Success", "markdown": "When you **critically succeed** on a saving throw, you take **no damage** from effects that would deal half damage on a success." }

### custom-stat-block
Custom or invented creature stat block with inline data. Use when the user asks you to create, invent, or imagine a creature that is NOT in the reference data. Provide full stats inline.
- Example: { "type": "custom-stat-block", "title": "Sylvaris", "data": { "name": "Sylvaris", "type": "Humanoid", "level": 5, "traits": ["Elf", "Ranger"], "attributes": { "ac": { "value": 22 }, "hp": { "value": 75, "max": 75 }, "speed": "30 feet" }, "abilities": { "str": { "mod": 2 }, "dex": { "mod": 4 }, "con": { "mod": 1 }, "int": { "mod": 2 }, "wis": { "mod": 3 }, "cha": { "mod": 1 } } } }
- "data.type": Short classification (e.g. "Dragon", "Animal", "Humanoid", "Undead"). NOT narrative prose, NOT rules text, NOT multi-sentence descriptions.
- If you mention traits like "Aquatic" or "Cold", put them in the "traits" array, NOT in "data.type".
- skills: { "Skill Name": { "value": 5 }, ... } — map of skill names to their modifier values
- spellcasting[].slots: { "1": [{ "name": "Spell Name", "rank": 1 }], ... } — map of spell level (string) to array of prepared/known spells
- The data object MUST include "name" and "level". All other fields (attributes, abilities, skills, melee, actions, etc.) are optional but recommended for a complete stat block.
- CRITICAL: NEVER use "stat-block" for invented creatures. If you don't have a ruleItemId from reference data, you MUST use "custom-stat-block".
- NEVER emit more than ONE custom-stat-block for the same creature. Each creature gets exactly one stat block.

### stat-block
Creature stat block from reference data. Use ONLY when the reference data contains a creature entry AND you can provide its ruleItemId.
- Example: { "type": "stat-block", "title": "Goblin Warrior", "ruleItemId": "abc-123" }
- The ruleItemId comes from the [ID: ...] in the creature's reference data header
- NEVER use stat-block for traits, conditions, or other non-creature items
- NEVER use stat-block for invented creatures — use custom-stat-block instead
- CRITICAL: "stat-block" MUST have a "ruleItemId" field and MUST NOT have a "data" field

### rule-detail
A non-creature rule item (trait, condition, feat, etc.) that has its OWN dedicated entry in the reference data — meaning it has its own [ID: ...] header line.
- Example: { "type": "rule-detail", "ruleItemId": "abc-123" }
- The ruleItemId MUST come from an [ID: ...] line on that item's own header
- NEVER use rule-detail for a trait that is merely listed as a property of a creature or another item — only use it when the trait itself has an independent entry in the reference data
- NEVER use rule-detail with an ID taken from a creature entry

## Guidelines
- Treat the reference data as your own knowledge. NEVER say "based on the provided data", "the information suggests", "according to the context", or similar meta-phrases
- Speak directly and confidently as a Pathfinder 2e expert
- When the reference data contains a creature entry, ALWAYS emit a "stat-block" block using the creature's ruleItemId — never reconstruct stats manually or use rule-detail for a creature
- Use rule-detail ONLY for items that have their own independent [ID: ...] header in the reference data (e.g. a trait entry, a condition entry) — not for traits listed inside another item's data
- Combine blocks to give a complete answer: a text block for context, stat-block for the creature, rule-detail only for independently-listed items
- Use markdown formatting: **bold** for key values (DCs, damage dice, critical terms), \`code\` for game terms, bullet lists for enumerations
- Each response should typically have 2-5 blocks
- When the user asks you to create or invent a creature/NPC, use custom-stat-block with full inline stats
- **NO DUPLICATION**: NEVER emit two blocks with the same information. Do not repeat the same stat block multiple times. Each custom-stat-block must represent a distinct creature.
- Respond directly and concisely as a helpful RPG assistant${ragSection}${ungroundedSection}`;
}

/**
 * Builds the system prompt for Pass 1: Creative & Contextual Generation.
 * @param {string} ragContext
 * @param {string} mode
 * @param {boolean} [ungrounded]
 * @returns {string}
 */
export function buildCreativeSystemPrompt(ragContext, mode, ungrounded) {
    const roleGuidance =
        mode === "gm"
            ? "You are advising a Game Master. Focus on encounter building, rules arbitration, NPC management, and running engaging games."
            : "You are advising a player. Focus on character options, combat tactics, spell selection, and understanding rules.";

    const ragSection = ragContext.length > 0 ? `\n\n## Reference Data\n${ragContext}` : "";

    const ungroundedSection =
        ungrounded === true
            ? `\n\n## IMPORTANT — No Reference Data Available
The database search returned NO matching results for the user's question. You must:
1. Begin your response by acknowledging that you don't have specific data in your database about this topic.
2. Clearly indicate throughout your response that this information is from general knowledge, not verified database entries.
3. Avoid presenting speculation as fact. If you're genuinely unsure, say so.
4. Do NOT reference specific database IDs or stat-block/rule-detail markers.`
            : "";

    const playerRestrictions = `

## Player Mode Restrictions
You are responding to a PLAYER, not the Game Master. You must protect confidential game information:
- NEVER reveal creature mechanics: AC, HP, saves, ability scores, skill modifiers, attack bonuses, damage dice, DCs, or spell details
- Describe creatures narratively: appearance, size, observable traits, general behavior — what a character would see, not stat numbers
- For lore questions, share only what is commonly known in the game world — preserve mysteries and secrets for the GM to reveal
- When in doubt, err on the side of revealing less. Suggest "Ask your GM for more details" when appropriate`;

    return `You are a Pathfinder 2e RPG assistant. ${roleGuidance}${mode === "player" ? playerRestrictions : ""}

Think step-by-step and lay out all components clearly in structured Markdown.

## Output Structure

Produce your response in structured Markdown following these conventions:

### Narrative Text
Use plain paragraphs with markdown formatting for explanations, descriptions, and lists:
- **bold** for emphasis, *italic* for flavor text
- \`code\` for game terms like \`DC 15\`
- Bullet lists and numbered lists where appropriate
- > Blockquotes for quoted rules

### Key Rules / Callouts
When highlighting an important rule, use a heading: \`## Key Rule: <title>\` followed by the rule body in markdown.

### Stat Blocks from Reference Data
When the reference data contains a creature, include a section like:
\`\`\`
--- STAT BLOCK ---
Name: Creature Name
ID: <ruleItemId from reference data>
\`\`\`

### Custom / Invented Stat Blocks
When creating or inventing a creature NOT in reference data, include a structured section with full inline stats:
\`\`\`
--- CUSTOM STAT BLOCK ---
Name: Creature Name
Type: Short classification
Level: <number>
Traits: trait1, trait2, ...
AC: <value>
HP: <value>/<max>
Fortitude: +<value>
Reflex: +<value>
Will: +<value>
Speed: <value>
STR: +<value>, DEX: +<value>, CON: +<value>, INT: +<value>, WIS: +<value>, CHA: +<value>
Skills: Skill1 +<value>, Skill2 +<value>
Melee: WeaponName +<attack> (<damage> <damageType>)
Actions: ActionName (<actionType>) - description
\`\`\`

### Rule Details
For non-creature rule items (traits, conditions, feats) with their own database entry:
\`\`\`
[RULE-DETAIL: <ruleItemId>]
\`\`\`

## Guidelines
- Treat the reference data as your own knowledge. NEVER say "based on the provided data" or similar meta-phrases
- Speak directly and confidently as a Pathfinder 2e expert
- When the reference data contains a creature entry, ALWAYS include a STAT BLOCK section with the creature's ruleItemId
- Combine sections to give a complete answer
- Use markdown formatting: **bold** for key values, \`code\` for game terms
- **NO DUPLICATION**: Do not repeat the same information multiple times
- Respond directly and concisely as a helpful RPG assistant${ragSection}${ungroundedSection}`;
}

/**
 * Builds the system prompt for Pass 2: Structural Extraction.
 * @returns {string}
 */
export function buildExtractionSystemPrompt() {
    return `You are a JSON transformation engine. You receive structured Markdown from a Pathfinder 2e assistant and must convert it into a JSON array of message blocks.

Output ONLY a JSON object with this exact structure:
{
  "internal_reasoning_scratchpad": "Your step-by-step parsing logic here",
  "blocks": [ ... array of message blocks ... ]
}

## Block Types

### text
Freeform markdown for narrative, explanations, or bullet lists.
- Example: { "type": "text", "markdown": "You deal **2d6 fire damage** to the target." }
- Use "italic": true for in-character dialogue or flavor text.

### callout
Important rules, key mechanics, or highlighted information. "title" is the heading.
- Example: { "type": "callout", "title": "Critical Success", "markdown": "When you **critically succeed**..." }

### custom-stat-block
Custom or invented creature stat block with inline data. Use when the Markdown contains a CUSTOM STAT BLOCK section.
- Example: { "type": "custom-stat-block", "title": "Sylvaris", "data": { "name": "Sylvaris", "type": "Humanoid", "level": 5, "traits": ["Elf", "Ranger"], "attributes": { "ac": { "value": 22 }, "hp": { "value": 75, "max": 75 } } } }
- "data.type": Short classification (e.g. "Dragon", "Animal", "Humanoid"). NOT narrative prose.
- The data object MUST include "name" and "level".
- NEVER emit more than ONE custom-stat-block for the same creature.

### stat-block
Creature stat block from reference data. Use ONLY when the Markdown contains a STAT BLOCK section with an ID from reference data.
- Example: { "type": "stat-block", "title": "Goblin Warrior", "ruleItemId": "abc-123" }
- CRITICAL: "stat-block" MUST have a "ruleItemId" field and MUST NOT have a "data" field

### rule-detail
A non-creature rule item with its own database entry.
- Example: { "type": "rule-detail", "ruleItemId": "abc-123" }
- Use ONLY for items that have their own [RULE-DETAIL: ...] marker in the input

## Rules
- Output ONLY valid JSON. No markdown code fences, no extra text.
- Each distinct concept gets its own block. Typically 2-5 blocks per response.
- Preserve ALL information from the input — do not summarize or drop content.
- **NO DUPLICATION**: Do not emit two blocks with the same information.`;
}

/**
 * Pass 1: Creative & Contextual Generation.
 * Calls Gemini with high temperature, no JSON schema constraint.
 * Returns raw Markdown text with step-by-step reasoning.
 * @param {Array<{role: string, parts: Array<{text: string}>}>} contents
 * @param {string} ragContext
 * @param {string} mode
 * @param {boolean} [ungrounded]
 * @returns {Promise<{ text: string, usage?: import("../../shared/types.js").UsageMeta }>}
 */
export async function callGeminiPass1(contents, ragContext, mode, ungrounded) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
    }

    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: buildCreativeSystemPrompt(ragContext, mode, ungrounded) }],
        },
        generationConfig: {
            temperature: 0.85,
            topP: 0.95,
            maxOutputTokens: 8192,
        },
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 503) {
            throw new RetryableError(`Service temporarily unavailable: ${errorText}`);
        }
        if (response.status === 429) {
            throw new Error(`Gemini API rate limit exceeded: ${errorText}`);
        }
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const responseData = geminiResponseSchema.parse(await response.json());
    const usage = responseData.usageMetadata
        ? {
              promptTokenCount: responseData.usageMetadata.promptTokenCount,
              candidatesTokenCount: responseData.usageMetadata.candidatesTokenCount,
              totalTokenCount: responseData.usageMetadata.totalTokenCount,
          }
        : undefined;

    const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return { text, usage };
}

/**
 * Pass 2: Structural Extraction.
 * Calls Gemini with low temperature and strict JSON schema.
 * Receives Pass 1 Markdown output and transforms it into structured blocks.
 * This function can throw on HTTP errors, JSON parse failures, or schema
 * validation failures — the caller (callGeminiJson) is responsible for
 * fallback handling.
 * @param {string} pass1Text - Raw Markdown from Pass 1
 * @param {Record<string, unknown>} sanitizedSchema
 * @returns {Promise<{ blocks: import("../../shared/types.js").MessageBlock[], usage?: import("../../shared/types.js").UsageMeta }>}
 */
export async function callGeminiPass2(pass1Text, sanitizedSchema) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
    }

    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [{ text: pass1Text }],
            },
        ],
        systemInstruction: {
            parts: [{ text: buildExtractionSystemPrompt() }],
        },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: sanitizedSchema,
            temperature: 0.1,
            topP: 0.5,
            maxOutputTokens: 8192,
        },
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 503) {
            throw new RetryableError(`Service temporarily unavailable: ${errorText}`);
        }
        if (response.status === 429) {
            throw new Error(`Gemini API rate limit exceeded: ${errorText}`);
        }
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const responseData = geminiResponseSchema.parse(await response.json());
    const usage = responseData.usageMetadata
        ? {
              promptTokenCount: responseData.usageMetadata.promptTokenCount,
              candidatesTokenCount: responseData.usageMetadata.candidatesTokenCount,
              totalTokenCount: responseData.usageMetadata.totalTokenCount,
          }
        : undefined;

    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    /** @type {unknown} */
    const parsed = JSON.parse(rawText);

    const validated = dualPassResponseSchema.parse(parsed);

    return { blocks: validated.blocks, usage };
}

/**
 * Calls the Gemini API with JSON mode to get a structured response.
 * @param {Array<{role: string, parts: Array<{text: string}>}>} contents - Full conversation turns
 * @param {string} ragContext - RAG-retrieved context (empty string if none)
 * @param {string} mode - "player" or "gm"
 * @param {boolean} [ungrounded=false] - When true, adjusts system prompt for ungrounded responses
 * @returns {Promise<{ blocks: import("../../shared/types.js").MessageBlock[], usage?: import("../../shared/types.js").UsageMeta }>}
 */
export async function callGeminiJson(contents, ragContext, mode, ungrounded) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
    }

    const pass1 = await callGeminiPass1(contents, ragContext, mode, ungrounded);

    try {
        const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
        const sanitizedSchema = stripAdditionalProperties(rawSchema);
        const pass2 = await callGeminiPass2(pass1.text, sanitizedSchema);

        const usage =
            pass1.usage && pass2.usage
                ? {
                      promptTokenCount:
                          (pass1.usage.promptTokenCount ?? 0) + (pass2.usage.promptTokenCount ?? 0),
                      candidatesTokenCount:
                          (pass1.usage.candidatesTokenCount ?? 0) +
                          (pass2.usage.candidatesTokenCount ?? 0),
                      totalTokenCount:
                          (pass1.usage.totalTokenCount ?? 0) + (pass2.usage.totalTokenCount ?? 0),
                  }
                : (pass1.usage ?? pass2.usage);

        if (pass2.blocks.length === 0) {
            return {
                blocks: [{ type: "text", markdown: pass1.text }],
                usage: pass1.usage,
            };
        }

        return { blocks: pass2.blocks, usage };
    } catch (pass2Error) {
        // oxlint-disable-next-line no-console
        console.warn("Pass 2 failed, falling back to Pass 1 text:", pass2Error);
        return {
            blocks: [{ type: "text", markdown: pass1.text }],
            usage: pass1.usage,
        };
    }
}

/**
 * Gets an LLM response, falling back to mock on any error.
 * @param {Array<{role: string, parts: Array<{text: string}>}>} contents - Full conversation turns
 * @param {string} ragContext - RAG-retrieved context (empty string if none)
 * @param {string} mode - "player" or "gm"
 * @param {string} [userId]
 * @param {boolean} [ungrounded=false] - When true, adjusts system prompt for ungrounded responses
 * @returns {Promise<{ blocks: import("../../shared/types.js").MessageBlock[], usage?: import("../../shared/types.js").UsageMeta }>}
 */
export async function getLlmResponse(contents, ragContext, mode, userId, ungrounded) {
    try {
        return await callGeminiJson(contents, ragContext, mode, ungrounded);
    } catch (error) {
        if (error instanceof RetryableError) {
            throw error;
        }
        // Only fall back to mock in test environments where ENABLE_MOCK_FALLBACK is set.
        // This keeps VR tests working while preventing mock responses in production.
        if (process.env.ENABLE_MOCK_FALLBACK === "true") {
            // oxlint-disable-next-line no-console
            console.warn("LLM client error, falling back to mock (test env):", error);
            return { blocks: getMockResponse(userId), usage: undefined };
        }
        // oxlint-disable-next-line no-console
        console.error("LLM client error:", error);
        throw new Error(
            "The AI service encountered an error. Please try again or contact support if the issue persists.",
        );
    }
}

/**
 * Calls the Gemini API to produce a plain-text summary of conversation messages.
 * Used for compaction — no JSON mode, no structured schema.
 * @param {string} messagesText - Serialized conversation messages to summarize
 * @returns {Promise<string>}
 */
export async function callGeminiForSummarization(messagesText) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
    }

    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const systemPrompt =
        "You are summarizing a Pathfinder 2e RPG conversation. " +
        "Produce a concise but comprehensive summary preserving all key facts, " +
        "rules discussed, creatures mentioned, decisions made, and any ongoing " +
        "questions or tasks. Write in plain text, not JSON.";

    const requestBody = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: `Please summarize the following conversation:\n\n${messagesText}`,
                    },
                ],
            },
        ],
        systemInstruction: {
            parts: [{ text: systemPrompt }],
        },
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini summarization API error: ${response.status} ${errorText}`);
    }

    const responseData = geminiResponseSchema.parse(await response.json());
    return responseData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
