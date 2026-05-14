import { RAG_CONFIG } from "../../shared/constants.js";
import { streamMockResponse } from "./mock-response.js";

/**
 * @typedef {import("../../shared/types.js").MessageBlock} MessageBlock
 * @typedef {import("../../shared/types.js").RagContext} RagContext
 * @typedef {import("../../shared/types.js").Mode} Mode
 */

/**
 * Builds the system prompt for the LLM with role, mode guidance, and RAG context.
 * @param {RagContext} ragContext - Retrieved context from RAG pipeline.
 * @param {Mode} mode - Player or GM mode.
 * @returns {string}
 */
export function buildSystemPrompt(ragContext, mode) {
    const modeGuidance =
        mode === "gm"
            ? "You are assisting a Game Master. Focus on rules interpretation, NPC stat blocks, encounter building, and GM tips. Be comprehensive and provide page references when possible."
            : "You are assisting a player. Focus on helping them understand their character's abilities, rules for their actions, and gameplay tips. Keep answers concise and actionable.";

    /** @type {string[]} */
    const parts = [
        `You are a Pathfinder 2e rules assistant. ${modeGuidance}`,
        "",
        "Always cite the specific rule or source when possible. If you're unsure about a rule, say so rather than guessing.",
        "Format your responses clearly using paragraphs, callouts for key rules, and lists for multiple items.",
    ];

    if (ragContext.contextText) {
        parts.push("", ragContext.contextText);
    }

    return parts.join("\n");
}

/**
 * @typedef {{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }} GeminiSseChunk
 */

/**
 * Parses Gemini SSE streaming response text into accumulated text.
 * @param {string} sseText
 * @returns {string}
 */
function parseGeminiSseChunk(sseText) {
    try {
        const parsed = /** @type {GeminiSseChunk} */ (JSON.parse(sseText));
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        return text;
    } catch {
        return "";
    }
}

/**
 * Splits LLM response text into MessageBlock objects.
 * Simple heuristic: split on double-newlines for paragraphs,
 * detect **Title:** patterns for callouts, detect - Item: patterns for lists.
 * @param {string} text
 * @returns {MessageBlock[]}
 */
function splitIntoBlocks(text) {
    if (!text.trim()) {
        return [];
    }

    const lines = text.split("\n");
    /** @type {MessageBlock[]} */
    const blocks = [];
    /** @type {string[]} */
    let currentParagraph = [];

    /**
     * @param {string} line
     * @returns {{ title: string, text: string } | null}
     */
    function tryParseCallout(line) {
        const match = line.match(/^\*\*(.+?)\*\*:?\s*(.*)/);
        if (match) {
            return { title: match[1], text: match[2] };
        }
        return null;
    }

    for (const line of lines) {
        // Empty line = paragraph break
        if (line.trim() === "") {
            if (currentParagraph.length > 0) {
                const text = currentParagraph.join(" ").trim();
                if (text) {
                    blocks.push({ type: "paragraph", text });
                }
                currentParagraph = [];
            }
            continue;
        }

        // Check for callout pattern: **Title:** rest of line
        const callout = tryParseCallout(line);
        if (callout) {
            // Flush current paragraph first
            if (currentParagraph.length > 0) {
                const text = currentParagraph.join(" ").trim();
                if (text) {
                    blocks.push({ type: "paragraph", text });
                }
                currentParagraph = [];
            }
            blocks.push({ type: "callout", title: callout.title, text: callout.text });
            continue;
        }

        // Check for list pattern: - Item or * Item
        if (/^[-*]\s+/.test(line.trim())) {
            // Flush current paragraph first
            if (currentParagraph.length > 0) {
                const text = currentParagraph.join(" ").trim();
                if (text) {
                    blocks.push({ type: "paragraph", text });
                }
                currentParagraph = [];
            }

            // Try to find or create a list block
            const itemText = line.trim().replace(/^[-*]\s+/, "");
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock && lastBlock.type === "list") {
                lastBlock.items.push({ title: itemText });
            } else {
                blocks.push({ type: "list", items: [{ title: itemText }] });
            }
            continue;
        }

        // Regular text — accumulate into current paragraph
        currentParagraph.push(line.trim());
    }

    // Flush remaining paragraph
    if (currentParagraph.length > 0) {
        const text = currentParagraph.join(" ").trim();
        if (text) {
            blocks.push({ type: "paragraph", text });
        }
    }

    return blocks;
}

/**
 * Streams an LLM response, either from the Gemini API or the mock response generator.
 * Yields MessageBlock objects as they become available.
 *
 * @param {string} systemPrompt - The system instruction for the LLM.
 * @param {string} userMessage - The user's message text.
 * @param {{ model?: string, apiKey?: string }} [options]
 * @returns {AsyncGenerator<MessageBlock, void, unknown>}
 */
export async function* streamLlmResponse(systemPrompt, userMessage, options = {}) {
    const apiKey = options.apiKey ?? process.env.GOOGLE_AI_API_KEY ?? "";
    const model = options.model ?? RAG_CONFIG.LLM_MODEL;

    // Mock mode: no API key or MOCK_GOOGLE_AI=1
    if (!apiKey || process.env.MOCK_GOOGLE_AI === "1") {
        yield* streamMockResponse();
        return;
    }

    // Real API call
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: userMessage }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
            }),
        });

        if (!response.ok || !response.body) {
            // oxlint-disable-next-line no-console -- diagnostic for LLM fallback
            console.warn(`LLM API error: ${response.status} ${await response.text()}`);
            yield* streamMockResponse();
            return;
        }

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";
        let yieldedBlocks = 0;
        /** @type {string} */
        let sseBuffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            sseBuffer += decoder.decode(value, { stream: true });

            // Parse SSE events (double newline delimited)
            const events = sseBuffer.split("\n\n");
            sseBuffer = /** @type {string} */ (events.pop());

            for (const event of events) {
                for (const line of event.split("\n")) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") {
                            continue;
                        }
                        const text = parseGeminiSseChunk(data);
                        if (text) {
                            accumulatedText += text;
                        }
                    }
                }
            }

            // Periodically yield blocks from accumulated text
            const blocks = splitIntoBlocks(accumulatedText);
            for (let i = yieldedBlocks; i < blocks.length; i++) {
                yield blocks[i];
                yieldedBlocks++;
            }
        }

        // Yield any remaining text as final blocks
        const finalBlocks = splitIntoBlocks(accumulatedText);
        for (let i = yieldedBlocks; i < finalBlocks.length; i++) {
            yield finalBlocks[i];
        }

        // If no blocks were yielded at all, wrap as single paragraph
        if (yieldedBlocks === 0 && accumulatedText.trim()) {
            yield { type: "paragraph", text: accumulatedText.trim() };
        }
    } catch (error) {
        // oxlint-disable-next-line no-console -- diagnostic for LLM fallback
        console.warn(`LLM API error: ${error instanceof Error ? error.message : String(error)}`);
        yield* streamMockResponse();
    }
}
