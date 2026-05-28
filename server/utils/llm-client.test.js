import { afterEach, describe, expect, it, mock } from "bun:test";

import {
    RetryableError,
    buildCreativeSystemPrompt,
    buildExtractionSystemPrompt,
    buildGeminiResponseSchema,
    buildSystemPrompt,
    callGeminiForSummarization,
    callGeminiJson,
    callGeminiPass1,
    callGeminiPass2,
    getLlmResponse,
    stripAdditionalProperties,
} from "./llm-client.js";

/**
 * @param {() => Promise<unknown>} fn
 */
function mockFetch(fn) {
    globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (mock(fn)));
}

/** Helper to build a valid Gemini API response wrapping the given JSON text
 * @param {string} jsonText
 * @param {{ promptTokenCount?: number, candidatesTokenCount?: number, totalTokenCount?: number }} [usage]
 */
function geminiResponse(jsonText, usage) {
    return {
        ok: true,
        json: () =>
            Promise.resolve({
                candidates: [
                    {
                        content: {
                            parts: [{ text: jsonText }],
                        },
                    },
                ],
                ...(usage ? { usageMetadata: usage } : {}),
            }),
    };
}

/** Helper to build a plain-text Gemini API response (no JSON wrapping)
 * @param {string} text
 * @param {{ promptTokenCount?: number, candidatesTokenCount?: number, totalTokenCount?: number }} [usage]
 */
function geminiTextResponse(text, usage) {
    return geminiResponse(text, usage);
}

/** Helper to set up dual-pass mock: Pass 1 returns text, Pass 2 returns JSON blocks
 * @param {string} pass1Text
 * @param {string} pass2Json
 * @param {{ promptTokenCount?: number, candidatesTokenCount?: number, totalTokenCount?: number }} [pass1Usage]
 * @param {{ promptTokenCount?: number, candidatesTokenCount?: number, totalTokenCount?: number }} [pass2Usage]
 */
function dualPassMock(pass1Text, pass2Json, pass1Usage, pass2Usage) {
    let callIndex = 0;
    return () => {
        callIndex++;
        if (callIndex === 1) {
            return Promise.resolve(geminiTextResponse(pass1Text, pass1Usage));
        }
        return Promise.resolve(geminiResponse(pass2Json, pass2Usage));
    };
}

/** Wrap blocks in scratchpad envelope for dual-pass Pass 2 responses
 * @param {string} scratchpad
 * @param {import("../../shared/types.js").MessageBlock[]} blocks
 */
function scratchpadEnvelope(scratchpad, blocks) {
    return JSON.stringify({ internal_reasoning_scratchpad: scratchpad, blocks });
}

