import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createConversationSchema } from "../../shared/schemas.js";
import { db } from "../db/database.js";
import * as queries from "../db/queries.js";
import { messagesRouter } from "./messages.js";

/**
 * Creates a conversations sub-router.
 */
export const conversationsRouter = new Hono()
    .get("/", async (c) => {
        return c.json({
            result: /** @type {"success"} */ ("success"),
            data: queries.getAllConversations(db),
        });
    })
    .post("/", zValidator("json", createConversationSchema), async (c) => {
        const data = c.req.valid("json");
        const conv = queries.createConversation(db, { title: data.title, userId: data.userId });
        return c.json({ result: /** @type {"success"} */ ("success"), data: conv }, 201);
    })
    .route("/:id", messagesRouter);
