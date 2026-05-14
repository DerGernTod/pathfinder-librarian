import { afterEach, describe, expect, it, mock } from "bun:test";

import { GEMINI_API_BASE, GEMINI_MODEL } from "../../shared/constants.js";
import {
    buildGeminiResponseSchema,
    buildSystemPrompt,
    callGeminiJson,
    getLlmResponse,
} from "./llm-client.js";

/**
 * @param {() => Promise<unknown>} fn
 */
function mockFetch(fn) {
    globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (mock(fn)));
}

/** Helper to build a valid Gemini API response wrapping the given JSON text */
/** @param {string} jsonText */
function geminiResponse(jsonText) {
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
                { type: "paragraph", text: "Hello Pathfinder!" },
                {
                    type: "callout",
                    title: "Key Rule",
                    segments: [{ text: "critical hit", highlight: true }],
                },
            ];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await callGeminiJson("Tell me about crits", "", "player");

            expect(result).toEqual(blocks);
            expect(fetchMock).toHaveBeenCalled();
        });

        it("sends correct API URL, headers, and request body structure", async () => {
            process.env.GOOGLE_AI_API_KEY = "my-secret-key";
            const blocks = [{ type: "paragraph", text: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson("test message", "some context", "gm");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );

            expect(calls[0][0]).toBe(
                `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=my-secret-key`,
            );

            const opts = calls[0][1];
            expect(opts.method).toBe("POST");
            expect(opts.headers).toEqual({ "Content-Type": "application/json" });

            const body = JSON.parse(/** @type {string} */ (opts.body));
            expect(body.contents).toHaveLength(1);
            expect(body.contents[0].role).toBe("user");
            expect(body.contents[0].parts[0].text).toBe("test message");
            expect(body.generationConfig.responseMimeType).toBe("application/json");
            expect(body.generationConfig.responseSchema).toBeDefined();
            expect(body.generationConfig.responseSchema.type).toBe("array");
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

            expect(callGeminiJson("test", "", "player")).rejects.toThrow(
                "Gemini API error: 500 Internal Server Error",
            );
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

            expect(callGeminiJson("test", "", "player")).rejects.toThrow(
                "Gemini API rate limit exceeded",
            );
        });

        it("falls back to paragraph block on malformed JSON in response", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() => Promise.resolve(geminiResponse("not valid json {")));

            const result = await callGeminiJson("test", "", "player");

            expect(result).toEqual([{ type: "paragraph", text: "not valid json {" }]);
        });

        it("falls back to paragraph block on Zod validation failure", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const invalidBlocks = [{ type: "unknown-type", foo: "bar" }];
            mockFetch(() => Promise.resolve(geminiResponse(JSON.stringify(invalidBlocks))));

            const result = await callGeminiJson("test", "", "player");

            expect(result).toEqual([{ type: "paragraph", text: JSON.stringify(invalidBlocks) }]);
        });

        it("throws when API key is missing", async () => {
            delete process.env.GOOGLE_AI_API_KEY;

            expect(callGeminiJson("test", "", "player")).rejects.toThrow(
                "GOOGLE_AI_API_KEY environment variable is not set",
            );
        });

        it("sends system instruction in request body", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const blocks = [{ type: "paragraph", text: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson("test", "", "player");

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const body = JSON.parse(/** @type {string} */ (calls[0][1].body));

            expect(body.systemInstruction).toBeDefined();
            expect(body.systemInstruction.parts[0].text).toContain("Pathfinder");
        });

        it("sends mode-aware prompt (player vs gm)", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const blocks = [{ type: "paragraph", text: "Test" }];

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await callGeminiJson("test", "", "player");
            const playerCalls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const playerBody = JSON.parse(/** @type {string} */ (playerCalls[0][1].body));
            const playerPrompt = playerBody.systemInstruction.parts[0].text;

            mock.restore();
            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock2 = mock(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock2));

            await callGeminiJson("test", "", "gm");
            const gmCalls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock2.mock.calls)
            );
            const gmBody = JSON.parse(/** @type {string} */ (gmCalls[0][1].body));
            const gmPrompt = gmBody.systemInstruction.parts[0].text;

            expect(playerPrompt).toContain("advising a player");
            expect(gmPrompt).toContain("advising a Game Master");
            expect(playerPrompt).not.toBe(gmPrompt);
        });

        it("falls back to paragraph block on empty array from Gemini", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            mockFetch(() => Promise.resolve(geminiResponse("[]")));

            const result = await callGeminiJson("test", "", "player");

            expect(result).toEqual([
                { type: "paragraph", text: "I couldn't generate a response. Please try again." },
            ]);
        });
    });

    describe("getLlmResponse", () => {
        it("falls back to mock response on error", async () => {
            const result = await getLlmResponse("test", "", "player");

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });

        it("returns real response on success", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            /** @type {import("../../shared/types.js").MessageBlock[]} */
            const blocks = [
                { type: "paragraph", text: "Real response" },
                { type: "callout", title: "Note", text: "Important" },
            ];
            mockFetch(() => Promise.resolve(geminiResponse(JSON.stringify(blocks))));

            const result = await getLlmResponse("test", "", "player");

            expect(result).toEqual(blocks);
        });
    });

    describe("buildSystemPrompt", () => {
        it("includes block type descriptions and Pathfinder", () => {
            const prompt = buildSystemPrompt("", "player");

            expect(prompt).toContain("paragraph");
            expect(prompt).toContain("callout");
            expect(prompt).toContain("list");
            expect(prompt).toContain("stat-block");
            expect(prompt).toContain("Pathfinder");
        });

        it("includes RAG context when provided", () => {
            const prompt = buildSystemPrompt("Mitflit King is a CR 1 creature", "gm");

            expect(prompt).toContain("Mitflit King");
            expect(prompt).toContain("Reference Data");
        });

        it("omits reference section when context is empty", () => {
            const prompt = buildSystemPrompt("", "player");

            expect(prompt).not.toContain("Reference Data");
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
            expect(items.anyOf).toHaveLength(4);
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

            expect(typeEnums).toEqual([["paragraph"], ["callout"], ["list"], ["stat-block"]]);
        });

        it("includes required fields for each block type", () => {
            const schema = buildGeminiResponseSchema();
            const items = /** @type {{ anyOf: Record<string, unknown>[] }} */ (
                /** @type {unknown} */ (schema.items)
            );
            const [para, callout, list, statBlock] = items.anyOf;

            expect(para.required).toEqual(["type"]);
            expect(callout.required).toEqual(["type", "title"]);
            expect(list.required).toEqual(["type", "items"]);
            expect(statBlock.required).toEqual(["type", "title", "data"]);
        });

        it("includes creature data schema in stat-block", () => {
            const schema = buildGeminiResponseSchema();
            const items = /** @type {{ anyOf: Record<string, unknown>[] }} */ (
                /** @type {unknown} */ (schema.items)
            );
            const statBlock = items.anyOf[3];
            const dataProps = /** @type {Record<string, unknown>} */ (
                /** @type {Record<string, unknown>} */ (
                    /** @type {Record<string, unknown>} */ (statBlock.properties).data
                ).properties
            );

            expect(dataProps.name).toBeDefined();
            expect(dataProps.level).toBeDefined();
            expect(dataProps.traits).toBeDefined();
            expect(dataProps.attributes).toBeDefined();
            expect(dataProps.abilities).toBeDefined();
        });
    });
});
