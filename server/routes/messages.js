import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";

import { createMessageSchema, conversationIdSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";

/**
 * Creates a messages sub-router.
 * @returns {Hono} The messages router
 */
export function createMessagesRouter() {
    return new Hono()
        .get(zValidator("param", z.object({ id: conversationIdSchema })), async (c) => {
            const { id } = c.req.valid("param");
            const db = c.get("db");
            const conv = queries.getConversationById(db, id);
            if (!conv) {
                return c.json({ error: "Not found" }, 404);
            }
            return c.json(conv);
        })
        .get("/messages", async (c) => {
            const convId = c.req.param("id");
            const db = c.get("db");
            const msgs = queries.getMessagesByConversationId(db, convId);
            return c.json(msgs);
        })
        .post("/messages", zValidator("json", createMessageSchema), async (c) => {
            const convId = c.req.param("id");
            const data = c.req.valid("json");
            const db = c.get("db");
            const msg = queries.createMessage(db, {
                conversationId: convId,
                role: "user",
                mode: data.mode,
                content: data.content,
                blocksJson: null,
            });
            return c.json(msg, 201);
        });
}

// Default export for production (uses production DB from context)
const messages = createMessagesRouter();
export { messages as messagesRouter };
