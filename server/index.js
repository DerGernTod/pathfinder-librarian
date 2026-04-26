import { Hono } from "hono";
import { serveStatic } from "hono/bun";

import { db } from "./db/database.js";
import { seedIfNeeded, resetAndReseedDb, SEED_IDS } from "./db/seed.js";
import { conversationsRouter } from "./routes/conversations.js";
import { ruleItemsRouter } from "./routes/rule-items.js";
import { usersRouter } from "./routes/users.js";

// Seed database
seedIfNeeded(db);

const app = new Hono()
    .route("/api/conversations", conversationsRouter)
    .route("/api/rule-items", ruleItemsRouter)
    .route("/api/users", usersRouter);

// Dev-only test reset endpoint
if (process.env.NODE_ENV !== "production") {
    app.post("/api/test/reset-db", async (c) => {
        resetAndReseedDb(db);
        return c.json({ ok: true });
    });
}

// Static file serving
app.get("/", serveStatic({ path: "./client/index.html" })).get(
    "/*",
    serveStatic({ root: "./client" }),
);

/**
 * @typedef {typeof app} App
 */

// oxlint-disable-next-line import/no-default-export -- required for running hono
export default app;

// Export SEED_IDS for use in client (specifically DEFAULT_USER_ID for creating conversations)
export { SEED_IDS };
