import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createMessageSchema } from "../../shared/schemas.js";
import { db } from "../db/database.js";
import * as queries from "../db/queries.js";
import { paramSchema } from "./conversations-schema.js";

const validateId = zValidator("param", paramSchema);

export const messagesRouter = new Hono()
    .get("/", validateId, async (c) => {
        const convId = c.req.valid("param").id;
        const conv = queries.getConversationById(db, convId);
        if (!conv) {
            return c.json({ result: /** @type {"error"} */ ("error"), message: "Not found" }, 404);
        }
        return c.json({ result: /** @type {"success"} */ ("success"), data: conv });
    })
    .get("/messages", validateId, async (c) => {
        const convId = c.req.valid("param").id;
        const messagesList = queries.getMessagesByConversationId(db, convId);
        return c.json({ result: /** @type {"success"} */ ("success"), data: messagesList });
    })
    .post("/messages", validateId, zValidator("json", createMessageSchema), async (c) => {
        const convId = c.req.valid("param").id;
        const data = c.req.valid("json");
        const msg = queries.createUserMessage(db, {
            conversationId: convId,
            role: "user",
            mode: data.mode,
            content: data.content,
            blocksJson: null,
        });
        return c.json({ result: /** @type {"success"} */ ("success"), data: msg }, 201);
    });
