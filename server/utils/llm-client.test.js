import { afterEach, describe, expect, it, mock } from "bun:test";

import { GEMINI_API_BASE, GEMINI_MODEL } from "../../shared/constants.js";
import {
    RetryableError,
    buildGeminiResponseSchema,
    buildSystemPrompt,
    callGeminiForSummarization,
    callGeminiJson,
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

describe("llm-client", () => {
    afterEach(() => {
        mock.restore();
        delete process.env.GOOGLE_AI_API_KEY;
    });

    describe("callGeminiJson", () => {
        it("returns parsed and validated blocks on happy path", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [
                { type: "text", markdown: "Hello Pathfinder!" },
                {
                    type: "callout",
                    title: "Key Rule",
                    markdown: "**critical hit**",
                },
            ];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "Tell me about crits" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual(blocks);
            expect(result.usage).toBeUndefined();
            expect(fetchMock).toHaveBeenCalled();
        });

        it("sends correct API URL, headers, and request body structure", async () => {
            process.env.GOOGLE_AI_API_KEY = "my-secret-key";
            const blocks = [{ type: "text", markdown: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson(
                [{ role: "user", parts: [{ text: "test message" }] }],
                "some context",
                "gm",
            );

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );

            expect(calls[0][0]).toBe(
                `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=my-secret-key`,
            );

            const opts = calls[0][1];
            expect(opts.method).toBe("POST");
            expect(opts.headers).toEqual({
                "Content-Type": "application/json",
            });

            const body = JSON.parse(/** @type {string} */ (opts.body));
            expect(body.contents).toHaveLength(1);
            expect(body.contents[0].role).toBe("user");
            expect(body.contents[0].parts[0].text).toBe("test message");
            expect(body.generationConfig.responseMimeType).toBe("application/json");
            expect(body.generationConfig.responseSchema).toBeDefined();
            expect(body.generationConfig.responseSchema.type).toBe("array");
        });

        it("includes repetition-prevention parameters in generationConfig", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const blocks = [{ type: "text", markdown: "Test" }];

            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player");

            const body = JSON.parse(
                /** @type {string} */ (
                    /** @type {[string, RequestInit][]} */ (
                        /** @type {unknown} */ (fetchMock.mock.calls)
                    )[0][1].body
                ),
            );
            expect(body.generationConfig.temperature).toBe(0.7);
            expect(body.generationConfig.topP).toBe(0.9);
            expect(body.generationConfig.maxOutputTokens).toBe(8192);
        });

        it("throws descriptive error on non-OK HTTP response", async () => {
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

        it("throws with rate limit message on 429", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 429,
                    text: () => Promise.resolve("Rate limit exceeded"),
                }),
            );

            expect(
                callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player"),
            ).rejects.toThrow("Gemini API rate limit exceeded");
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
                await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player");
                expect.unreachable("Should have thrown");
            } catch (error) {
                expect(error).toBeInstanceOf(RetryableError);
                expect(/** @type {Error} */ (error).message).toContain(
                    "Service temporarily unavailable",
                );
            }
        });

        it("falls back to text block on malformed JSON in response", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() => Promise.resolve(geminiResponse("not valid json {")));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result).toEqual({
                blocks: [{ type: "text", markdown: "not valid json {" }],
                usage: undefined,
            });
        });

        it("falls back to text block on Zod validation failure", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const invalidBlocks = [{ type: "unknown-type", foo: "bar" }];
            mockFetch(() => Promise.resolve(geminiResponse(JSON.stringify(invalidBlocks))));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result).toEqual({
                blocks: [
                    {
                        type: "text",
                        markdown:
                            "The AI produced a response that couldn't be displayed properly. Please try rephrasing your question or starting a new conversation.",
                    },
                ],
                usage: undefined,
            });
        });

        it("throws when API key is missing", async () => {
            delete process.env.GOOGLE_AI_API_KEY;

            expect(
                callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player"),
            ).rejects.toThrow("GOOGLE_AI_API_KEY environment variable is not set");
        });

        it("sends system instruction in request body", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const blocks = [{ type: "text", markdown: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));

            expect(body.systemInstruction).toBeDefined();
            expect(body.systemInstruction.parts[0].text).toContain("Pathfinder");
        });

        it("passes ungrounded flag to system prompt", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const blocks = [{ type: "text", markdown: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player", true);

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));
            const promptText = body.systemInstruction.parts[0].text;

            expect(promptText).toContain("No Reference Data Available");
        });

        it("sends mode-aware prompt (player vs gm)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const blocks = [{ type: "text", markdown: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player");
            const playerCalls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const playerBody = JSON.parse(/** @type {string} */ (playerCalls[0][1].body));
            const playerPrompt = playerBody.systemInstruction.parts[0].text;

            mock.restore();
            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock2 = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock2));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "gm");
            const gmCalls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock2.mock.calls)
            );
            const gmBody = JSON.parse(/** @type {string} */ (gmCalls[0][1].body));
            const gmPrompt = gmBody.systemInstruction.parts[0].text;

            expect(playerPrompt).toContain("advising a player");
            expect(gmPrompt).toContain("advising a Game Master");
            expect(playerPrompt).not.toBe(gmPrompt);
        });

        it("falls back to text block on empty array from Gemini", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() => Promise.resolve(geminiResponse("[]")));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result).toEqual({
                blocks: [
                    {
                        type: "text",
                        markdown: "I couldn't generate a response. Please try again.",
                    },
                ],
                usage: undefined,
            });
        });

        it("returns usage metadata from Gemini response", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [{ type: "text", markdown: "Test" }];
            const usageMeta = {
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
            };

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() =>
                Promise.resolve(geminiResponse(JSON.stringify(blocks), usageMeta)),
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

        it("returns usage undefined when usageMetadata missing from response", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [{ type: "text", markdown: "Test" }];

            mockFetch(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));

            const result = await callGeminiJson(
                [{ role: "user", parts: [{ text: "test" }] }],
                "",
                "player",
            );

            expect(result.blocks).toEqual(blocks);
            expect(result.usage).toBeUndefined();
        });
    });

    describe("getLlmResponse", () => {
        it("throws on non-retryable error when ENABLE_MOCK_FALLBACK is unset", async () => {
            // No API key → callGeminiJson throws immediately → getLlmResponse should throw
            delete process.env.GOOGLE_AI_API_KEY;
            // Ensure env var is not set
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
            mockFetch(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));

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
            // Walk result to ensure no additionalProperties anywhere
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
            // Verify structure preserved (skills still exists)
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
            // Check required fields survived
            const customBlock = /** @type {Record<string, unknown>} */ (items.anyOf[2]);
            const props = /** @type {Record<string, unknown>} */ (customBlock.properties);
            const data = /** @type {Record<string, unknown>} */ (props.data);
            expect(data.required).toEqual(["name", "level"]);
        });
    });

    describe("callGeminiJson — sanitization", () => {
        it("request body contains no additionalProperties in responseSchema", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const blocks = [{ type: "text", markdown: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));

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

            expect(hasAdditionalProperties(body.generationConfig.responseSchema)).toBe(false);
        });
    });

    describe("callGeminiJson — 400 error handling", () => {
        it("400 error from Gemini throws descriptive error", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 400,
                    text: () => Promise.resolve("Invalid JSON payload received"),
                }),
            );

            expect(
                callGeminiJson([{ role: "user", parts: [{ text: "test" }] }], "", "player"),
            ).rejects.toThrow("Gemini API error: 400 Invalid JSON payload received");
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
            // title is intentionally NOT required — Gemini sometimes omits it when
            // anyOf schemas share ruleItemId; resolveStatBlock falls back to the DB name.
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
