import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { Hono } from "hono";

import { createDb } from "../db/database.js";
import { redactCreatureDataForPlayer } from "../utils/data-redaction.js";

/**
 * Helper to parse newline-delimited JSON SSE stream into typed events.
 * @param {string} text
 * @returns {Array<{ type: string, data: unknown }>}
 */
function parseSse(text) {
    return text
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
}

describe("messages routes — ungrounded response", () => {
    /** @type {Hono<any>} */
    let app;
    /** @type {ReturnType<typeof createDb>} */
    let db;
    /** @type {string} */
    let sessionToken;
    /** @type {string} */
    let SEED_USER_ID;
    /** @type {string} */
    let convId;

    beforeEach(async () => {
        const { seedIfNeeded, SEED_IDS: seedIds } = await import("../db/seed.js");
        SEED_USER_ID = seedIds.USER_DEFAULT;

        db = createDb(":memory:");
        seedIfNeeded(db);

        const { conversationsRouter } = await import("./conversations.js");
        const { sessionMiddleware } = await import("../middleware/session.js");
        const { databaseMiddleware } = await import("../middleware/database.js");
        const { createSession, createConversation } = await import("../db/queries.js");

        // Mount the full conversations router (which includes messagesRouter at /:id)
        app = new Hono()
            .use("/api/*", databaseMiddleware({ database: db }))
            .use("/api/conversations/*", sessionMiddleware({ database: db }))
            .route("/api/conversations", conversationsRouter);

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const session = createSession(db, {
            userId: SEED_USER_ID,
            token: crypto.randomUUID(),
            expiresAt,
        });
        sessionToken = session.token;

        const conv = createConversation(db, {
            title: "Test Conv",
            userId: SEED_USER_ID,
        });
        convId = conv.id;
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    it("prepends disclaimer callout when RAG returns 0 results (no vector DB)", async () => {
        // No vector DB → RAG always returns empty → ungrounded path triggered
        // No API key → LLM falls back to mock response
        const res = await app.request(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken,
            },
            body: JSON.stringify({ content: "Unknown topic xyz", mode: "gm" }),
        });

        expect(res.status).toBe(200);
        const text = await res.text();
        const events = parseSse(text);

        const chunkEvents = events.filter((e) => e.type === "assistantChunk");
        const firstChunk = chunkEvents[0];

        expect(firstChunk).toBeDefined();
        const data = /** @type {{ type: string, title: string, markdown: string }} */ (
            firstChunk.data
        );
        expect(data.type).toBe("callout");
        expect(data.title).toBe("⚠ No Database Match");
        expect(data.markdown).toContain("no matching rules data was found");
    });

    it("includes ragMeta with resultCount=0 on assistantComplete when ungrounded", async () => {
        const res = await app.request(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken,
            },
            body: JSON.stringify({ content: "Hello", mode: "player" }),
        });

        const text = await res.text();
        const events = parseSse(text);
        const completeEvent = events.find((e) => e.type === "assistantComplete");
        expect(completeEvent).toBeDefined();
        if (!completeEvent) {
            return;
        }

        const data = /** @type {{ ragMeta: { resultCount: number } }} */ (completeEvent.data);
        expect(data.ragMeta).toBeDefined();
        expect(data.ragMeta.resultCount).toBe(0);
    });

    it("persists disclaimer callout in stored blocks", async () => {
        const res = await app.request(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken,
            },
            body: JSON.stringify({ content: "Something obscure", mode: "gm" }),
        });
        await res.text();

        // Check persisted blocks in DB
        const messages = db
            .query(
                "SELECT blocks_json FROM messages WHERE conversation_id = ? AND role = 'assistant'",
            )
            .all(convId);

        expect(messages).toHaveLength(1);
        const blocks = JSON.parse(messages[0].blocks_json);
        const calloutBlock = blocks.find(
            /** @param {{ title?: string }} b */ (b) => b.title === "⚠ No Database Match",
        );

        expect(calloutBlock).toBeDefined();
        expect(calloutBlock.type).toBe("callout");
    });

    it("disclaimer callout is streamed as assistantChunk", async () => {
        const res = await app.request(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken,
            },
            body: JSON.stringify({ content: "Another test", mode: "gm" }),
        });

        const text = await res.text();
        const events = parseSse(text);

        const chunkEvents = events.filter((e) => e.type === "assistantChunk");
        expect(chunkEvents.length).toBeGreaterThan(0);

        // First chunked event should be the disclaimer callout
        const disclaimerChunk = chunkEvents.find(
            (e) => /** @type {{ title?: string }} */ (e.data).title === "⚠ No Database Match",
        );
        expect(disclaimerChunk).toBeDefined();
        if (!disclaimerChunk) {
            return;
        }
        expect(/** @type {{ type: string }} */ (disclaimerChunk.data).type).toBe("callout");
    });
});

