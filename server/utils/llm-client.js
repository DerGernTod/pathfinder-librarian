import { GEMINI_API_BASE, GEMINI_MODEL } from "../../shared/constants.js";
import { messageBlocksArraySchema } from "../../shared/schemas.js";
import { getMockResponse } from "./mock-response.js";

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
 * Builds the Gemini-format response schema for CreatureData sub-tree.
 * @returns {Record<string, unknown>}
 */
function buildCreatureDataGeminiSchema() {
    return {
        type: "object",
        properties: {
            name: { type: "string" },
            type: { type: "string" },
            level: { type: "number" },
            rarity: { type: "string" },
            traits: { type: "array", items: { type: "string" } },
            perception: { type: "number" },
            languages: {
                type: "object",
                properties: {
                    value: { type: "array", items: { type: "string" } },
                    details: { type: "string" },
                },
                required: ["value"],
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
                        required: ["value"],
                    },
                    hp: {
                        type: "object",
                        properties: {
                            value: { type: "number" },
                            max: { type: "number" },
                            details: { type: "string" },
                        },
                        required: ["value", "max"],
                    },
                    fortitude: {
                        type: "object",
                        properties: { value: { type: "number" } },
                        required: ["value"],
                    },
                    reflex: {
                        type: "object",
                        properties: { value: { type: "number" } },
                        required: ["value"],
                    },
                    will: {
                        type: "object",
                        properties: { value: { type: "number" } },
                        required: ["value"],
                    },
                    speed: { type: "string" },
                },
            },
            abilities: {
                type: "object",
                properties: {
                    str: {
                        type: "object",
                        properties: { mod: { type: "number" } },
                        required: ["mod"],
                    },
                    dex: {
                        type: "object",
                        properties: { mod: { type: "number" } },
                        required: ["mod"],
                    },
                    con: {
                        type: "object",
                        properties: { mod: { type: "number" } },
                        required: ["mod"],
                    },
                    int: {
                        type: "object",
                        properties: { mod: { type: "number" } },
                        required: ["mod"],
                    },
                    wis: {
                        type: "object",
                        properties: { mod: { type: "number" } },
                        required: ["mod"],
                    },
                    cha: {
                        type: "object",
                        properties: { mod: { type: "number" } },
                        required: ["mod"],
                    },
                },
            },
            skills: {
                type: "object",
                properties: {
                    Athletics: {
                        type: "object",
                        properties: {
                            value: { type: "number" },
                            ability: { type: "string" },
                        },
                        required: ["value"],
                    },
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
                        compendiumSource: { type: "string" },
                        traits: { type: "array", items: { type: "string" } },
                    },
                    required: ["name", "attack", "damage"],
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
                            properties: {
                                "1st": {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            compendiumSource: { type: "string" },
                                            rank: { type: "number" },
                                            usage: { type: "string" },
                                            heightened: { type: "boolean" },
                                        },
                                        required: ["name"],
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
                                    compendiumSource: { type: "string" },
                                    rank: { type: "number" },
                                    usage: { type: "string" },
                                    heightened: { type: "boolean" },
                                },
                                required: ["name"],
                            },
                        },
                    },
                    required: ["name"],
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
                                { type: "number" },
                                { type: "string", enum: ["reaction", "free"] },
                            ],
                        },
                        traits: { type: "array", items: { type: "string" } },
                        description: { type: "string" },
                        compendiumSource: { type: "string" },
                        deathNote: { type: "boolean" },
                    },
                    required: ["name", "description"],
                },
            },
            description: { type: "string" },
            compendiumSource: { type: "string" },
            itemRefs: { type: "array", items: { type: "string" } },
        },
        required: ["name", "level", "traits", "attributes", "abilities"],
    };
}

/** Segment schema shared across block types */
const segmentItems = {
    type: "array",
    items: {
        type: "object",
        properties: {
            text: { type: "string" },
            highlight: { type: "boolean" },
        },
        required: ["text"],
    },
};

/**
 * Builds the Gemini response schema matching the MessageBlock union.
 * @returns {Record<string, unknown>}
 */
export function buildGeminiResponseSchema() {
    const paragraphBlock = {
        type: "object",
        properties: {
            type: { type: "string", enum: ["paragraph"] },
            text: { type: "string" },
            segments: segmentItems,
            italic: { type: "boolean" },
        },
        required: ["type"],
    };

    const calloutBlock = {
        type: "object",
        properties: {
            type: { type: "string", enum: ["callout"] },
            title: { type: "string" },
            text: { type: "string" },
            segments: segmentItems,
        },
        required: ["type", "title"],
    };

    const listBlock = {
        type: "object",
        properties: {
            type: { type: "string", enum: ["list"] },
            items: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        title: { type: "string" },
                        text: { type: "string" },
                        segments: segmentItems,
                    },
                    required: ["title"],
                },
            },
        },
        required: ["type", "items"],
    };

    const statBlockMessage = {
        type: "object",
        properties: {
            type: { type: "string", enum: ["stat-block"] },
            title: { type: "string" },
            data: buildCreatureDataGeminiSchema(),
        },
        required: ["type", "title", "data"],
    };

    return {
        type: "array",
        items: {
            anyOf: [paragraphBlock, calloutBlock, listBlock, statBlockMessage],
        },
    };
}

