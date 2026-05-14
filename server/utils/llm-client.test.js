import { afterEach, describe, expect, it, mock } from "bun:test";

import { buildSystemPrompt, streamLlmResponse } from "./llm-client.js";

describe("llm-client", () => {
    const originalApiKey = process.env.GOOGLE_AI_API_KEY;
    const originalMockAi = process.env.MOCK_GOOGLE_AI;

    afterEach(() => {
        if (originalApiKey !== undefined) {
            process.env.GOOGLE_AI_API_KEY = originalApiKey;
        } else {
            delete process.env.GOOGLE_AI_API_KEY;
        }
        if (originalMockAi !== undefined) {
            process.env.MOCK_GOOGLE_AI = originalMockAi;
        } else {
            delete process.env.MOCK_GOOGLE_AI;
        }
    });

    describe("streamLlmResponse", () => {
        it("delegates to streamMockResponse when MOCK_GOOGLE_AI=1", async () => {
            process.env.MOCK_GOOGLE_AI = "1";
            process.env.GOOGLE_AI_API_KEY = "test-key";

            const blocks = [];
            for await (const block of streamLlmResponse("system prompt", "user message")) {
                blocks.push(block);
            }

            expect(blocks.length).toBeGreaterThan(0);
            // Verify blocks are valid MessageBlock types
            for (const block of blocks) {
                expect(["paragraph", "callout", "list", "stat-block"]).toContain(block.type);
            }
        });

        it("delegates to streamMockResponse when no API key is set", async () => {
            delete process.env.GOOGLE_AI_API_KEY;

            const blocks = [];
            for await (const block of streamLlmResponse("system prompt", "user message")) {
                blocks.push(block);
            }

            expect(blocks.length).toBeGreaterThan(0);
        });

        it("falls back to mock response when API call fails", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            // Don't set MOCK_GOOGLE_AI — force real API path but mock fetch to fail
            delete process.env.MOCK_GOOGLE_AI;

            // Mock global fetch to simulate API failure
            const originalFetch = globalThis.fetch;
            // oxlint-disable-next-line no-explicit-any -- type cast needed for mock fetch
            globalThis.fetch = /** @type {any} */ (
                mock(() => Promise.resolve(new Response("Internal Server Error", { status: 500 })))
            );

            const blocks = [];
            for await (const block of streamLlmResponse("system prompt", "user message")) {
                blocks.push(block);
            }

            expect(blocks.length).toBeGreaterThan(0);

            // Restore fetch
            globalThis.fetch = originalFetch;
        });

        it("yields blocks from Gemini API when streaming succeeds", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            delete process.env.MOCK_GOOGLE_AI;

            // Create a mock SSE stream that simulates Gemini response
            const sseData = JSON.stringify({
                candidates: [
                    {
                        content: {
                            parts: [{ text: "This is a test response from the LLM." }],
                        },
                    },
                ],
            });

            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(`data: ${sseData}\n\n`));
                    controller.close();
                },
            });

            const originalFetch = globalThis.fetch;
            // oxlint-disable-next-line no-explicit-any -- type cast needed for mock fetch
            globalThis.fetch = /** @type {any} */ (
                mock(() =>
                    Promise.resolve(
                        new Response(mockStream, {
                            status: 200,
                            headers: { "Content-Type": "text/event-stream" },
                        }),
                    ),
                )
            );

            const blocks = [];
            for await (const block of streamLlmResponse("system prompt", "user message")) {
                blocks.push(block);
            }

            expect(blocks.length).toBeGreaterThan(0);
            expect(blocks[0].type).toBe("paragraph");

            // Restore fetch
            globalThis.fetch = originalFetch;
        });
    });

    describe("buildSystemPrompt", () => {
        it("includes role instruction and mode guidance for player", () => {
            const prompt = buildSystemPrompt({ contextText: "", sources: [] }, "player");
            expect(prompt).toContain("Pathfinder 2e");
            expect(prompt).toContain("player");
        });

        it("includes mode guidance for GM", () => {
            const prompt = buildSystemPrompt({ contextText: "", sources: [] }, "gm");
            expect(prompt).toContain("Pathfinder 2e");
            expect(prompt).toContain("Game Master");
        });

        it("includes RAG context when provided", () => {
            const ragContext = {
                contextText: "<retrieved-context>Fireball is a spell</retrieved-context>",
                sources: [{ name: "Fireball", type: "spell", score: 0.95 }],
            };
            const prompt = buildSystemPrompt(ragContext, "player");
            expect(prompt).toContain("Fireball is a spell");
        });

        it("works without RAG context (empty contextText)", () => {
            const prompt = buildSystemPrompt({ contextText: "", sources: [] }, "player");
            expect(prompt).toContain("Pathfinder 2e");
            expect(prompt.includes("retrieved-context")).toBe(false);
        });
    });
});