describe("messages routes — player mode redaction", () => {
    /** @type {Hono<any>} */
    let app;
    /** @type {ReturnType<typeof createDb>} */
    let db;
    /** @type {string} */
    let sessionToken;
    /** @type {string} */
    let SEED_USER_ID;
    /** @type {string} */
    let convId;

    beforeEach(async () => {
        const { seedIfNeeded, SEED_IDS: seedIds } = await import("../db/seed.js");
        SEED_USER_ID = seedIds.USER_DEFAULT;

        db = createDb(":memory:");
        seedIfNeeded(db);

        const { conversationsRouter } = await import("./conversations.js");
        const { sessionMiddleware } = await import("../middleware/session.js");
        const { databaseMiddleware } = await import("../middleware/database.js");
        const { createSession, createConversation } = await import("../db/queries.js");

        app = new Hono()
            .use("/api/*", databaseMiddleware({ database: db }))
            .use("/api/conversations/*", sessionMiddleware({ database: db }))
            .route("/api/conversations", conversationsRouter);

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const session = createSession(db, {
            userId: SEED_USER_ID,
            token: crypto.randomUUID(),
            expiresAt,
        });
        sessionToken = session.token;

        const conv = createConversation(db, {
            title: "Player Mode Test",
            userId: SEED_USER_ID,
        });
        convId = conv.id;
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    it("redactCreatureDataForPlayer strips sensitive fields", () => {
        const fullData = {
            name: "Test Creature",
            type: "Humanoid",
            level: 5,
            traits: ["Orc"],
            size: "med",
            attributes: {
                ac: { value: 20 },
                hp: { value: 50, max: 50 },
            },
            abilities: { str: { mod: 4 } },
            melee: [{ name: "Sword", attack: "+10", damage: "2d6+4" }],
        };

        const result = redactCreatureDataForPlayer(fullData);

        expect(result.redacted).toBe(true);
        expect(result.name).toBe("Test Creature");
        expect(result.level).toBeUndefined();
        expect(result.attributes).toBeUndefined();
        expect(result.abilities).toBeUndefined();
        expect(result.melee).toBeUndefined();
    });

    it("player mode message stores redacted blocks when LLM emits stat-block", async () => {
        // With no vector DB, the LLM falls back to mock response.
        // The mock response may or may not contain stat blocks.
        // We test the redaction pathway through the SSE stream.
        const res = await app.request(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken,
            },
            body: JSON.stringify({ content: "Tell me about orcs", mode: "player" }),
        });

        expect(res.status).toBe(200);
        const text = await res.text();
        const events = parseSse(text);

        // Verify the assistantComplete event exists
        const completeEvent = events.find((e) => e.type === "assistantComplete");
        expect(completeEvent).toBeDefined();

        // Check stored blocks in DB for any stat blocks
        const messages = db
            .query(
                "SELECT blocks_json FROM messages WHERE conversation_id = ? AND role = 'assistant'",
            )
            .all(convId);

        expect(messages).toHaveLength(1);
        const blocks = JSON.parse(messages[0].blocks_json);
        const statBlocks = blocks.filter(
            /** @param {{ type?: string }} b */ (b) => b.type === "stat-block",
        );

        // If there are stat blocks, they should be redacted in player mode
        for (const sb of statBlocks) {
            expect(sb.redacted).toBe(true);
            expect(sb.data?.attributes).toBeUndefined();
            expect(sb.data?.abilities).toBeUndefined();
            expect(sb.data?.melee).toBeUndefined();
            expect(sb.data?.actions).toBeUndefined();
            expect(sb.data?.level).toBeUndefined();
        }
    });

    it("gm mode message retains full stat data", async () => {
        // GM mode should not redact
        const res = await app.request(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken,
            },
            body: JSON.stringify({ content: "Tell me about orcs", mode: "gm" }),
        });

        expect(res.status).toBe(200);
        await res.text();

        const messages = db
            .query(
                "SELECT blocks_json FROM messages WHERE conversation_id = ? AND role = 'assistant'",
            )
            .all(convId);

        expect(messages).toHaveLength(1);
        const blocks = JSON.parse(messages[0].blocks_json);
        const statBlocks = blocks.filter(
            /** @param {{ type?: string }} b */ (b) => b.type === "stat-block",
        );

        // In GM mode, stat blocks should NOT be redacted
        for (const sb of statBlocks) {
            expect(sb.redacted).toBeUndefined();
        }
    });
});

