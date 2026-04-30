import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createConversationSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { messagesRouter } from "./messages.js";

/**
 * Creates a conversations sub-router.
 */
export const conversationsRouter = new Hono()
    .get("/", async (c) => {
        const db = c.get("db");
        const userId = c.get("userId");
        return c.json({
            result: /** @type {"success"} */ ("success"),
            data: queries.getConversationsByUser(db, userId),
        });
    })
    .post("/", zValidator("json", createConversationSchema), async (c) => {
        const db = c.get("db");
        const userId = c.get("userId");
        const data = c.req.valid("json");
        const conv = queries.createConversation(db, { title: data.title, userId });
        return c.json({ result: /** @type {"success"} */ ("success"), data: conv }, 201);
    })
    .route("/:id", messagesRouter);
