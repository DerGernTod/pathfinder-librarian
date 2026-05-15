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
            ruleItemId: { type: "string" },
        },
        required: ["type", "title", "ruleItemId"],
    };

    const ruleDetailBlock = {
        type: "object",
        properties: {
            type: { type: "string", enum: ["rule-detail"] },
            ruleItemId: { type: "string" },
        },
        required: ["type", "ruleItemId"],
    };

    return {
        type: "array",
        items: {
            anyOf: [paragraphBlock, calloutBlock, listBlock, statBlockMessage, ruleDetailBlock],
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
Creature stat block. Use when the reference data contains a creature. Instead of copying the stats, reference the creature by its ruleItemId.
- Example: { "type": "stat-block", "title": "Goblin Warrior", "ruleItemId": "abc-123" }
- The ruleItemId is shown in the reference data header as [ID: ...]

### rule-detail
Reference to a rule item (trait, condition, feat, etc.) by ID. Use when referencing a non-creature rule item from the context data.
- Example: { "type": "rule-detail", "ruleItemId": "abc-123" }
- The ruleItemId is shown in the reference data header as [ID: ...]
- Use for traits, conditions, feats, equipment, and other non-creature items

## Guidelines
- Treat the reference data as your own knowledge. NEVER say "based on the provided data", "the information suggests", "according to the context", or similar meta-phrases
- Speak directly and confidently as a Pathfinder 2e expert
- When the reference data contains a creature, emit a "stat-block" using its ruleItemId — never try to reconstruct creature stats manually
- When referencing a condition or trait mentioned in the reference data, use the "rule-detail" block type
- Combine rule-detail with paragraph blocks for a complete answer
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
        return [
            {
                type: "paragraph",
                text: "I couldn't generate a response. Please try again.",
            },
        ];
    }

    return blocks;
}

/**
 * Gets an LLM response, falling back to mock on any error.
 * @param {string} userMessage - The user's chat message
 * @param {string} ragContext - RAG-retrieved context (empty string if none)
 * @param {string} mode - "player" or "gm"
 * @param {string} [userId]
 * @returns {Promise<MessageBlock[]>}
 */
export async function getLlmResponse(userMessage, ragContext, mode, userId) {
    try {
        return await callGeminiJson(userMessage, ragContext, mode);
    } catch (error) {
        if (error instanceof RetryableError) {
            throw error;
        }
        // oxlint-disable-next-line no-console
        console.warn("LLM client error, falling back to mock:", error);
        return getMockResponse(userId);
    }
}
