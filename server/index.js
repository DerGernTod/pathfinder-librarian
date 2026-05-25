import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
import { setForcedMockIndexForUser } from "./utils/mock-response.js";
import { openVectorDb } from "./utils/vector-store.js";

/** @typedef {import("../shared/hono-env.js").AppEnv} AppEnv */

// Seed database
seedIfNeeded(db);

// Initialize vector DB
const vectorDb = openVectorDb();
if (vectorDb) {
    const chunkCount = Number(
        vectorDb.query("SELECT COUNT(*) as count FROM vector_chunks").get().count,
    );
    // oxlint-disable-next-line no-console -- startup diagnostic
    console.log(`Vector DB loaded: ${chunkCount} chunks available`);
} else {
    // oxlint-disable-next-line no-console -- startup diagnostic
    console.log("Vector DB not found at data/vectors.sqlite — RAG context retrieval disabled");
}

// --- Read package.json version at module load ---
const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const packageJson = /** @type {{ version: string }} */ (
    JSON.parse(readFileSync(packageJsonPath, "utf-8"))
);
const APP_VERSION = packageJson.version;

const app = new Hono()
    // Database middleware (sets db and vectorDb in context for all routes)
    .use("/api/*", databaseMiddleware({ vectorDb }))
    // Auth routes (no session required for most)
    .route("/api/auth", authRouter)
    // Session-protected API routes
    .use("/api/conversations/*", sessionMiddleware())
    .use("/api/rule-items/*", sessionMiddleware())
    .route("/api/conversations", conversationsRouter)
    .route("/api/rule-items", ruleItemsRouter)
    .route("/api/users", usersRouter)
    // --- Public version endpoint (no auth required) ---
    .get("/api/version", (c) => {
        return c.json({ result: "success", data: { version: APP_VERSION } });
    });

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

    // Pin (or release) the mock response index so Playwright tests can force a
    // deterministic assistant response. Pass { index: null } to restore random
    // selection. Has no effect when a real LLM API key is configured.
    app.post("/api/test/set-mock-response", async (c) => {
        const body = /** @type {{ userId?: unknown, index?: unknown }} */ (await c.req.json());
        const userId = typeof body.userId === "string" ? body.userId : null;
        const index = typeof body.index === "number" ? body.index : null;
        if (userId) {
            setForcedMockIndexForUser(userId, index);
        }
        return c.json({ ok: true });
    });
}

// SPA fallback — serve index.html for client-rendered routes
// Explicit deep-link routes registered before wildcard catch-all.
// Static files with known extensions are served directly.
// Everything else gets index.html so deep links like
// /conversations/:uuid load the SPA correctly.

// Resolve paths relative to this module's directory (server/)
// to avoid working-directory mismatches in deployed environments.
const clientDir = import.meta.dir + "/../client";

/** @type {string | null} */
let _indexHtml = null;

/**
 * Load index.html content once (cached).
 * @returns {Promise<string>}
 */
async function getIndexHtml() {
    if (_indexHtml !== null) {
        return _indexHtml;
    }
    // oxlint-disable-next-line no-undef -- Bun is the runtime global
    _indexHtml = await Bun.file(clientDir + "/index.html").text();
    return _indexHtml;
}

app.get("/conversations/:conversationId", async (c) => {
    return c.html(await getIndexHtml());
});

app.get("/", serveStatic({ path: "./client/index.html" }));
app.get("/*", async (c) => {
    const path = c.req.path;
    // Serve actual static files (JS, CSS, images, fonts, etc.)
    if (/\.\w+$/.test(path)) {
        // oxlint-disable-next-line no-undef -- Bun is the runtime global
        const file = Bun.file(clientDir + path);
        if (await file.exists()) {
            return new Response(file);
        }
    }
    // SPA fallback for everything else
    return c.html(await getIndexHtml());
});

/**
 * @typedef {typeof app} App
 */

const port = 3000;

// oxlint-disable-next-line import/no-default-export -- required by Bun
export default {
    port,
    idleTimeout: 0, // disables timeout for long-running requests (like RAG with a slow LLM response or 30s delay when google fails)
    hostname: "0.0.0.0", // Forces Bun to listen on all interfaces
    fetch: app.fetch,
};
