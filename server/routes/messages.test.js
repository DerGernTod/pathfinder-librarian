import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { Hono } from "hono";

import { createDb } from "../db/database.js";

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
