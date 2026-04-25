import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import z from "zod";

import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from "../client/utils/mock-data.js";
import {
    conversationIdSchema,
    createConversationSchema,
    createMessageSchema,
} from "../shared/schemas.js";

const app = new Hono()
    .get("/api/conversations", (c) => {
        return c.json(MOCK_CONVERSATIONS);
    })
    .get(
        "/api/conversations/:id/messages",
        zValidator("param", z.object({ id: conversationIdSchema })),
        (c) => {
            const { id } = c.req.valid("param");
            const messages = MOCK_MESSAGES.filter((message) => message.conversationId === id);
            return c.json(messages);
        },
    )
    .post("/api/conversations", zValidator("json", createConversationSchema), (c) => {
        const data = c.req.valid("json");
        const newConversation = {
            id: String(MOCK_CONVERSATIONS.length + 1),
            title: data.title,
        };
        MOCK_CONVERSATIONS.push(newConversation);
        return c.json(newConversation, 201);
    })
    .post(
        "/api/conversations/:id/messages",
        zValidator("param", z.object({ id: conversationIdSchema })),
        zValidator("json", createMessageSchema),
        (c) => {
            const { id } = c.req.valid("param");
            const data = c.req.valid("json");
            /** @type {{ id: string, role: "user", content: string, mode: "player" | "gm", conversationId: string }} */
            const newMessage = {
                id: String(MOCK_MESSAGES.length + 1),
                role: "user",
                content: data.content,
                mode: data.mode,
                conversationId: id,
            };
            MOCK_MESSAGES.push(newMessage);
            return c.json(newMessage, 201);
        },
    )
    .get("/api/query", zValidator("query", z.object({ foo: z.string() })), (c) => {
        return c.json({ message: "Hello, World... oh!" + c.req.valid("query").foo });
    })
    .get("/", serveStatic({ path: "./client/index.html" }))
    .get("/*", serveStatic({ root: "./client" }));

/**
 * @typedef {typeof app} App
 */

// oxlint-disable-next-line import/no-default-export -- required for running hono
export default app;
