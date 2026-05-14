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
 * Fetches the raw stream from the Gemini API.
 *
 * @param {string} model
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<ReadableStream<Uint8Array>>}
 */
async function getGeminiStream(model, apiKey, systemPrompt, userMessage) {
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

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
        throw new Error("Gemini API response body is empty.");
    }

    return response.body;
}
/**
 * Parses a single line of SSE data.
 *
 * @param {string} line
 * @returns {string | null}
 */
function processSseLine(line) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data: ")) {
        return null;
    }

    const data = trimmed.slice(6);
    if (data === "[DONE]") {
        return null;
    }

    try {
        return parseGeminiSseChunk(data);
    } catch (e) {
        throw new Error(`SSE Parse Error: ${e instanceof Error ? e.message : String(e)}`);
    }
}

/**
 * Transforms a ReadableStream into a generator of text chunks.
 *
 * @param {ReadableStream<Uint8Array>} stream
 * @returns {AsyncGenerator<string, void, unknown>}
 */
async function* parseSseStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            sseBuffer += decoder.decode(value, { stream: !done });

            const lines = sseBuffer.split(/\r?\n/);
            sseBuffer = lines.pop() ?? "";

            for (const line of lines) {
                const text = processSseLine(line);
                if (text) {
                    yield text;
                }
            }

            if (done) {
                break;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Streams an LLM response and yields MessageBlock objects.
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {{ model?: string, apiKey?: string }} [options]
 * @returns {AsyncGenerator<MessageBlock, void, unknown>}
 */
export async function* streamLlmResponse(systemPrompt, userMessage, options = {}) {
    const apiKey = options.apiKey ?? process.env.GOOGLE_AI_API_KEY ?? "";
    const model = options.model ?? RAG_CONFIG.LLM_MODEL;

    if (!apiKey || process.env.MOCK_GOOGLE_AI === "1") {
        yield* streamMockResponse();
        return;
    }

    let accumulatedText = "";
    let yieldedBlocksCount = 0;

    try {
        const stream = await getGeminiStream(model, apiKey, systemPrompt, userMessage);

        for await (const textChunk of parseSseStream(stream)) {
            accumulatedText += textChunk;

            /** @type {MessageBlock[]} */
            const currentBlocks = splitIntoBlocks(accumulatedText);

            // Yield only fully completed blocks to prevent rendering partial JSON/markdown
            while (yieldedBlocksCount < currentBlocks.length - 1) {
                yield currentBlocks[yieldedBlocksCount++];
            }
        }

        // Final yield for the remaining blocks
        /** @type {MessageBlock[]} */
        const finalBlocks = splitIntoBlocks(accumulatedText);
        while (yieldedBlocksCount < finalBlocks.length) {
            yield finalBlocks[yieldedBlocksCount++];
        }
    } catch (error) {
        yield* [
            {
                type: "paragraph",
                text: `Sorry, I'm having trouble generating a response right now. Please try again later. (Error details: ${error instanceof Error ? error.message : String(error)})`,
            },
        ];
    }
}
