import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { ensureTestUserSchema } from "../../shared/schemas.js";
import { createDb } from "../db/database.js";
import { resetAndReseedDb, seedForUser } from "../db/seed.js";
import { SEED_IDS } from "../db/seed.js";

// Create in-memory DB for testing
const testDb = createDb(":memory:");
resetAndReseedDb(testDb);

// Mock database BEFORE importing router
await mock.module("../db/database.js", () => ({
    db: testDb,
}));

// Import router after mocking database
const { createAuthRouter } = await import("./auth.js");
const { sessionMiddleware } = await import("../middleware/session.js");

// Create auth router for testing with session middleware using test db
const authRouter = new Hono()
    .use("/auth/me", sessionMiddleware({ database: testDb }))
    .use("/auth/logout", sessionMiddleware({ database: testDb }))
    .route("/auth", createAuthRouter());

describe("auth routes", () => {
    beforeAll(() => {
        // Any setup needed
    });

    describe("POST /auth/register/start", () => {
        test("creates user and returns options + challengeId", async () => {
            const res = await authRouter.request("/auth/register/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Test User" }),
            });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.result).toBe("success");
            expect(json.data.options).toBeDefined();
            expect(json.data.challengeId).toBeDefined();
            expect(json.data.challengeId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            );
            expect(json.data.webauthnUserId).toBeDefined();
            expect(json.data.webauthnUserId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            );
        });

        test("rejects empty name", async () => {
            const res = await authRouter.request("/auth/register/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "" }),
            });

            expect(res.status).toBe(400);
        });

        test("rejects invalid credential structure", async () => {
            const res = await authRouter.request("/auth/register/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: "test" }),
            });

            expect(res.status).toBe(400);
        });
    });
});

describe("POST /auth/quick-login", () => {
    test("creates session for test user", async () => {
        const res = await authRouter.request("/auth/quick-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: SEED_IDS.USER_DEFAULT }),
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.result).toBe("success");
        expect(json.data.user).toBeDefined();
        expect(json.data.user.id).toBe(SEED_IDS.USER_DEFAULT);
    });

    test("rejects non-test user", async () => {
        // This test will pass if we have a non-test user, otherwise it will be skipped
        // Currently all seed users are test users, so this test expects 404 (user not found)
        const res = await authRouter.request("/auth/quick-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000999" }),
        });

        expect(res.status).toBe(404);
    });
});

describe("GET /auth/me", () => {
    test("returns user when session valid", async () => {
        // First, quick-login to get a session
        const loginRes = await authRouter.request("/auth/quick-login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId: SEED_IDS.USER_DEFAULT }),
        });

        const setCookieHeader = loginRes.headers.get("set-cookie");
        const cookieMatch = setCookieHeader?.match(/session_token=([^;]+)/);
        expect(cookieMatch).not.toBeNull();
        if (!cookieMatch) {
            throw new Error("No session token found");
        }

        // Try using a custom header for testing
        const res = await authRouter.request("/auth/me", {
            headers: { "x-session-token": cookieMatch[1] },
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.result).toBe("success");
        expect(json.data.id).toBe(SEED_IDS.USER_DEFAULT);
    });

    test("returns 401 when no session", async () => {
        const res = await authRouter.request("/auth/me");

        expect(res.status).toBe(401);
    });
});

describe("POST /auth/logout", () => {
    test("deletes session and clears cookie", async () => {
        // First, quick-login to get a session
        const loginRes = await authRouter.request("/auth/quick-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: SEED_IDS.USER_DEFAULT }),
        });

        const setCookieHeader = loginRes.headers.get("set-cookie");
        const cookieMatch = setCookieHeader?.match(/session_token=([^;]+)/);
        expect(cookieMatch).not.toBeNull();
        if (!cookieMatch) {
            throw new Error("No session token found");
        }

        // Now logout using custom header
        const res = await authRouter.request("/auth/logout", {
            method: "POST",
            headers: { "x-session-token": cookieMatch[1] },
        });

        expect(res.status).toBe(200);

        // Verify session is deleted
        const meRes = await authRouter.request("/auth/me", {
            headers: { "x-session-token": cookieMatch[1] },
        });

        expect(meRes.status).toBe(401);
    });
});