describe("messages routes — cost metadata", () => {
    /** @type {Hono<any>} */
    let app;
    /** @type {ReturnType<typeof createDb>} */
    let db;
    /** @type {string} */
    let sessionToken;
    /** @type {string} */
    let SEED_USER_ID;
    /** @type {string} */
    let convId;

    beforeEach(async () => {
        const { seedIfNeeded, SEED_IDS: seedIds } = await import("../db/seed.js");
        SEED_USER_ID = seedIds.USER_DEFAULT;

        db = createDb(":memory:");
        seedIfNeeded(db);

        const { conversationsRouter } = await import("./conversations.js");
        const { sessionMiddleware } = await import("../middleware/session.js");
        const { databaseMiddleware } = await import("../middleware/database.js");
        const { createSession, createConversation } = await import("../db/queries.js");

        app = new Hono()
            .use("/api/*", databaseMiddleware({ database: db }))
            .use("/api/conversations/*", sessionMiddleware({ database: db }))
            .route("/api/conversations", conversationsRouter);

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const session = createSession(db, {
            userId: SEED_USER_ID,
            token: crypto.randomUUID(),
            expiresAt,
        });
        sessionToken = session.token;

        const conv = createConversation(db, {
            title: "Cost Test",
            userId: SEED_USER_ID,
        });
        convId = conv.id;
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    it("assistantComplete SSE event includes ragMeta.usage when Gemini returns usage", async () => {
        // Mock the LLM to return usage data
        const originalFetch = globalThis.fetch;
        const { mock } = await import("bun:test");

        /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
        const fetchMock = mock(() => {
            // Check if this is the Gemini API call
            const url = /** @type {string[]} */ (fetchMock.mock.calls.at(-1))?.[0];
            if (typeof url === "string" && url.includes("generateContent")) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            candidates: [
                                {
                                    content: {
                                        parts: [
                                            {
                                                text: JSON.stringify([
                                                    {
                                                        type: "text",
                                                        markdown: "Mocked LLM response",
                                                    },
                                                ]),
                                            },
                                        ],
                                    },
                                },
                            ],
                            usageMetadata: {
                                promptTokenCount: 200,
                                candidatesTokenCount: 80,
                                totalTokenCount: 280,
                            },
                        }),
                });
            }
            const lastCall = fetchMock.mock.calls.at(-1);
            if (lastCall) {
                return originalFetch(
                    .../** @type {[string | Request | URL, RequestInit | undefined]} */ (
                        /** @type {unknown} */ (lastCall)
                    ),
                );
            }
            return originalFetch("");
        });
        globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

        process.env.GOOGLE_AI_API_KEY = "test-key";

        try {
            const res = await app.request(`/api/conversations/${convId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify({ content: "Tell me about goblins", mode: "gm" }),
            });

            const text = await res.text();
            const events = parseSse(text);
            const completeEvent = events.find((e) => e.type === "assistantComplete");
            expect(completeEvent).toBeDefined();
            if (!completeEvent) {
                return;
            }

            const data =
                /** @type {{ ragMeta: { resultCount: number, usage?: { promptTokenCount?: number, candidatesTokenCount?: number, totalTokenCount?: number }, embeddingTokens?: number } }} */ (
                    completeEvent.data
                );
            expect(data.ragMeta).toBeDefined();
            expect(data.ragMeta.usage).toBeDefined();
            expect(data.ragMeta.usage?.promptTokenCount).toBe(200);
            expect(data.ragMeta.usage?.candidatesTokenCount).toBe(80);
            expect(data.ragMeta.usage?.totalTokenCount).toBe(280);
        } finally {
            globalThis.fetch = originalFetch;
            delete process.env.GOOGLE_AI_API_KEY;
            mock.restore();
        }
    });

    it("assistantComplete SSE event includes ragMeta.embeddingTokens", async () => {
        // No vector DB → embeddingTokens should be 0
        const res = await app.request(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken,
            },
            body: JSON.stringify({ content: "Hello", mode: "gm" }),
        });

        const text = await res.text();
        const events = parseSse(text);
        const completeEvent = events.find((e) => e.type === "assistantComplete");
        expect(completeEvent).toBeDefined();
        if (!completeEvent) {
            return;
        }

        const data = /** @type {{ ragMeta: { embeddingTokens?: number } }} */ (completeEvent.data);
        expect(data.ragMeta).toBeDefined();
        expect(typeof data.ragMeta.embeddingTokens).toBe("number");
    });

    it("assistantComplete SSE event has undefined usage when LLM falls back to mock", async () => {
        // No API key → LLM falls back to mock → usage should be undefined
        const res = await app.request(`/api/conversations/${convId}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-token": sessionToken,
            },
            body: JSON.stringify({ content: "Hello", mode: "gm" }),
        });

        const text = await res.text();
        const events = parseSse(text);
        const completeEvent = events.find((e) => e.type === "assistantComplete");
        expect(completeEvent).toBeDefined();
        if (!completeEvent) {
            return;
        }

        const data = /** @type {{ ragMeta: { usage?: unknown } }} */ (completeEvent.data);
        expect(data.ragMeta).toBeDefined();
        expect(data.ragMeta.usage).toBeUndefined();
    });
});

