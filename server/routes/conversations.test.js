import { beforeEach, describe, expect, it } from "bun:test";

import { Hono } from "hono";

import { createDb } from "../db/database.js";
import { seedIfNeeded, SEED_IDS } from "../db/seed.js";
import { conversationsRouter } from "./conversations.js";
import { ruleItemsRouter } from "./rule-items.js";
import { usersRouter } from "./users.js";

describe("conversations routes", () => {
    let app;
    let db;

    beforeEach(() => {
        db = createDb(":memory:");
        seedIfNeeded(db);

        // Create app with middleware that sets DB in context
        app = new Hono()
            .use(async (c, next) => {
                c.set("db", db);
                await next();
            })
            .route("/api/conversations", conversationsRouter)
            .route("/api/rule-items", ruleItemsRouter)
            .route("/api/users", usersRouter);
    });

    describe("GET /api/conversations", () => {
        it("returns all conversations", async () => {
            const res = await app.request("/api/conversations");
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data).toHaveLength(3);
        });
    });

    describe("GET /api/conversations/:id", () => {
        it("returns conversation by id", async () => {
            const convs = await db.query("SELECT id FROM conversations").all();
            const res = await app.request(`/api/conversations/${convs[0].id}`);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.id).toBe(convs[0].id);
        });

        it("returns 404 for non-existent conversation", async () => {
            const res = await app.request(
                "/api/conversations/00000000-0000-0000-0000-000000000000",
            );
            expect(res.status).toBe(404);
        });

        it("validates UUID format", async () => {
            const res = await app.request("/api/conversations/invalid-id");
            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/conversations", () => {
        it("creates conversation with valid data", async () => {
            const newConv = { title: "Test Conversation", userId: SEED_IDS.USER_DEFAULT };
            const res = await app.request("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newConv),
            });
            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.title).toBe(newConv.title);
            expect(data.userId).toBe(newConv.userId);
            expect(data).toHaveProperty("id");
            expect(data).toHaveProperty("createdAt");
        });

        it("rejects empty title", async () => {
            const newConv = { title: "", userId: SEED_IDS.USER_DEFAULT };
            const res = await app.request("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newConv),
            });
            expect(res.status).toBe(400);
        });

        it("rejects missing userId", async () => {
            const newConv = { title: "Test" };
            const res = await app.request("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newConv),
            });
            expect(res.status).toBe(400);
        });
    });

    describe("GET /api/conversations/:id/messages", () => {
        it("returns messages for conversation", async () => {
            const convs = await db.query("SELECT id FROM conversations").all();
            const res = await app.request(`/api/conversations/${convs[0].id}/messages`);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
        });
    });

    describe("POST /api/conversations/:id/messages", () => {
        it("creates message for conversation", async () => {
            const convs = await db.query("SELECT id FROM conversations").all();
            const newMsg = { content: "Test message", mode: "player" };
            const res = await app.request(`/api/conversations/${convs[0].id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newMsg),
            });
            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.content).toBe(newMsg.content);
            expect(data.mode).toBe(newMsg.mode);
            expect(data.role).toBe("user");
        });

        it("rejects invalid mode", async () => {
            const convs = await db.query("SELECT id FROM conversations").all();
            const newMsg = { content: "Test", mode: "invalid" };
            const res = await app.request(`/api/conversations/${convs[0].id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newMsg),
            });
            expect(res.status).toBe(400);
        });
    });
});

describe("rule-items routes", () => {
    let app;
    let db;

    beforeEach(() => {
        db = createDb(":memory:");
        seedIfNeeded(db);

        // Create app with middleware that sets DB in context
        app = new Hono()
            .use(async (c, next) => {
                c.set("db", db);
                await next();
            })
            .route("/api/rule-items", ruleItemsRouter);
    });

    describe("GET /api/rule-items", () => {
        it("returns all rule items", async () => {
            const res = await app.request("/api/rule-items");
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data).toHaveLength(2);
        });

        it("filters by type", async () => {
            const res = await app.request("/api/rule-items?type=monster");
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data).toHaveLength(1);
            expect(data[0].type).toBe("monster");
        });
    });

    describe("GET /api/rule-items/:id", () => {
        it("returns rule item by id", async () => {
            const items = await db.query("SELECT id FROM rule_items").all();
            const res = await app.request(`/api/rule-items/${items[0].id}`);
            expect(res.status).toBe(200);
            const data = await res.json();
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
    let app;
    let db;

    beforeEach(() => {
        db = createDb(":memory:");
        seedIfNeeded(db);

        // Create app with middleware that sets DB in context
        app = new Hono()
            .use(async (c, next) => {
                c.set("db", db);
                await next();
            })
            .route("/api/users", usersRouter);
    });

    describe("GET /api/users", () => {
        it("returns all users", async () => {
            const res = await app.request("/api/users");
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("GET /api/users/:id", () => {
        it("returns user by id", async () => {
            const users = await db.query("SELECT id FROM users").all();
            const res = await app.request(`/api/users/${users[0].id}`);
            expect(res.status).toBe(200);
            const data = await res.json();
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
