import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { Hono } from "hono";

import { createDb } from "../db/database.js";

describe("conversations routes", () => {
    /** @type {Hono<any>} */
    let app;
    /** @type {ReturnType<typeof createDb>} */
    let db;
    /** @type {string} */
    let sessionToken;
    /** @type {{ USER_DEFAULT: string, USER_TEST_PLAYER: string }} */
    let SEED_IDS;

    beforeEach(async () => {
        process.env.ENABLE_MOCK_FALLBACK = "true";
        // Import seed inside beforeEach to avoid caching database module
        const { seedIfNeeded, SEED_IDS: seedIds } = await import("../db/seed.js");
        SEED_IDS = seedIds;

        db = createDb(":memory:");
        seedIfNeeded(db);

        const { conversationsRouter } = await import("./conversations.js");
        const { ruleItemsRouter } = await import("./rule-items.js");
        const { usersRouter } = await import("./users.js");
        const { sessionMiddleware } = await import("../middleware/session.js");
        const { databaseMiddleware } = await import("../middleware/database.js");
        const { createSession } = await import("../db/queries.js");

        // Create app with middleware applied BEFORE routes (like production)
        app = new Hono()
            // Apply database middleware with test db
            .use("/api/*", databaseMiddleware({ database: db }))
            // Apply session middleware to protected routes, passing test db
            .use("/api/conversations/*", sessionMiddleware({ database: db }))
            .use("/api/rule-items/*", sessionMiddleware({ database: db }))
            // Then mount the routers (users router handles its own session middleware for /me routes)
            .route("/api/conversations", conversationsRouter)
            .route("/api/rule-items", ruleItemsRouter)
            .route("/api/users", usersRouter);

        // Create a test session
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const session = createSession(db, {
            userId: SEED_IDS.USER_DEFAULT,
            token: crypto.randomUUID(),
            expiresAt,
        });
        sessionToken = session.token;
    });

    afterEach(() => {
        delete process.env.ENABLE_MOCK_FALLBACK;
        if (db) {
            db.close();
        }
    });

    describe("GET /api/conversations", () => {
        it("returns conversations for authenticated user", async () => {
            const res = await app.request("/api/conversations", {
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(Array.isArray(data.data)).toBe(true);
            expect(data.data).toHaveLength(2); // USER_DEFAULT has 2 conversations
        });

        it("excludes archived conversations", async () => {
            // Archive one conversation directly in DB
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            db.run("UPDATE conversations SET archived_at = ? WHERE id = ?", [
                new Date().toISOString(),
                convs[0].id,
            ]);

            const res = await app.request("/api/conversations", {
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data).toHaveLength(1);
        });

        it("returns 401 without session", async () => {
            const res = await app.request("/api/conversations");
            expect(res.status).toBe(401);
        });
    });

    describe("GET /api/conversations/:id", () => {
        it("returns conversation by id", async () => {
            const convs = db
                .query("SELECT id, user_id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const res = await app.request(`/api/conversations/${convs[0].id}`, {
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.id).toBe(convs[0].id);
        });

        it("returns 404 for non-existent conversation", async () => {
            const res = await app.request(
                "/api/conversations/00000000-0000-0000-0000-000000000000",
                { headers: { "x-session-token": sessionToken } },
            );
            expect(res.status).toBe(404);
        });

        it("validates UUID format", async () => {
            const res = await app.request("/api/conversations/invalid-id", {
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/conversations", () => {
        it("creates conversation with valid data", async () => {
            const newConv = { title: "Test Conversation" };
            const res = await app.request("/api/conversations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify(newConv),
            });
            expect(res.status).toBe(201);
            const { data } = await res.json();
            expect(data.title).toBe(newConv.title);
            expect(data.userId).toBe(SEED_IDS.USER_DEFAULT);
            expect(data).toHaveProperty("id");
            expect(data).toHaveProperty("createdAt");
        });

        it("rejects empty title", async () => {
            const newConv = { title: "" };
            const res = await app.request("/api/conversations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify(newConv),
            });
            expect(res.status).toBe(400);
        });

        it("rejects missing session", async () => {
            const newConv = { title: "Test" };
            const res = await app.request("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newConv),
            });
            expect(res.status).toBe(401);
        });
    });

    describe("GET /api/conversations/:id/messages", () => {
        it("returns messages for conversation", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const res = await app.request(`/api/conversations/${convs[0].id}/messages`, {
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
            const { data } = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });
    });

    describe("POST /api/conversations/:id/messages", () => {
        it("creates user message and returns mock assistant response", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const newMsg = { content: "Test message", mode: "player" };
            const res = await app.request(`/api/conversations/${convs[0].id}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify(newMsg),
            });
            expect(res.status).toBe(200);
            const text = await res.text();
            const lines = text
                .trim()
                .split("\n")
                .map((l) => JSON.parse(l));

            const userMsg = lines.find((l) => l.type === "userMessage").data;
            const assistantMsg = lines.find((l) => l.type === "assistantComplete").data;

            const data = { userMessage: userMsg, assistantMessage: assistantMsg };

            // Verify user message
            expect(data.userMessage.content).toBe(newMsg.content);
            expect(data.userMessage.mode).toBe(newMsg.mode);
            expect(data.userMessage.role).toBe("user");
            expect(data.userMessage.blocks).toBeNull();

            // Verify assistant message
            expect(data.assistantMessage.role).toBe("assistant");
            expect(data.assistantMessage.mode).toBe(newMsg.mode);
            expect(data.assistantMessage.content).toBeNull();
            const blocks = data.assistantMessage.blocks;
            expect(Array.isArray(blocks)).toBe(true);
            expect(blocks.length).toBeGreaterThan(0);

            // Verify both messages have the same conversation ID
            expect(data.userMessage.conversationId).toBe(data.assistantMessage.conversationId);
        });

        it("stores both messages in database", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const newMsg = { content: "Test message", mode: "gm" };
            const res = await app.request(`/api/conversations/${convs[0].id}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify(newMsg),
            });
            await res.text(); // Consume stream

            // Query messages table directly
            const messages = db
                .query(
                    "SELECT id, role, mode, content, blocks_json FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 2",
                )
                .all(convs[0].id);

            expect(messages).toHaveLength(2);

            // First message should be assistant (newest)
            expect(messages[0].role).toBe("assistant");
            expect(messages[0].mode).toBe("gm");
            expect(messages[0].content).toBeNull();
            expect(messages[0].blocks_json).toBeTruthy();

            // Second message should be user
            expect(messages[1].role).toBe("user");
            expect(messages[1].mode).toBe("gm");
            expect(messages[1].content).toBe("Test message");
            expect(messages[1].blocks_json).toBeNull();
        });

        it("rejects invalid mode", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const newMsg = { content: "Test", mode: "invalid" };
            const res = await app.request(`/api/conversations/${convs[0].id}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-session-token": sessionToken,
                },
                body: JSON.stringify(newMsg),
            });
            expect(res.status).toBe(400);
        });
    });

    describe("GET /api/conversations/archived", () => {
        it("returns only archived conversations for authenticated user", async () => {
            // Archive one conversation
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            db.run("UPDATE conversations SET archived_at = ? WHERE id = ?", [
                new Date().toISOString(),
                convs[0].id,
            ]);

            const res = await app.request("/api/conversations/archived", {
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data).toHaveLength(1);
            expect(data.data[0].archivedAt).not.toBeNull();
        });

        it("returns empty array when none archived", async () => {
            const res = await app.request("/api/conversations/archived", {
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data).toEqual([]);
        });

        it("returns 401 without session", async () => {
            const res = await app.request("/api/conversations/archived");
            expect(res.status).toBe(401);
        });
    });

    describe("PATCH /api/conversations/:id/archive", () => {
        it("archives successfully and returns non-null archivedAt", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const res = await app.request(`/api/conversations/${convs[0].id}/archive`, {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.archivedAt).not.toBeNull();
        });

        it("is idempotent — archiving already-archived returns 200", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            await app.request(`/api/conversations/${convs[0].id}/archive`, {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            const res2 = await app.request(`/api/conversations/${convs[0].id}/archive`, {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            expect(res2.status).toBe(200);
        });

        it("returns 403 for another user's conversation", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_TEST_PLAYER);
            const res = await app.request(`/api/conversations/${convs[0].id}/archive`, {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(403);
        });

        it("returns 404 for non-existent conversation", async () => {
            const res = await app.request(
                "/api/conversations/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/archive",
                {
                    method: "PATCH",
                    headers: { "x-session-token": sessionToken },
                },
            );
            expect(res.status).toBe(404);
        });

        it("returns 400 for invalid UUID", async () => {
            const res = await app.request("/api/conversations/invalid-id/archive", {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(400);
        });

        it("returns 400 for __new__ literal", async () => {
            const res = await app.request("/api/conversations/__new__/archive", {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(400);
        });

        it("returns 401 without session", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const res = await app.request(`/api/conversations/${convs[0].id}/archive`, {
                method: "PATCH",
            });
            expect(res.status).toBe(401);
        });
    });

    describe("PATCH /api/conversations/:id/restore", () => {
        it("restores successfully after archiving", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            // Archive first
            await app.request(`/api/conversations/${convs[0].id}/archive`, {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            // Then restore
            const res = await app.request(`/api/conversations/${convs[0].id}/restore`, {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.archivedAt).toBeNull();
        });

        it("is idempotent — restoring already-active returns 200", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const res = await app.request(`/api/conversations/${convs[0].id}/restore`, {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
        });

        it("returns 403 for another user's conversation", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_TEST_PLAYER);
            const res = await app.request(`/api/conversations/${convs[0].id}/restore`, {
                method: "PATCH",
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(403);
        });

        it("returns 404 for non-existent conversation", async () => {
            const res = await app.request(
                "/api/conversations/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/restore",
                {
                    method: "PATCH",
                    headers: { "x-session-token": sessionToken },
                },
            );
            expect(res.status).toBe(404);
        });

        it("returns 401 without session", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const res = await app.request(`/api/conversations/${convs[0].id}/restore`, {
                method: "PATCH",
            });
            expect(res.status).toBe(401);
        });
    });

    describe("DELETE /api/conversations/:id", () => {
        it("deletes successfully", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const res = await app.request(`/api/conversations/${convs[0].id}`, {
                method: "DELETE",
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
        });

        it("verifies messages are gone from DB after delete", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const convId = convs[0].id;
            await app.request(`/api/conversations/${convId}`, {
                method: "DELETE",
                headers: { "x-session-token": sessionToken },
            });
            const messages = db
                .query("SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?")
                .get(convId);
            expect(messages.count).toBe(0);
        });

        it("returns 403 for another user's conversation", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_TEST_PLAYER);
            const res = await app.request(`/api/conversations/${convs[0].id}`, {
                method: "DELETE",
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(403);
        });

        it("returns 404 for non-existent conversation", async () => {
            const res = await app.request(
                "/api/conversations/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                {
                    method: "DELETE",
                    headers: { "x-session-token": sessionToken },
                },
            );
            expect(res.status).toBe(404);
        });

        it("returns 401 without session", async () => {
            const convs = db
                .query("SELECT id FROM conversations WHERE user_id = ?")
                .all(SEED_IDS.USER_DEFAULT);
            const res = await app.request(`/api/conversations/${convs[0].id}`, {
                method: "DELETE",
            });
            expect(res.status).toBe(401);
        });
    });
});

describe("rule-items routes", () => {
    /** @type {Hono<any>} */
    let app;
    /** @type {ReturnType<typeof createDb>} */
    let db;

    beforeEach(async () => {
        // Import seed inside beforeEach to avoid caching database module
        const { seedIfNeeded } = await import("../db/seed.js");

        db = createDb(":memory:");
        seedIfNeeded(db);

        const { ruleItemsRouter } = await import("./rule-items.js");
        const { databaseMiddleware } = await import("../middleware/database.js");

        // Create app with middleware that sets DB in context
        app = new Hono()
            .use("/api/*", databaseMiddleware({ database: db }))
            .route("/api/rule-items", ruleItemsRouter);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    describe("GET /api/rule-items", () => {
        it("returns all rule items", async () => {
            const res = await app.request("/api/rule-items");
            expect(res.status).toBe(200);
            const { data } = await res.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data).toHaveLength(5);
        });

        it("filters by type", async () => {
            const res = await app.request("/api/rule-items?type=creature");
            expect(res.status).toBe(200);
            const { data } = await res.json();
            expect(data).toHaveLength(1);
            expect(data[0].type).toBe("creature");
        });
    });

    describe("GET /api/rule-items/:id", () => {
        it("returns rule item by id", async () => {
            const items = db.query("SELECT id FROM rule_items").all();
            const res = await app.request(`/api/rule-items/${items[0].id}`);
            expect(res.status).toBe(200);
            const { data } = await res.json();
            expect(data.id).toBe(items[0].id);
        });

        it("returns 404 for non-existent rule item", async () => {
            const res = await app.request("/api/rule-items/00000000-0000-0000-0000-000000000000");
            expect(res.status).toBe(404);
        });

        it("validates UUID format", async () => {
            const res = await app.request("/api/rule-items/invalid-id");
            expect(res.status).toBe(400);
        });
    });
});

describe("users routes", () => {
    /** @type {Hono<any>} */
    let app;
    /** @type {import("bun:sqlite").Database} */
    let db;
    /** @type {string} */
    let sessionToken;
    let SEED_IDS;

    beforeEach(async () => {
        // Import seed inside beforeEach to avoid caching database module
        const { seedIfNeeded, SEED_IDS: seedIds } = await import("../db/seed.js");
        SEED_IDS = seedIds;

        db = createDb(":memory:");
        seedIfNeeded(db);

        const { usersRouter } = await import("./users.js");
        const { databaseMiddleware } = await import("../middleware/database.js");
        const { createSession } = await import("../db/queries.js");

        // Create app with middleware applied BEFORE routes (like production)
        app = new Hono()
            // Apply database middleware with test db
            .use("/api/*", databaseMiddleware({ database: db }))
            // Then mount the routers (users router handles its own session middleware for /me routes)
            .route("/api/users", usersRouter);

        // Create a test session
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const session = createSession(db, {
            userId: SEED_IDS.USER_DEFAULT,
            token: crypto.randomUUID(),
            expiresAt,
        });
        sessionToken = session.token;
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    describe("GET /api/users", () => {
        it("returns all users", async () => {
            const res = await app.request("/api/users", {
                headers: { "x-session-token": sessionToken },
            });
            expect(res.status).toBe(200);
            const { data } = await res.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("GET /api/users/:id", () => {
        it("returns user by id", async () => {
            const users = db.query("SELECT id FROM users").all();
            const res = await app.request(`/api/users/${users[0].id}`);
            expect(res.status).toBe(200);
            const { data } = await res.json();
            expect(data.id).toBe(users[0].id);
        });

        it("returns 404 for non-existent user", async () => {
            const res = await app.request("/api/users/00000000-0000-0000-0000-000000000000");
            expect(res.status).toBe(404);
        });

        it("validates UUID format", async () => {
            const res = await app.request("/api/users/invalid-id");
            expect(res.status).toBe(400);
        });
    });
});
