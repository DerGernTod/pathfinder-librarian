import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createConversationSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { createMessagesRouter } from "./messages.js";

/**
 * Creates a messages sub-router with middleware applied.
 * @returns {Hono} The messages router
 */
function createMessagesRouterWithMiddleware() {
    return createMessagesRouter().use(async (c, next) => {
        const db = c.get("db");
        if (!db) {
            return c.json({ error: "Database not found" }, 500);
        }
        await next();
    });
}

/**
 * Creates a conversations sub-router.
 * @returns {Hono} The conversations router
 */
export function createConversationsRouter() {
    const messages = createMessagesRouterWithMiddleware();
    return new Hono()
        .use(async (c, next) => {
            const db = c.get("db");
            if (!db) {
                return c.json({ error: "Database not found" }, 500);
            }
            await next();
        })
        .get("/", async (c) => {
            const db = c.get("db");
            return c.json(queries.getAllConversations(db));
        })
        .post("/", zValidator("json", createConversationSchema), async (c) => {
            const data = c.req.valid("json");
            const db = c.get("db");
            const conv = queries.createConversation(db, { title: data.title, userId: data.userId });
            return c.json(conv, 201);
        })
        .route("/:id", messages);
}

// Default export for production (uses production DB from context)
const conversations = createConversationsRouter();
export { conversations as conversationsRouter };
