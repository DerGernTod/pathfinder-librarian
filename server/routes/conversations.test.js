import { beforeEach, describe, expect, it } from "bun:test";

import { Hono } from "hono";

import { createDb } from "../db/database.js";

describe("conversations routes", () => {
    /** @type {Hono<any>} */
    let app;
    /** @type {ReturnType<typeof createDb>} */
    let db;
    let sessionToken;
    /** @type {import("../db/seed.js").SEED_IDS} */
    let SEED_IDS;

    beforeEach(async () => {
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
        it("creates message for conversation", async () => {
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
            expect(res.status).toBe(201);
            const { data } = await res.json();
            expect(data.content).toBe(newMsg.content);
            expect(data.mode).toBe(newMsg.mode);
            expect(data.role).toBe("user");
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

    describe("GET /api/rule-items", () => {
        it("returns all rule items", async () => {
            const res = await app.request("/api/rule-items");
            expect(res.status).toBe(200);
            const { data } = await res.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data).toHaveLength(2);
        });

        it("filters by type", async () => {
            const res = await app.request("/api/rule-items?type=monster");
            expect(res.status).toBe(200);
            const { data } = await res.json();
            expect(data).toHaveLength(1);
            expect(data[0].type).toBe("monster");
        });
    });

    describe("GET /api/rule-items/:id", () => {
        it("returns rule item by id", async () => {
            const items = await db.query("SELECT id FROM rule_items").all();
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
    let sessionToken;
    /** @type {import("../db/seed.js").SEED_IDS} */
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