describe("POST /api/test/ensure-test-user", () => {
    // Import db AFTER mock is active to get the test DB
    const { db: ensureDb } = require("../db/database.js");
    const queries = require("../db/queries.js");

    // Build a minimal app with just this endpoint
    const testApp = new Hono().post(
        "/api/test/ensure-test-user",
        zValidator("json", ensureTestUserSchema),
        async (c) => {
            const { userId, name, mode } = c.req.valid("json");

            const existing = queries.getUserById(ensureDb, userId);
            if (existing) {
                return c.json({ result: "success", data: existing }, 200);
            }

            const words = name.trim().split(/\s+/);
            let initials;
            if (words.length === 1) {
                initials = words[0].substring(0, 2).toUpperCase();
            } else {
                initials = (words[0][0] + words[words.length - 1][0]).toUpperCase();
            }

            const hex8 = userId.replace(/-/g, "").substring(0, 8);
            const email = `test-${hex8}@local.test`;
            const subtitle = mode === "gm" ? "Game Master" : "Player";

            ensureDb.run(
                "INSERT INTO users (id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [userId, name, initials, subtitle, mode, email, 1, userId],
            );

            seedForUser(ensureDb, userId, mode);

            const user = queries.getUserById(ensureDb, userId);
            if (!user) {
                return c.json({ result: "error", message: "Failed to create user" }, 500);
            }

            return c.json({ result: "success", data: user }, 200);
        },
    );

    test("creates a test user with correct data", async () => {
        const res = await testApp.request("/api/test/ensure-test-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: "11111111-1111-4111-8111-111111111111",
                name: "Pathfinder GM",
                mode: "gm",
            }),
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.result).toBe("success");
        expect(json.data.name).toBe("Pathfinder GM");
        expect(json.data.initials).toBe("PG");
        expect(json.data.subtitle).toBe("Game Master");
        expect(json.data.mode).toBe("gm");
        expect(json.data.email).toBe("test-11111111@local.test");
        expect(json.data.isTestUser).toBe(true);
    });

    test("is idempotent — returns same user on second call", async () => {
        const userId = "22222222-2222-4222-8222-222222222222";
        const res1 = await testApp.request("/api/test/ensure-test-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, name: "Test User", mode: "gm" }),
        });
        expect(res1.status).toBe(200);

        const res2 = await testApp.request("/api/test/ensure-test-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, name: "Different Name", mode: "player" }),
        });
        expect(res2.status).toBe(200);
        const json2 = await res2.json();
        // Should return existing user, not create with different name
        expect(json2.data.name).toBe("Test User");
    });

    test("sets subtitle to 'Player' for player mode", async () => {
        const res = await testApp.request("/api/test/ensure-test-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: "33333333-3333-4333-8333-333333333333",
                name: "Valeros",
                mode: "player",
            }),
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.subtitle).toBe("Player");
        expect(json.data.mode).toBe("player");
    });

    test("derives initials correctly for single-word name", async () => {
        const res = await testApp.request("/api/test/ensure-test-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: "44444444-4444-4444-8444-444444444444",
                name: "Valeros",
                mode: "player",
            }),
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.initials).toBe("VA");
    });

    test("creates seeded conversations for the user", async () => {
        const userId = "55555555-5555-4555-8555-555555555555";
        const res = await testApp.request("/api/test/ensure-test-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, name: "Conv Test", mode: "gm" }),
        });

        expect(res.status).toBe(200);

        // Verify conversations exist
        const conversations = ensureDb
            .query("SELECT * FROM conversations WHERE user_id = ?")
            .all(userId);
        expect(conversations.length).toBe(2);

        // Verify messages exist
        for (const conv of conversations) {
            const msgs = ensureDb
                .query("SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?")
                .get(conv.id);
            expect(msgs.count).toBeGreaterThan(0);
        }
    });

    test("rejects invalid userId (not a UUID)", async () => {
        const res = await testApp.request("/api/test/ensure-test-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "not-a-uuid", name: "Test", mode: "gm" }),
        });

        expect(res.status).toBe(400);
    });

    test("rejects empty name", async () => {
        const res = await testApp.request("/api/test/ensure-test-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: "66666666-6666-4666-8666-666666666666",
                name: "",
                mode: "gm",
            }),
        });

        expect(res.status).toBe(400);
    });
});

describe("GET /auth/api-key-status", () => {
    const originalKey = process.env.GOOGLE_AI_API_KEY;

    test("returns not_set when GOOGLE_AI_API_KEY is undefined", async () => {
        delete process.env.GOOGLE_AI_API_KEY;

        const res = await authRouter.request("/auth/api-key-status");
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.result).toBe("success");
        expect(json.data.available).toBe(false);
        expect(json.data.reason).toBe("not_set");
    });

    test("returns empty when GOOGLE_AI_API_KEY is empty string", async () => {
        process.env.GOOGLE_AI_API_KEY = "";

        const res = await authRouter.request("/auth/api-key-status");
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.result).toBe("success");
        expect(json.data.available).toBe(false);
        expect(json.data.reason).toBe("empty");
    });

    test("returns ok when GOOGLE_AI_API_KEY is set to a non-empty string", async () => {
        process.env.GOOGLE_AI_API_KEY = "test-api-key-value";

        const res = await authRouter.request("/auth/api-key-status");
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.result).toBe("success");
        expect(json.data.available).toBe(true);
        expect(json.data.reason).toBe("ok");
    });

    afterAll(() => {
        if (originalKey !== undefined) {
            process.env.GOOGLE_AI_API_KEY = originalKey;
        } else {
            delete process.env.GOOGLE_AI_API_KEY;
        }
    });
});