describe("messages routes — custom stat block resolution", () => {
    /** @type {Hono<any>} */
    let app;
    /** @type {ReturnType<typeof createDb>} */
    let db;
    /** @type {string} */
    let sessionToken;
    /** @type {string} */
    let SEED_USER_ID;
    /** @type {string} */
    let convId;

    beforeEach(async () => {
        const { seedIfNeeded, SEED_IDS: seedIds } = await import("../db/seed.js");
        SEED_USER_ID = seedIds.USER_DEFAULT;

        db = createDb(":memory:");
        seedIfNeeded(db);

        const { conversationsRouter } = await import("./conversations.js");
        const { sessionMiddleware } = await import("../middleware/session.js");
        const { databaseMiddleware } = await import("../middleware/database.js");
        const { createSession, createConversation } = await import("../db/queries.js");

        app = new Hono()
            .use("/api/*", databaseMiddleware({ database: db }))
            .use("/api/conversations/*", sessionMiddleware({ database: db }))
            .route("/api/conversations", conversationsRouter);

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const session = createSession(db, {
            userId: SEED_USER_ID,
            token: crypto.randomUUID(),
            expiresAt,
        });
        sessionToken = session.token;

        const conv = createConversation(db, {
            title: "Custom Stat Block Test",
            userId: SEED_USER_ID,
        });
        convId = conv.id;
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    /**
     * Helper to mock Gemini to return specific blocks.
     * @param {import("bun:test").Mock<() => Promise<unknown>>} fetchMock
     * @param {import("../../shared/types.js").MessageBlock[]} blocks
     */
    function mockGeminiBlocks(fetchMock, blocks) {
        fetchMock.mockImplementation(() => {
            const url = /** @type {string[]} */ (fetchMock.mock.calls.at(-1))?.[0];
            if (typeof url === "string" && url.includes("generateContent")) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            candidates: [
                                {
                                    content: {
                                        parts: [{ text: JSON.stringify(blocks) }],
                                    },
                                },
                            ],
                        }),
                });
            }
            return Promise.resolve({
                ok: false,
                status: 500,
                text: () => Promise.resolve("Not mocked"),
            });
        });
    }

    it("GM mode: custom-stat-block is resolved to stat-block with full inline data", async () => {
        const originalFetch = globalThis.fetch;
        const { mock } = await import("bun:test");

        /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
        const fetchMock = mock(() =>
            Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("") }),
        );
        globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));
        process.env.GOOGLE_AI_API_KEY = "test-key";

        try {
            mockGeminiBlocks(fetchMock, [
                {
                    type: "custom-stat-block",
                    title: "Sylvaris",
                    data: {
                        name: "Sylvaris",
                        type: "Humanoid",
                        level: 5,
                        traits: ["Elf", "Ranger"],
                        attributes: {
                            ac: { value: 22 },
                            hp: { value: 75, max: 75 },
                            speed: "30 feet",
                        },
                        abilities: {
                            str: { mod: 2 },
                            dex: { mod: 4 },
                            con: { mod: 1 },
                            int: { mod: 2 },
                            wis: { mod: 3 },
                            cha: { mod: 1 },
                        },
                    },
                },
            ]);

            const res = await app.request(`/api/conversations/${convId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify({
                    content: "Create an elf ranger named Sylvaris",
                    mode: "gm",
                }),
            });

            const text = await res.text();
            const events = parseSse(text);

            const chunkEvents = events.filter((e) => e.type === "assistantChunk");
            const statBlockChunk = chunkEvents.find(
                (e) => /** @type {{ type?: string }} */ (e.data).type === "stat-block",
            );
            expect(statBlockChunk).toBeDefined();
            if (!statBlockChunk) {
                return;
            }

            const data =
                /** @type {{ type: string, title: string, data: unknown, redacted?: boolean }} */ (
                    statBlockChunk.data
                );
            expect(data.type).toBe("stat-block");
            expect(data.title).toBe("Sylvaris");
            expect(data.redacted).toBeUndefined();

            const creatureData =
                /** @type {{ name: string, level: number, attributes: unknown }} */ (data.data);
            expect(creatureData.name).toBe("Sylvaris");
            expect(creatureData.level).toBe(5);
            expect(creatureData.attributes).toBeDefined();
        } finally {
            globalThis.fetch = originalFetch;
            delete process.env.GOOGLE_AI_API_KEY;
            mock.restore();
        }
    });

    it("player mode: custom-stat-block is resolved to stat-block with redaction", async () => {
        const originalFetch = globalThis.fetch;
        const { mock } = await import("bun:test");

        /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
        const fetchMock = mock(() =>
            Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("") }),
        );
        globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));
        process.env.GOOGLE_AI_API_KEY = "test-key";

        try {
            mockGeminiBlocks(fetchMock, [
                {
                    type: "custom-stat-block",
                    title: "Sylvaris",
                    data: {
                        name: "Sylvaris",
                        type: "Humanoid",
                        level: 5,
                        traits: ["Elf", "Ranger"],
                        attributes: {
                            ac: { value: 22 },
                            hp: { value: 75, max: 75 },
                        },
                        abilities: {
                            str: { mod: 2 },
                            dex: { mod: 4 },
                        },
                    },
                },
            ]);

            const res = await app.request(`/api/conversations/${convId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify({
                    content: "Create an elf ranger named Sylvaris",
                    mode: "player",
                }),
            });

            const text = await res.text();
            const events = parseSse(text);

            const chunkEvents = events.filter((e) => e.type === "assistantChunk");
            const statBlockChunk = chunkEvents.find(
                (e) => /** @type {{ type?: string }} */ (e.data).type === "stat-block",
            );
            expect(statBlockChunk).toBeDefined();
            if (!statBlockChunk) {
                return;
            }

            const data =
                /** @type {{ type: string, title: string, data: unknown, redacted?: boolean }} */ (
                    statBlockChunk.data
                );
            expect(data.type).toBe("stat-block");
            expect(data.title).toBe("Sylvaris");
            expect(data.redacted).toBe(true);

            const creatureData =
                /** @type {{ name: string, level?: number, attributes?: unknown, abilities?: unknown }} */ (
                    data.data
                );
            expect(creatureData.name).toBe("Sylvaris");
            expect(creatureData.level).toBeUndefined();
            expect(creatureData.attributes).toBeUndefined();
            expect(creatureData.abilities).toBeUndefined();
        } finally {
            globalThis.fetch = originalFetch;
            delete process.env.GOOGLE_AI_API_KEY;
            mock.restore();
        }
    });

    it("mixed blocks: text + custom-stat-block + stat-block all resolve correctly", async () => {
        const originalFetch = globalThis.fetch;
        const { mock } = await import("bun:test");

        /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
        const fetchMock = mock(() =>
            Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("") }),
        );
        globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));
        process.env.GOOGLE_AI_API_KEY = "test-key";

        try {
            mockGeminiBlocks(fetchMock, [
                { type: "text", markdown: "Here is a custom creature:" },
                {
                    type: "custom-stat-block",
                    title: "Flame Wisp",
                    data: { name: "Flame Wisp", level: 2 },
                },
            ]);

            const res = await app.request(`/api/conversations/${convId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify({
                    content: "Create a flame wisp creature",
                    mode: "gm",
                }),
            });

            const text = await res.text();
            const events = parseSse(text);

            const chunkEvents = events.filter((e) => e.type === "assistantChunk");
            expect(chunkEvents.length).toBeGreaterThanOrEqual(2);

            const types = chunkEvents.map((e) => /** @type {{ type: string }} */ (e.data).type);
            expect(types).toContain("text");
            expect(types).toContain("stat-block");
            expect(types).not.toContain("custom-stat-block");
        } finally {
            globalThis.fetch = originalFetch;
            delete process.env.GOOGLE_AI_API_KEY;
            mock.restore();
        }
    });

    it("minimal custom-stat-block with name and level only renders without error", async () => {
        const originalFetch = globalThis.fetch;
        const { mock } = await import("bun:test");

        /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
        const fetchMock = mock(() =>
            Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("") }),
        );
        globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));
        process.env.GOOGLE_AI_API_KEY = "test-key";

        try {
            mockGeminiBlocks(fetchMock, [
                {
                    type: "custom-stat-block",
                    title: "Mystery Beast",
                    data: { name: "Mystery Beast", level: 10 },
                },
            ]);

            const res = await app.request(`/api/conversations/${convId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify({
                    content: "Create a mystery beast",
                    mode: "gm",
                }),
            });

            const text = await res.text();
            const events = parseSse(text);

            const chunkEvents = events.filter((e) => e.type === "assistantChunk");
            const statBlockChunk = chunkEvents.find(
                (e) => /** @type {{ type?: string }} */ (e.data).type === "stat-block",
            );
            expect(statBlockChunk).toBeDefined();
            if (!statBlockChunk) {
                return;
            }

            const data =
                /** @type {{ type: string, title: string, data: { name: string, level: number } }} */ (
                    statBlockChunk.data
                );
            expect(data.type).toBe("stat-block");
            expect(data.title).toBe("Mystery Beast");
            expect(data.data.name).toBe("Mystery Beast");
            expect(data.data.level).toBe(10);
        } finally {
            globalThis.fetch = originalFetch;
            delete process.env.GOOGLE_AI_API_KEY;
            mock.restore();
        }
    });

    it("stored assistant message contains resolved stat-block blocks not raw custom-stat-block", async () => {
        const originalFetch = globalThis.fetch;
        const { mock } = await import("bun:test");

        /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
        const fetchMock = mock(() =>
            Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("") }),
        );
        globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));
        process.env.GOOGLE_AI_API_KEY = "test-key";

        try {
            mockGeminiBlocks(fetchMock, [
                {
                    type: "custom-stat-block",
                    title: "Frost Giant",
                    data: { name: "Frost Giant", level: 8 },
                },
            ]);

            const res = await app.request(`/api/conversations/${convId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify({
                    content: "Create a frost giant",
                    mode: "gm",
                }),
            });
            await res.text();

            const messages = db
                .query(
                    "SELECT blocks_json FROM messages WHERE conversation_id = ? AND role = 'assistant'",
                )
                .all(convId);

            expect(messages).toHaveLength(1);
            const blocks = JSON.parse(messages[0].blocks_json);

            // Should not contain any raw custom-stat-block
            const customBlocks = blocks.filter(
                /** @param {{ type?: string }} b */ (b) => b.type === "custom-stat-block",
            );
            expect(customBlocks).toHaveLength(0);

            // Should contain resolved stat-block
            const statBlocks = blocks.filter(
                /** @param {{ type?: string }} b */ (b) => b.type === "stat-block",
            );
            expect(statBlocks).toHaveLength(1);
            expect(statBlocks[0].title).toBe("Frost Giant");
            expect(statBlocks[0].data.name).toBe("Frost Giant");
            expect(statBlocks[0].data.level).toBe(8);
        } finally {
            globalThis.fetch = originalFetch;
            delete process.env.GOOGLE_AI_API_KEY;
            mock.restore();
        }
    });
});
