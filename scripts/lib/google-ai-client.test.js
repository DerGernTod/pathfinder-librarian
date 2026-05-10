import { describe, expect, it, mock } from "bun:test";

import { createEmbeddings } from "./google-ai-client.js";

/**
 * @param {() => Promise<unknown>} fn
 */
function mockFetch(fn) {
    globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (mock(fn)));
}

describe("google-ai-client", () => {
    describe("createEmbeddings", () => {
        it("calls correct API endpoint with model and API key", async () => {
            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            embeddings: [{ values: [0.1, 0.2, 0.3] }],
                        }),
                }),
            );
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await createEmbeddings("test-api-key", "text-embedding-004", ["hello world"]);

            expect(fetchMock).toHaveBeenCalled();
            const calls = /** @type {string[][]} */ (/** @type {unknown} */ (fetchMock.mock.calls));
            expect(calls[0][0]).toBe(
                "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=test-api-key",
            );
        });

        it("sends properly formatted request body", async () => {
            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }],
                        }),
                }),
            );
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            await createEmbeddings("key", "text-embedding-004", ["text 1", "text 2"]);

            const calls = /** @type {[string, RequestInit][]} */ (
                /** @type {unknown} */ (fetchMock.mock.calls)
            );
            const opts = calls[0][1];
            expect(opts.method).toBe("POST");
            expect(opts.headers).toEqual({ "Content-Type": "application/json" });

            const body = JSON.parse(/** @type {string} */ (opts.body));
            expect(body.requests).toHaveLength(2);
            expect(body.requests[0]).toEqual({
                model: "models/text-embedding-004",
                content: { parts: [{ text: "text 1" }] },
            });
            expect(body.requests[1]).toEqual({
                model: "models/text-embedding-004",
                content: { parts: [{ text: "text 2" }] },
            });
        });

        it("parses response and returns embedding vectors", async () => {
            mockFetch(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            embeddings: [{ values: [0.1, 0.2, 0.3] }, { values: [0.4, 0.5, 0.6] }],
                        }),
                }),
            );

            const result = await createEmbeddings("key", "text-embedding-004", [
                "text 1",
                "text 2",
            ]);

            expect(result).toEqual([
                [0.1, 0.2, 0.3],
                [0.4, 0.5, 0.6],
            ]);
        });

        it("throws on non-OK HTTP response with descriptive error", async () => {
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 400,
                    text: () => Promise.resolve("Bad Request: invalid API key"),
                }),
            );

            expect(createEmbeddings("bad-key", "text-embedding-004", ["test"])).rejects.toThrow(
                "Google AI API error: 400 Bad Request: invalid API key",
            );
        });

        it("handles rate limiting (429) with descriptive error message", async () => {
            mockFetch(() =>
                Promise.resolve({
                    ok: false,
                    status: 429,
                    text: () => Promise.resolve("Rate limit exceeded"),
                }),
            );

            expect(createEmbeddings("key", "text-embedding-004", ["test"])).rejects.toThrow(
                "Google AI API error: 429 Rate limit exceeded",
            );
        });

        it("handles empty input array (returns empty array)", async () => {
            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ embeddings: [] }),
                }),
            );
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            const result = await createEmbeddings("key", "text-embedding-004", []);

            expect(result).toEqual([]);
            // Should not call fetch for empty input
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });
});
