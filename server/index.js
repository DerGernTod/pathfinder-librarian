import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";

import { ensureTestUserSchema } from "../shared/schemas.js";
import { db } from "./db/database.js";
import * as queries from "./db/queries.js";
import { seedIfNeeded, clearAllTables, seedRuleItems, seedForUser } from "./db/seed.js";
import { databaseMiddleware } from "./middleware/database.js";
import { sessionMiddleware } from "./middleware/session.js";
import { authRouter } from "./routes/auth.js";
import { conversationsRouter } from "./routes/conversations.js";
import { ruleItemsRouter } from "./routes/rule-items.js";
import { usersRouter } from "./routes/users.js";

/** @typedef {import("../shared/hono-env.js").AppEnv} AppEnv */

// Seed database
seedIfNeeded(db);

const app = new Hono()
    // Database middleware (sets db in context for all routes)
    .use("/api/*", databaseMiddleware())
    // Auth routes (no session required for most)
    .route("/api/auth", authRouter)
    // Session-protected API routes
    .use("/api/conversations/*", sessionMiddleware())
    .use("/api/rule-items/*", sessionMiddleware())
    .route("/api/conversations", conversationsRouter)
    .route("/api/rule-items", ruleItemsRouter)
    .route("/api/users", usersRouter);

// Dev-only test endpoints
if (process.env.NODE_ENV !== "production") {
    app.post("/api/test/reset-db", async (c) => {
        clearAllTables(db);
        seedRuleItems(db);
        return c.json({ ok: true });
    });

    app.post("/api/test/ensure-test-user", zValidator("json", ensureTestUserSchema), async (c) => {
        const { userId, name, mode } = c.req.valid("json");

        // Idempotent: return existing user if found
        const existing = queries.getUserById(db, userId);
        if (existing) {
            return c.json({ result: "success", data: existing }, 200);
        }

        // Derive initials from name
        const words = name.trim().split(/\s+/);
        let initials;
        if (words.length === 1) {
            initials = words[0].substring(0, 2).toUpperCase();
        } else {
            initials = (words[0][0] + words[words.length - 1][0]).toUpperCase();
        }

        // Derive deterministic email
        const hex8 = userId.replace(/-/g, "").substring(0, 8);
        const email = `test-${hex8}@local.test`;

        // Derive subtitle from mode
        const subtitle = mode === "gm" ? "Game Master" : "Player";

        // Insert user
        db.run(
            "INSERT INTO users (id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [userId, name, initials, subtitle, mode, email, 1, userId],
        );

        // Seed conversations and messages for this user
        seedForUser(db, userId, mode);

        const user = queries.getUserById(db, userId);
        if (!user) {
            return c.json({ result: "error", message: "Failed to create user" }, 500);
        }

        return c.json({ result: "success", data: user }, 200);
    });
}

// SPA fallback — serve index.html for client-rendered routes
// Static files are served if they exist; otherwise fall back to index.html
// so deep links like /conversations/:uuid load the SPA correctly.
app.get("/", serveStatic({ path: "./client/index.html" }));
app.get("/*", async (c) => {
    const path = c.req.path;
    // oxlint-disable-next-line no-undef -- Bun is the runtime global
    const file = Bun.file(`./client${path}`);
    if (await file.exists()) {
        return new Response(file);
    }
    // oxlint-disable-next-line no-undef -- Bun is the runtime global
    const html = await Bun.file("./client/index.html").text();
    return new Response(html, {
        headers: { "Content-Type": "text/html" },
    });
});

/**
 * @typedef {typeof app} App
 */

const port = 3000;

// oxlint-disable-next-line import/no-default-export -- required by Bun
export default {
    port,
    hostname: "0.0.0.0", // Forces Bun to listen on all interfaces
    fetch: app.fetch,
};
