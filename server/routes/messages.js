import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createMessageSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { getDb } from "../utils/context.js";
import { getMockResponse } from "../utils/mock-response.js";
import { paramSchema } from "./conversations-schema.js";

const validateId = zValidator("param", paramSchema);

export const messagesRouter = new Hono()
    .get("/", validateId, async (c) => {
        const db = getDb(c);
        const convId = c.req.valid("param").id;
        const conv = queries.getConversationById(db, convId);
        if (!conv) {
            return c.json({ result: /** @type {"error"} */ ("error"), message: "Not found" }, 404);
        }
        return c.json({ result: /** @type {"success"} */ ("success"), data: conv });
    })
    .get("/messages", validateId, async (c) => {
        const db = getDb(c);
        const convId = c.req.valid("param").id;
        const messagesList = queries.getMessagesByConversationId(db, convId);
        return c.json({ result: /** @type {"success"} */ ("success"), data: messagesList });
    })
    .post("/messages", validateId, zValidator("json", createMessageSchema), async (c) => {
        const db = getDb(c);
        const convId = c.req.valid("param").id;
        const data = c.req.valid("json");

        // 1. Create user message
        const userMsg = queries.createMessage(db, {
            conversationId: convId,
            role: "user",
            mode: data.mode,
            content: data.content,
            blocksJson: null,
        });

        // 2. Generate mock assistant response
        const blocks = getMockResponse();
        const assistantMsg = queries.createMessage(db, {
            conversationId: convId,
            role: "assistant",
            mode: data.mode,
            content: null,
            blocksJson: JSON.stringify(blocks),
        });

        // 3. Simulate thinking delay (500-1500ms)
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

        // 4. Return both messages
        return c.json(
            {
                result: /** @type {"success"} */ ("success"),
                data: { userMessage: userMsg, assistantMessage: assistantMsg },
            },
            201,
        );
    });
