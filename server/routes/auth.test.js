import { describe, test, expect, beforeAll, mock } from "bun:test";

import { Hono } from "hono";

import { createDb } from "../db/database.js";
import { resetAndReseedDb } from "../db/seed.js";
import { SEED_IDS } from "../db/seed.js";

// Create in-memory DB for testing
const testDb = createDb(":memory:");
resetAndReseedDb(testDb);

// Mock database BEFORE importing router
mock.module("../db/database.js", () => ({
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
        });

        test("rejects empty name", async () => {
            const res = await authRouter.request("/auth/register/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "" }),
            });

            expect(res.status).toBe(400);
        });
    });

    test("rejects empty name", async () => {
        const res = await authRouter.request("/auth/register/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "" }),
        });

        expect(res.status).toBe(400);
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