describe("llm-client", () => {
    afterEach(() => {
        mock.restore();
        delete process.env.GOOGLE_AI_API_KEY;
    });

    describe("callGeminiPass1", () => {
        it("returns raw Markdown text on success", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() => Promise.resolve(geminiTextResponse("Here is a **goblin**.")));

            const result = await callGeminiPass1(
                [{ role: "user", parts: [{ text: "Tell me about goblins" }] }],
                "",
                "gm",
            );

            expect(result.text).toBe("Here is a **goblin**.");
            expect(result.usage).toBeUndefined();
        });

        it("sends correct generationConfig: temperature 0.85, topP 0.95, no JSON mode", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiTextResponse("Some markdown")));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiPass1([{ role: "user", parts: [{ text: "test" }] }], "", "player");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));

            expect(body.generationConfig.temperature).toBe(0.85);
            expect(body.generationConfig.topP).toBe(0.95);
            expect(body.generationConfig.maxOutputTokens).toBe(8192);
            expect(body.generationConfig.responseMimeType).toBeUndefined();
            expect(body.generationConfig.responseSchema).toBeUndefined();
        });

        it("uses creative system prompt with step-by-step instructions", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiTextResponse("Markdown")));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiPass1([{ role: "user", parts: [{ text: "test" }] }], "", "gm");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));
            const promptText = body.systemInstruction.parts[0].text;

            expect(promptText).toContain("step-by-step");
            expect(promptText).toContain("Pathfinder");
        });

        it("passes conversation contents correctly", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiTextResponse("text")));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const contents = [
                { role: "user", parts: [{ text: "Hello" }] },
                { role: "model", parts: [{ text: "Hi there" }] },
                { role: "user", parts: [{ text: "Tell me about dragons" }] },
            ];

            await callGeminiPass1(contents, "rag context", "gm");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));

            expect(body.contents).toEqual(contents);
        });

        it("throws RetryableError on 503", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 503,
                    text: () => Promise.resolve("Service unavailable"),
                }),
            );

            try {
                await callGeminiPass1([{ role: "user", parts: [{ text: "test" }] }], "", "player");
                expect.unreachable("Should have thrown");
            } catch (error) {
                expect(error).toBeInstanceOf(RetryableError);
                expect(/** @type {Error} */ (error).message).toContain(
                    "Service temporarily unavailable",
                );
            }
        });

        it("throws rate limit error on 429", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 429,
                    text: () => Promise.resolve("Rate limit exceeded"),
                }),
            );

            expect(
                callGeminiPass1([{ role: "user", parts: [{ text: "test" }] }], "", "player"),
            ).rejects.toThrow("Gemini API rate limit exceeded");
        });

        it("throws descriptive error on other non-OK status", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    text: () => Promise.resolve("Internal Server Error"),
                }),
            );

            expect(
                callGeminiPass1([{ role: "user", parts: [{ text: "test" }] }], "", "player"),
            ).rejects.toThrow("Gemini API error: 500 Internal Server Error");
        });

        it("throws when API key is missing", async () => {
            delete process.env.GOOGLE_AI_API_KEY;

            expect(
                callGeminiPass1([{ role: "user", parts: [{ text: "test" }] }], "", "player"),
            ).rejects.toThrow("GOOGLE_AI_API_KEY environment variable is not set");
        });

        it("returns usage metadata from Gemini response", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const usageMeta = {
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
            };

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() =>
                Promise.resolve(geminiTextResponse("Markdown output", usageMeta)),
            );
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await callGeminiPass1(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.text).toBe("Markdown output");
            expect(result.usage).toEqual({
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
            });
        });

        it("returns usage undefined when metadata missing", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() => Promise.resolve(geminiTextResponse("text")));

            const result = await callGeminiPass1(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.text).toBe("text");
            expect(result.usage).toBeUndefined();
        });
    });

    describe("callGeminiPass2", () => {
        it("returns parsed blocks from scratchpad-wrapped JSON on success", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [
                { type: "text", markdown: "Hello" },
                { type: "callout", title: "Rule", markdown: "**Important**" },
            ];
            const jsonText = scratchpadEnvelope("Parsing the markdown...", blocks);

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(jsonText)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);
            const result = await callGeminiPass2("Pass 1 text here", sanitizedSchema);

            expect(result.blocks).toEqual(blocks);
            expect(result.usage).toBeUndefined();
        });

        it("sends correct generationConfig: temperature 0.1, topP 0.5, JSON mode", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const singleBlock = [{ type: "text", markdown: "Test" }];
            const jsonText = scratchpadEnvelope("reasoning", singleBlock);

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(jsonText)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);
            await callGeminiPass2("some text", sanitizedSchema);

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));

            expect(body.generationConfig.temperature).toBe(0.1);
            expect(body.generationConfig.topP).toBe(0.5);
            expect(body.generationConfig.maxOutputTokens).toBe(8192);
            expect(body.generationConfig.responseMimeType).toBe("application/json");
            expect(body.generationConfig.responseSchema).toBeDefined();
            expect(body.generationConfig.responseSchema.type).toBe("object");
        });

        it("schema includes internal_reasoning_scratchpad and blocks (withScratchpad=true)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const singleBlock = [{ type: "text", markdown: "Test" }];
            const jsonText = scratchpadEnvelope("reasoning", singleBlock);

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(jsonText)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);
            await callGeminiPass2("text", sanitizedSchema);

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));
            const schema = body.generationConfig.responseSchema;

            expect(schema.type).toBe("object");
            expect(schema.properties.internal_reasoning_scratchpad).toBeDefined();
            expect(schema.properties.blocks).toBeDefined();
            expect(schema.required).toContain("internal_reasoning_scratchpad");
            expect(schema.required).toContain("blocks");
        });

        it("contents contain Pass 1 text as single user turn", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const singleBlock = [{ type: "text", markdown: "Test" }];
            const jsonText = scratchpadEnvelope("reasoning", singleBlock);

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(jsonText)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);
            await callGeminiPass2("Pass 1 markdown content", sanitizedSchema);

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));

            expect(body.contents).toHaveLength(1);
            expect(body.contents[0].role).toBe("user");
            expect(body.contents[0].parts[0].text).toBe("Pass 1 markdown content");
        });

        it("uses extraction system prompt", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const singleBlock = [{ type: "text", markdown: "Test" }];
            const jsonText = scratchpadEnvelope("reasoning", singleBlock);

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(jsonText)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);
            await callGeminiPass2("text", sanitizedSchema);

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));
            const promptText = body.systemInstruction.parts[0].text;

            expect(promptText).toContain("JSON transformation engine");
        });

        it("throws on non-OK HTTP response (503)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 503,
                    text: () => Promise.resolve("Service unavailable"),
                }),
            );

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);

            try {
                await callGeminiPass2("text", sanitizedSchema);
                expect.unreachable("Should have thrown");
            } catch (error) {
                expect(error).toBeInstanceOf(RetryableError);
            }
        });

        it("throws on non-OK HTTP response (429)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 429,
                    text: () => Promise.resolve("Rate limited"),
                }),
            );

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);

            expect(callGeminiPass2("text", sanitizedSchema)).rejects.toThrow(
                "Gemini API rate limit exceeded",
            );
        });

        it("throws on non-OK HTTP response (500)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    text: () => Promise.resolve("Server Error"),
                }),
            );

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);

            expect(callGeminiPass2("text", sanitizedSchema)).rejects.toThrow(
                "Gemini API error: 500",
            );
        });

        it("throws on malformed JSON in response text", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() => Promise.resolve(geminiResponse("not valid json {")));

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);

            expect(callGeminiPass2("text", sanitizedSchema)).rejects.toThrow();
        });

        it("throws on schema validation failure (missing blocks)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve(
                    geminiResponse(JSON.stringify({ internal_reasoning_scratchpad: "thinking" })),
                ),
            );

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);

            expect(callGeminiPass2("text", sanitizedSchema)).rejects.toThrow();
        });

        it("throws on schema validation failure (missing scratchpad)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve(
                    geminiResponse(JSON.stringify({ blocks: [{ type: "text", markdown: "Hi" }] })),
                ),
            );

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);

            expect(callGeminiPass2("text", sanitizedSchema)).rejects.toThrow();
        });

        it("throws when API key is missing", async () => {
            delete process.env.GOOGLE_AI_API_KEY;

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);

            expect(callGeminiPass2("text", sanitizedSchema)).rejects.toThrow(
                "GOOGLE_AI_API_KEY environment variable is not set",
            );
        });

        it("returns empty blocks array if Gemini returns valid scratchpad with empty blocks", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const emptyBlocks = [];
            const jsonText = scratchpadEnvelope("No blocks needed", emptyBlocks);

            mockFetch(() => Promise.resolve(geminiResponse(jsonText)));

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);
            const result = await callGeminiPass2("text", sanitizedSchema);

            expect(result.blocks).toEqual([]);
        });

        it("returns usage metadata from Gemini response", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const usageMeta = {
                promptTokenCount: 200,
                candidatesTokenCount: 100,
                totalTokenCount: 300,
            };
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const singleBlock = [{ type: "text", markdown: "Test" }];
            const jsonText = scratchpadEnvelope("reasoning", singleBlock);

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(jsonText, usageMeta)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const sanitizedSchema = stripAdditionalProperties(rawSchema);
            const result = await callGeminiPass2("text", sanitizedSchema);

            expect(result.usage).toEqual({
                promptTokenCount: 200,
                candidatesTokenCount: 100,
                totalTokenCount: 300,
            });
        });
    });

    describe("callGeminiJson — dual-pass pipeline", () => {
        it("makes two fetch calls (one per pass)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const pass1Text = "Here is a **goblin** warrior.";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [{ type: "text", markdown: "Here is a **goblin** warrior." }];
            const pass2Json = scratchpadEnvelope("Extracting blocks", blocks);

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(dualPassMock(pass1Text, pass2Json));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson(
                [{ role: "user", parts: [{ text: "Tell me about goblins" }] }],
                "",
                "gm",
            );

            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("first call has no JSON mode; second call has JSON mode", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const pass1Text = "Some markdown";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const singleBlock = [{ type: "text", markdown: "Test" }];
            const pass2Json = scratchpadEnvelope("reasoning", singleBlock);

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(dualPassMock(pass1Text, pass2Json));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "gm");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );

            const pass1Body = JSON.parse(/** @type {string} */ (calls[0][1].body));
            expect(pass1Body.generationConfig.responseMimeType).toBeUndefined();
            expect(pass1Body.generationConfig.responseSchema).toBeUndefined();

            const pass2Body = JSON.parse(/** @type {string} */ (calls[1][1].body));
            expect(pass2Body.generationConfig.responseMimeType).toBe("application/json");
            expect(pass2Body.generationConfig.responseSchema).toBeDefined();
        });

        it("returns combined blocks from Pass 2", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [
                { type: "text", markdown: "Hello Pathfinder!" },
                { type: "callout", title: "Key Rule", markdown: "**critical hit**" },
            ];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(
                dualPassMock("Markdown text", scratchpadEnvelope("reasoning", blocks)),
            );
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "Tell me about crits" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual(blocks);
        });

        it("aggregates usage metadata across both passes", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [{ type: "text", markdown: "Test" }];
            const pass1Usage = {
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
            };
            const pass2Usage = {
                promptTokenCount: 200,
                candidatesTokenCount: 30,
                totalTokenCount: 230,
            };

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(
                dualPassMock(
                    "Markdown",
                    scratchpadEnvelope("reasoning", blocks),
                    pass1Usage,
                    pass2Usage,
                ),
            );
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.usage).toEqual({
                promptTokenCount: 300,
                candidatesTokenCount: 80,
                totalTokenCount: 380,
            });
        });

        it("Pass 1 error (non-retryable) propagates up", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    text: () => Promise.resolve("Internal Server Error"),
                }),
            );

            expect(
                callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player"),
            ).rejects.toThrow("Gemini API error: 500 Internal Server Error");
        });

        it("Pass 1 RetryableError propagates up (triggers retry loop)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 503,
                    text: () => Promise.resolve("Service unavailable"),
                }),
            );

            try {
                await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player");
                expect.unreachable("Should have thrown");
            } catch (error) {
                expect(error).toBeInstanceOf(RetryableError);
            }
        });

        it("Pass 2 HTTP error (503) falls back to Pass 1 text as text block, does NOT throw RetryableError", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const pass1Text = "Here is a goblin warrior.";

            let callIndex = 0;
            mockFetch(() => {
                callIndex++;
                if (callIndex === 1) {
                    return Promise.resolve(geminiTextResponse(pass1Text));
                }
                return Promise.resolve({
                    ok: false,
                    status: 503,
                    text: () => Promise.resolve("Service unavailable"),
                });
            });

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual([{ type: "text", markdown: pass1Text }]);
        });

        it("Pass 2 HTTP error (429) falls back to Pass 1 text as text block, does NOT throw", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const pass1Text = "Some creative output.";

            let callIndex = 0;
            mockFetch(() => {
                callIndex++;
                if (callIndex === 1) {
                    return Promise.resolve(geminiTextResponse(pass1Text));
                }
                return Promise.resolve({
                    ok: false,
                    status: 429,
                    text: () => Promise.resolve("Rate limited"),
                });
            });

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual([{ type: "text", markdown: pass1Text }]);
        });

        it("Pass 2 JSON parse error falls back to Pass 1 text as text block", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const pass1Text = "Creative markdown content.";

            let callIndex = 0;
            mockFetch(() => {
                callIndex++;
                if (callIndex === 1) {
                    return Promise.resolve(geminiTextResponse(pass1Text));
                }
                return Promise.resolve(geminiResponse("not valid json {"));
            });

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual([{ type: "text", markdown: pass1Text }]);
        });

        it("Pass 2 Zod validation error falls back to Pass 1 text as text block", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const pass1Text = "Some content from Pass 1.";

            let callIndex = 0;
            mockFetch(() => {
                callIndex++;
                if (callIndex === 1) {
                    return Promise.resolve(geminiTextResponse(pass1Text));
                }
                return Promise.resolve(
                    geminiResponse(JSON.stringify({ blocks: [{ type: "unknown" }] })),
                );
            });

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual([{ type: "text", markdown: pass1Text }]);
        });

        it("Pass 2 returns empty blocks array falls back to Pass 1 text as text block", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const pass1Text = "Great markdown content.";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const emptyBlocks = [];
            const pass2Json = scratchpadEnvelope("reasoning", emptyBlocks);

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(dualPassMock(pass1Text, pass2Json));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual([{ type: "text", markdown: pass1Text }]);
        });

        it("Pass 1 succeeds, Pass 2 succeeds — returns Pass 2 blocks with aggregated usage", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const pass1Text = "Markdown content";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [
                { type: "text", markdown: "Extracted text" },
                { type: "callout", title: "Rule", markdown: "Info" },
            ];
            const pass2Json = scratchpadEnvelope("reasoning", blocks);
            const pass1Usage = {
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
            };
            const pass2Usage = {
                promptTokenCount: 80,
                candidatesTokenCount: 40,
                totalTokenCount: 120,
            };

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(dualPassMock(pass1Text, pass2Json, pass1Usage, pass2Usage));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual(blocks);
            expect(result.usage).toEqual({
                promptTokenCount: 180,
                candidatesTokenCount: 90,
                totalTokenCount: 270,
            });
        });

        it("fallback response includes Pass 1 usage metadata (not undefined)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const pass1Text = "Content";
            const pass1Usage = {
                promptTokenCount: 50,
                candidatesTokenCount: 25,
                totalTokenCount: 75,
            };

            let callIndex = 0;
            mockFetch(() => {
                callIndex++;
                if (callIndex === 1) {
                    return Promise.resolve(geminiTextResponse(pass1Text, pass1Usage));
                }
                return Promise.resolve(geminiResponse("bad json"));
            });

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual([{ type: "text", markdown: pass1Text }]);
            expect(result.usage).toEqual({
                promptTokenCount: 50,
                candidatesTokenCount: 25,
                totalTokenCount: 75,
            });
        });

        it("returns usage from available pass when only one has metadata", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [{ type: "text", markdown: "Test" }];
            const pass1Usage = {
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
            };

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(
                dualPassMock("text", scratchpadEnvelope("reasoning", blocks), pass1Usage),
            );
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual(blocks);
            expect(result.usage).toEqual({
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
            });
        });

        it("throws when API key is missing", async () => {
            delete process.env.GOOGLE_AI_API_KEY;

            expect(
                callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player"),
            ).rejects.toThrow("GOOGLE_AI_API_KEY environment variable is not set");
        });

        it("sends mode-aware prompt in Pass 1", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const singleBlock = [{ type: "text", markdown: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(dualPassMock("text", scratchpadEnvelope("r", singleBlock)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player");
            const playerCalls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const playerBody = JSON.parse(/** @type {string} */ (playerCalls[0][1].body));
            const playerPrompt = playerBody.systemInstruction.parts[0].text;

            expect(playerPrompt).toContain("advising a player");
        });

        it("passes ungrounded flag to Pass 1 system prompt", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const singleBlock = [{ type: "text", markdown: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(dualPassMock("text", scratchpadEnvelope("r", singleBlock)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player", true);

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));
            const promptText = body.systemInstruction.parts[0].text;

            expect(promptText).toContain("No Reference Data Available");
        });
    });

    describe("buildGeminiResponseSchema — withScratchpad", () => {
        it("default (no options) returns array schema (backward compat)", () => {
            const schema = buildGeminiResponseSchema();
            expect(schema.type).toBe("array");
        });

        it("{ withScratchpad: true } returns object with internal_reasoning_scratchpad and blocks", () => {
            const schema = buildGeminiResponseSchema({ withScratchpad: true });
            expect(schema.type).toBe("object");
            const props = /** @type {Record<string, unknown>} */ (schema.properties);
            expect(props.internal_reasoning_scratchpad).toBeDefined();
            expect(props.blocks).toBeDefined();
        });

        it("scratchpad schema has type string and is in required array", () => {
            const schema = buildGeminiResponseSchema({ withScratchpad: true });
            const props = /** @type {Record<string, unknown>} */ (schema.properties);
            const scratchpad = /** @type {Record<string, unknown>} */ (
                props.internal_reasoning_scratchpad
            );
            expect(scratchpad.type).toBe("string");
            const required = /** @type {string[]} */ (schema.required);
            expect(required).toContain("internal_reasoning_scratchpad");
        });

        it("blocks schema is identical to the non-scratchpad version", () => {
            const arraySchema = buildGeminiResponseSchema();
            const objectSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const props = /** @type {Record<string, unknown>} */ (objectSchema.properties);
            const blocks = /** @type {Record<string, unknown>} */ (props.blocks);
            expect(blocks).toEqual(arraySchema);
        });

        it("sanitized scratchpad schema has no additionalProperties", () => {
            const rawSchema = buildGeminiResponseSchema({ withScratchpad: true });
            const schema = stripAdditionalProperties(rawSchema);

            /** @param {unknown} node */
            function hasAdditionalProperties(node) {
                if (node === null || node === undefined || typeof node !== "object") {
                    return false;
                }
                if (Array.isArray(node)) {
                    return node.some(hasAdditionalProperties);
                }
                const obj = /** @type {Record<string, unknown>} */ (node);
                for (const key of Object.keys(obj)) {
                    if (key === "additionalProperties") {
                        return true;
                    }
                    if (hasAdditionalProperties(obj[key])) {
                        return true;
                    }
                }
                return false;
            }

            expect(hasAdditionalProperties(schema)).toBe(false);
        });

        it("required array includes both internal_reasoning_scratchpad and blocks", () => {
            const schema = buildGeminiResponseSchema({ withScratchpad: true });
            const required = /** @type {string[]} */ (schema.required);
            expect(required).toEqual(["internal_reasoning_scratchpad", "blocks"]);
        });
    });

    describe("buildCreativeSystemPrompt", () => {
        it("includes step-by-step reasoning instruction", () => {
            const prompt = buildCreativeSystemPrompt("", "gm");
            expect(prompt).toContain("step-by-step");
            expect(prompt).toContain("Pathfinder");
        });

        it("includes rich game component syntax guidance", () => {
            const prompt = buildCreativeSystemPrompt("", "gm");
            expect(prompt).toContain("::dice{");
            expect(prompt).toContain("::dc{");
            expect(prompt).toContain("::condition{");
            expect(prompt).toContain("::trait{");
            expect(prompt).toContain("::action{");
        });

        it("includes RAG context when provided", () => {
            const prompt = buildCreativeSystemPrompt("Mitflit King is a CR 1 creature", "gm");
            expect(prompt).toContain("Mitflit King");
        });

        it("omits RAG section when context is empty", () => {
            const prompt = buildCreativeSystemPrompt("", "gm");
            expect(prompt).not.toContain("Reference Data\n\n");
        });

        it("includes player restrictions when mode is player", () => {
            const prompt = buildCreativeSystemPrompt("", "player");
            expect(prompt).toContain("Player Mode Restrictions");
            expect(prompt).toContain("NEVER reveal creature mechanics");
        });

        it("omits player restrictions when mode is gm", () => {
            const prompt = buildCreativeSystemPrompt("", "gm");
            expect(prompt).not.toContain("Player Mode Restrictions");
        });

        it("includes ungrounded warning when ungrounded=true", () => {
            const prompt = buildCreativeSystemPrompt("", "gm", true);
            expect(prompt).toContain("No Reference Data Available");
        });

        it("does NOT mention JSON output format", () => {
            const prompt = buildCreativeSystemPrompt("", "gm");
            expect(prompt).not.toContain("JSON array");
            expect(prompt).not.toContain("responseMimeType");
        });
    });

    describe("buildExtractionSystemPrompt", () => {
        it("instructs JSON output with scratchpad + blocks structure", () => {
            const prompt = buildExtractionSystemPrompt();
            expect(prompt).toContain("internal_reasoning_scratchpad");
            expect(prompt).toContain("blocks");
        });

        it("includes block type descriptions", () => {
            const prompt = buildExtractionSystemPrompt();
            expect(prompt).toContain("text");
            expect(prompt).toContain("callout");
            expect(prompt).toContain("stat-block");
            expect(prompt).toContain("custom-stat-block");
            expect(prompt).toContain("rule-detail");
        });

        it("does NOT include RAG context (not relevant for parsing)", () => {
            const prompt = buildExtractionSystemPrompt();
            expect(prompt).not.toContain("Reference Data");
        });

        it("mentions strict parsing role", () => {
            const prompt = buildExtractionSystemPrompt();
            expect(prompt).toContain("JSON transformation engine");
        });

        it("instructs to preserve rich game component patterns", () => {
            const prompt = buildExtractionSystemPrompt();
            expect(prompt).toContain("::dice{");
            expect(prompt).toContain("::dc{");
            expect(prompt).toContain("::condition{");
            expect(prompt).toContain("::trait{");
            expect(prompt).toContain("::action{");
        });
    });

    describe("getLlmResponse", () => {
        it("throws on non-retryable error when ENABLE_MOCK_FALLBACK is unset", async () => {
            delete process.env.GOOGLE_AI_API_KEY;
            delete process.env.ENABLE_MOCK_FALLBACK;

            try {
                await getLlmResponse([{ role: "user", parts: [{ text: "test" }] }], "", "player");
                expect.unreachable("Should have thrown");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect(/** @type {Error} */ (error).message).toContain(
                    "The AI service encountered an error",
                );
            }
        });

        it("propagates RetryableError instead of falling back to mock", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            delete process.env.ENABLE_MOCK_FALLBACK;
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 503,
                    text: () => Promise.resolve("Overloaded"),
                }),
            );

            try {
                await getLlmResponse([{ role: "user", parts: [{ text: "test" }] }], "", "player");
                expect.unreachable("Should have thrown");
            } catch (error) {
                expect(error).toBeInstanceOf(RetryableError);
            }
        });

        it("returns real response on success", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [
                { type: "text", markdown: "Real response" },
                { type: "callout", title: "Note", markdown: "Important" },
            ];
            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(dualPassMock("Markdown", scratchpadEnvelope("r", blocks)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await getLlmResponse(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual(blocks);
            expect(result.usage).toBeUndefined();
        });

        it("returns mock when ENABLE_MOCK_FALLBACK=true on non-retryable error", async () => {
            delete process.env.GOOGLE_AI_API_KEY;
            process.env.ENABLE_MOCK_FALLBACK = "true";

            try {
                const result = await getLlmResponse(
                    [{ role: "user", parts: [{ text: "test" }] }],
                    "",
                    "player",
                );

                expect(result.blocks).toBeDefined();
                expect(Array.isArray(result.blocks)).toBe(true);
                expect(result.blocks.length).toBeGreaterThan(0);
                expect(result.usage).toBeUndefined();
            } finally {
                delete process.env.ENABLE_MOCK_FALLBACK;
            }
        });
    });

    describe("stripAdditionalProperties", () => {
        it("removes top-level additionalProperties", () => {
            const schema = { type: "object", additionalProperties: { type: "string" } };
            const result = stripAdditionalProperties(schema);
            expect(result).toEqual({ type: "object" });
        });

        it("removes nested additionalProperties at depth 3+", () => {
            const schema = {
                type: "object",
                properties: {
                    data: {
                        type: "object",
                        properties: {
                            skills: {
                                type: "object",
                                additionalProperties: {
                                    type: "object",
                                    properties: { value: { type: "number" } },
                                },
                            },
                        },
                    },
                },
            };
            const result = stripAdditionalProperties(schema);
            /** @param {Record<string, unknown>} obj */
            function walk(obj) {
                for (const [key, value] of Object.entries(obj)) {
                    expect(key).not.toBe("additionalProperties");
                    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                        walk(/** @type {Record<string, unknown>} */ (value));
                    }
                }
            }
            walk(result);
            const props = /** @type {Record<string, unknown>} */ (result.properties);
            const data = /** @type {Record<string, unknown>} */ (props.data);
            const dataProps = /** @type {Record<string, unknown>} */ (data.properties);
            expect(dataProps.skills).toBeDefined();
        });

        it("removes additionalProperties from array items", () => {
            const schema = {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: { type: "string" },
                    properties: { name: { type: "string" } },
                },
            };
            const result = stripAdditionalProperties(schema);
            const items = /** @type {Record<string, unknown>} */ (result.items);
            expect(items.additionalProperties).toBeUndefined();
            expect(items.properties).toBeDefined();
        });

        it("preserves all other keys", () => {
            const schema = {
                type: "object",
                properties: { name: { type: "string" } },
                required: ["name"],
                enum: ["a", "b"],
                items: { type: "string" },
                anyOf: [{ type: "string" }, { type: "number" }],
            };
            const result = stripAdditionalProperties(schema);
            expect(result.type).toBe("object");
            expect(result.properties).toBeDefined();
            expect(result.required).toEqual(["name"]);
            expect(result.enum).toEqual(["a", "b"]);
            expect(result.items).toBeDefined();
            expect(result.anyOf).toHaveLength(2);
        });

        it("handles empty objects", () => {
            expect(stripAdditionalProperties({})).toEqual({});
        });
    });

    describe("buildGeminiResponseSchema — sanitization", () => {
        it("sanitized schema has zero additionalProperties anywhere", () => {
            const rawSchema = buildGeminiResponseSchema();
            const schema = stripAdditionalProperties(rawSchema);

            /** @param {unknown} node */
            function hasAdditionalProperties(node) {
                if (node === null || node === undefined) {
                    return false;
                }
                if (typeof node !== "object") {
                    return false;
                }
                if (Array.isArray(node)) {
                    return node.some(hasAdditionalProperties);
                }
                const obj = /** @type {Record<string, unknown>} */ (node);
                for (const key of Object.keys(obj)) {
                    if (key === "additionalProperties") {
                        return true;
                    }
                    if (hasAdditionalProperties(obj[key])) {
                        return true;
                    }
                }
                return false;
            }

            expect(hasAdditionalProperties(schema)).toBe(false);
        });

        it("sanitized schema structure is otherwise intact", () => {
            const rawSchema = buildGeminiResponseSchema();
            const schema = stripAdditionalProperties(rawSchema);
            const items = /** @type {{ anyOf: unknown[] }} */ (
                /** @type {unknown} */ (schema.items)
            );

            expect(schema.type).toBe("array");
            expect(items.anyOf).toHaveLength(5);
            const customBlock = /** @type {Record<string, unknown>} */ (items.anyOf[2]);
            const props = /** @type {Record<string, unknown>} */ (customBlock.properties);
            const data = /** @type {Record<string, unknown>} */ (props.data);
            expect(data.required).toEqual(["name", "level"]);
        });
    });

    describe("callGeminiJson — sanitization", () => {
        it("request body contains no additionalProperties in responseSchema", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const singleBlock = [{ type: "text", markdown: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(dualPassMock("text", scratchpadEnvelope("r", singleBlock)));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const pass2Body = JSON.parse(/** @type {string} */ (calls[1][1].body));

            /** @param {unknown} node */
            function hasAdditionalProperties(node) {
                if (node === null || node === undefined) {
                    return false;
                }
                if (typeof node !== "object") {
                    return false;
                }
                if (Array.isArray(node)) {
                    return node.some(hasAdditionalProperties);
                }
                const obj = /** @type {Record<string, unknown>} */ (node);
                for (const key of Object.keys(obj)) {
                    if (key === "additionalProperties") {
                        return true;
                    }
                    if (hasAdditionalProperties(obj[key])) {
                        return true;
                    }
                }
                return false;
            }

            expect(hasAdditionalProperties(pass2Body.generationConfig.responseSchema)).toBe(false);
        });
    });

    describe("buildSystemPrompt", () => {
        it("includes block type descriptions and Pathfinder", () => {
            const prompt = buildSystemPrompt("", "player");

            expect(prompt).toContain("text");
            expect(prompt).toContain("callout");
            expect(prompt).toContain("stat-block");
            expect(prompt).toContain("custom-stat-block");
            expect(prompt).toContain("rule-detail");
            expect(prompt).toContain("Pathfinder");
        });

        it("includes RAG context when provided", async () => {
            const prompt = buildSystemPrompt("Mitflit King is a CR 1 creature", "gm");

            expect(prompt).toContain("Mitflit King");
        });

        it("omits reference section when context is empty", () => {
            const prompt = buildSystemPrompt("", "player");

            expect(prompt).not.toContain("retrieved-context");
        });

        it("includes ungrounded warning when ungrounded=true", () => {
            const prompt = buildSystemPrompt("", "player", true);

            expect(prompt).toContain("No Reference Data Available");
            expect(prompt).toContain("general knowledge");
            expect(prompt).toContain("NEVER emit stat-block or rule-detail blocks");
            expect(prompt).toContain("custom-stat-block");
        });

        it("omits ungrounded warning when ungrounded=false", () => {
            const prompt = buildSystemPrompt("", "player", false);

            expect(prompt).not.toContain("No Reference Data Available");
        });

        it("omits ungrounded warning by default", () => {
            const prompt = buildSystemPrompt("", "player");

            expect(prompt).not.toContain("No Reference Data Available");
        });

        it("includes player restrictions when mode is player", () => {
            const prompt = buildSystemPrompt("", "player");

            expect(prompt).toContain("Player Mode Restrictions");
            expect(prompt).toContain("NEVER reveal creature mechanics");
            expect(prompt).toContain("Ask your GM");
        });

        it("includes custom-stat-block block type description", () => {
            const prompt = buildSystemPrompt("", "gm");

            expect(prompt).toContain("custom-stat-block");
            expect(prompt).toContain("invented creatures");
            expect(prompt).toContain('"name" and "level"');
        });

        it("includes guideline about inventing creatures", () => {
            const prompt = buildSystemPrompt("", "gm");

            expect(prompt).toContain("create or invent a creature/NPC");
            expect(prompt).toContain("custom-stat-block");
        });

        it("ungrounded prompt still forbids stat-block and rule-detail but allows custom-stat-block", () => {
            const prompt = buildSystemPrompt("", "gm", true);

            expect(prompt).toContain("NEVER emit stat-block or rule-detail blocks");
            expect(prompt).toContain("You MAY emit custom-stat-block");
        });

        it("omits player restrictions when mode is gm", () => {
            const prompt = buildSystemPrompt("", "gm");

            expect(prompt).not.toContain("Player Mode Restrictions");
            expect(prompt).not.toContain("NEVER reveal creature mechanics");
        });
    });

    describe("callGeminiForSummarization", () => {
        it("returns summary text on success", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() => Promise.resolve(geminiResponse("Summary of the conversation.")));

            const result = await callGeminiForSummarization("Some messages text");

            expect(result).toBe("Summary of the conversation.");
        });

        it("sends summarization prompt in request", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse("Summary")));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiForSummarization("messages");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));

            expect(body.systemInstruction).toBeDefined();
            expect(body.systemInstruction.parts[0].text).toContain("Pathfinder");
            expect(body.contents[0].parts[0].text).toContain("messages");
            expect(body.generationConfig).toBeUndefined();
        });

        it("throws on API error", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    text: () => Promise.resolve("Server Error"),
                }),
            );

            expect(callGeminiForSummarization("text")).rejects.toThrow(
                "Gemini summarization API error",
            );
        });

        it("throws when API key is missing", async () => {
            delete process.env.GOOGLE_AI_API_KEY;

            expect(callGeminiForSummarization("text")).rejects.toThrow(
                "GOOGLE_AI_API_KEY environment variable is not set",
            );
        });
    });

    describe("buildGeminiResponseSchema", () => {
        it("has correct top-level structure", () => {
            const schema = buildGeminiResponseSchema();
            const items = /** @type {{ anyOf: unknown[] }} */ (
                /** @type {unknown} */ (schema.items)
            );

            expect(schema.type).toBe("array");
            expect(schema.items).toBeDefined();
            expect(items.anyOf).toHaveLength(5);
        });

        it("uses enum for type discriminators (not const)", () => {
            const schema = buildGeminiResponseSchema();
            const items = /** @type {{ anyOf: Record<string, unknown>[] }} */ (
                /** @type {unknown} */ (schema.items)
            );

            const typeEnums = items.anyOf.map(
                /** @param {Record<string, unknown>} block */ (block) => {
                    const props = /** @type {Record<string, unknown>} */ (block.properties);
                    const typeField = /** @type {Record<string, unknown>} */ (props.type);
                    return typeField.enum;
                },
            );

            expect(typeEnums).toEqual([
                ["text"],
                ["callout"],
                ["custom-stat-block"],
                ["stat-block"],
                ["rule-detail"],
            ]);
        });

        it("includes required fields for each block type", () => {
            const schema = buildGeminiResponseSchema();
            const items = /** @type {{ anyOf: Record<string, unknown>[] }} */ (
                /** @type {unknown} */ (schema.items)
            );
            const [text, callout, customStatBlock, statBlock, ruleDetail] = items.anyOf;

            expect(text.required).toEqual(["type", "markdown"]);
            expect(callout.required).toEqual(["type", "title", "markdown"]);
            expect(statBlock.required).toEqual(["type", "ruleItemId"]);
            expect(customStatBlock.required).toEqual(["type", "title", "data"]);
            expect(ruleDetail.required).toEqual(["type", "ruleItemId"]);
        });

        it("custom-stat-block has inline data with required name and level", () => {
            const schema = buildGeminiResponseSchema();
            const items = /** @type {{ anyOf: Record<string, unknown>[] }} */ (
                /** @type {unknown} */ (schema.items)
            );
            const customStatBlock = items.anyOf[2];
            const props = /** @type {Record<string, unknown>} */ (customStatBlock.properties);

            expect(props.data).toBeDefined();
            const dataProps = /** @type {Record<string, unknown>} */ (props.data);
            expect(dataProps.required).toEqual(["name", "level"]);
        });

        it("stat-block uses ruleItemId instead of nested creature data", () => {
            const schema = buildGeminiResponseSchema();
            const items = /** @type {{ anyOf: Record<string, unknown>[] }} */ (
                /** @type {unknown} */ (schema.items)
            );
            const statBlock = items.anyOf[3];
            const props = /** @type {Record<string, unknown>} */ (statBlock.properties);

            expect(props.ruleItemId).toBeDefined();
            expect(props.data).toBeUndefined();
        });
    });
});
