import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createConversationSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { getDb, getUserId } from "../utils/context.js";
import { messagesRouter } from "./messages.js";

/**
 * Creates a conversations sub-router.
 */
export const conversationsRouter = new Hono()
    .get("/", async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        return c.json({
            result: /** @type {"success"} */ ("success"),
            data: queries.getConversationsByUser(db, userId),
        });
    })
    .post("/", zValidator("json", createConversationSchema), async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        const data = c.req.valid("json");
        const conv = queries.createConversation(db, { title: data.title, userId });
        return c.json({ result: /** @type {"success"} */ ("success"), data: conv }, 201);
    })
    .route("/:id", messagesRouter);