/**
 * Builds a system prompt for the Gemini API call.
 * @param {string} ragContext - RAG-retrieved text chunks (empty string if none)
 * @param {string} mode - "player" or "gm" — adjusts prompt tone and focus
 * @returns {string}
 */
export function buildSystemPrompt(ragContext, mode) {
    const roleGuidance =
        mode === "gm"
            ? "You are advising a Game Master. Focus on encounter building, rules arbitration, NPC management, and running engaging games."
            : "You are advising a player. Focus on character options, combat tactics, spell selection, and understanding rules.";

    const ragSection = ragContext.length > 0 ? `\n\n## Reference Data\n${ragContext}` : "";

    return `You are a Pathfinder 2e RPG assistant. ${roleGuidance}

## Output Format
You MUST respond with a JSON array of message blocks. Do NOT include any text outside the JSON array. Do NOT wrap the output in markdown code fences.

## Block Types

### paragraph
Freeform text for narrative, explanations, or answers. Use the "text" field for plain text, or "segments" array for structured text with highlighted portions. Use "italic: true" for in-character dialogue or flavor text.
- Example: { "type": "paragraph", "text": "Some explanatory text here." }
- Example with segments: { "type": "paragraph", "segments": [{ "text": "You deal ", "highlight": false }, { "text": "2d6 fire damage", "highlight": true }] }

### callout
Important rules, key mechanics, or highlighted information. "title" is the heading. Use "segments" or "text" for the body. Use "highlight: true" on critical values.
- Example: { "type": "callout", "title": "Key Rule", "segments": [{ "text": "When you critically hit, ", "highlight": false }, { "text": "double the damage dice", "highlight": true }] }

### list
Enumerations, options, features, or bullet-point information. Each item has a "title" (bold label) and optional "text" or "segments" for details.
- Example: { "type": "list", "items": [{ "title": "Stride", "text": "Move up to your Speed" }, { "title": "Strike", "text": "Make a melee or ranged attack" }] }

### stat-block
Complete creature stat block. ONLY use when full creature data is available from the reference data. Must include a "data" object with name, level, traits, and other creature fields.
- Example: { "type": "stat-block", "title": "Goblin Warrior", "data": { "name": "Goblin Warrior", "level": -1, "traits": ["goblin", "humanoid"], ... } }

## Guidelines
- Treat the reference data as your own knowledge. NEVER say "based on the provided data", "the information suggests", "according to the context", or similar meta-phrases
- Speak directly and confidently as a Pathfinder 2e expert
- When the reference data contains a creature with stat information, emit a "stat-block" block with all available fields
- Use "segments" with "highlight: true" sparingly — only for critical numbers, DCs, and key terms
- For creative or explanatory text, use the plain "text" field in paragraphs
- Use descriptions and lore from the reference data to make your response engaging and flavorful
- Each response should typically have 2-5 blocks
- Respond directly and concisely as a helpful RPG assistant${ragSection}`;
}

/**
 * Calls the Gemini API with JSON mode to get a structured response.
 * @param {string} userMessage - The user's chat message
 * @param {string} ragContext - RAG-retrieved context (empty string if none)
 * @param {string} mode - "player" or "gm"
 * @returns {Promise<MessageBlock[]>}
 */
export async function callGeminiJson(userMessage, ragContext, mode) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
    }

    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        systemInstruction: {
            parts: [{ text: buildSystemPrompt(ragContext, mode) }],
        },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: buildGeminiResponseSchema(),
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

    const responseData =
        /** @type {{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }} */ (
            await response.json()
        );
    /** @type {string} */
    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    /** @type {unknown} */
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch {
        return [{ type: "paragraph", text: rawText }];
    }

    let blocks;
    try {
        blocks = messageBlocksArraySchema.parse(parsed);
    } catch {
        return [{ type: "paragraph", text: rawText }];
    }

    if (blocks.length === 0) {
        return [{ type: "paragraph", text: "I couldn't generate a response. Please try again." }];
    }

    return blocks;
}

/**
 * Gets an LLM response, falling back to mock on any error.
 * @param {string} userMessage - The user's chat message
 * @param {string} ragContext - RAG-retrieved context (empty string if none)
 * @param {string} mode - "player" or "gm"
 * @returns {Promise<MessageBlock[]>}
 */
export async function getLlmResponse(userMessage, ragContext, mode) {
    try {
        return await callGeminiJson(userMessage, ragContext, mode);
    } catch (error) {
        if (error instanceof RetryableError) {
            throw error;
        }
        // oxlint-disable-next-line no-console
        console.warn("LLM client error, falling back to mock:", error);
        return getMockResponse();
    }
}
