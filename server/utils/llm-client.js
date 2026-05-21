import { GEMINI_API_BASE, GEMINI_MODEL } from "../../shared/constants.js";
import { geminiResponseSchema, messageBlocksArraySchema } from "../../shared/schemas.js";
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
 * Builds the Gemini response schema matching the MessageBlock union.
 * @returns {Record<string, unknown>}
 */
export function buildGeminiResponseSchema() {
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
        properties: {
            type: { type: "string", enum: ["stat-block"] },
            title: { type: "string" },
            ruleItemId: { type: "string" },
        },
        // title is marked optional so Gemini's anyOf handling never drops
        // a stat-block just because two schemas share the ruleItemId field.
        required: ["type", "ruleItemId"],
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
            anyOf: [textBlock, calloutBlock, statBlockMessage, ruleDetailBlock],
        },
    };
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
4. NEVER emit stat-block or rule-detail blocks — you have no verified data to reference.`
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

### stat-block
Creature stat block. Use when the reference data contains a creature entry. Reference the creature by the ruleItemId shown in its [ID: ...] header.
- Example: { "type": "stat-block", "title": "Goblin Warrior", "ruleItemId": "abc-123" }
- The ruleItemId comes from the [ID: ...] in the creature's reference data header
- NEVER use stat-block for traits, conditions, or other non-creature items

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
- Respond directly and concisely as a helpful RPG assistant${ragSection}${ungroundedSection}`;
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

    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: buildSystemPrompt(ragContext, mode, ungrounded) }],
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

    const responseData = geminiResponseSchema.parse(await response.json());
    const usage = responseData.usageMetadata
        ? {
              promptTokenCount: responseData.usageMetadata.promptTokenCount,
              candidatesTokenCount: responseData.usageMetadata.candidatesTokenCount,
              totalTokenCount: responseData.usageMetadata.totalTokenCount,
          }
        : undefined;
    /** @type {string} */
    const rawText = responseData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    /** @type {unknown} */
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch {
        return { blocks: [{ type: "text", markdown: rawText }], usage: undefined };
    }

    let blocks;
    try {
        blocks = messageBlocksArraySchema.parse(parsed);
    } catch {
        return { blocks: [{ type: "text", markdown: rawText }], usage: undefined };
    }

    if (blocks.length === 0) {
        return {
            blocks: [
                {
                    type: "text",
                    markdown: "I couldn't generate a response. Please try again.",
                },
            ],
            usage: undefined,
        };
    }

    return { blocks, usage };
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
        // oxlint-disable-next-line no-console
        console.warn("LLM client error, falling back to mock:", error);
        return { blocks: getMockResponse(userId), usage: undefined };
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
