import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createConversationSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { getDb, getUserId } from "../utils/context.js";
import { strictParamSchema } from "./conversations-schema.js";
import { messagesRouter } from "./messages.js";

const validateStrictId = zValidator("param", strictParamSchema);

/**
 * Creates a conversations sub-router.
 */
export const conversationsRouter = new Hono()
    // ── Collection routes ──
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

    // ── Archived list — MUST be before /:id to avoid parameter capture ──
    .get("/archived", async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        return c.json({
            result: /** @type {"success"} */ ("success"),
            data: queries.getArchivedConversationsByUser(db, userId),
        });
    })

    // ── Archive/Restore/Delete — MUST be before .route("/:id", messagesRouter) ──
    // These use strictParamSchema (no __new__)
    .patch("/:id/archive", validateStrictId, async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        const { id } = c.req.valid("param");
        const conv = queries.getConversationById(db, id);
        if (!conv || conv.userId !== userId) {
            return c.json({ result: "error", message: "Not found" }, conv ? 403 : 404);
        }
        // Idempotent: no-op if already archived
        const updated = queries.archiveConversation(db, id);
        return c.json({ result: /** @type {"success"} */ ("success"), data: updated });
    })
    .patch("/:id/restore", validateStrictId, async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        const { id } = c.req.valid("param");
        const conv = queries.getConversationById(db, id);
        if (!conv || conv.userId !== userId) {
            return c.json({ result: "error", message: "Not found" }, conv ? 403 : 404);
        }
        // Idempotent: no-op if already active
        const updated = queries.restoreConversation(db, id);
        return c.json({ result: /** @type {"success"} */ ("success"), data: updated });
    })
    .delete("/:id", validateStrictId, async (c) => {
        const db = getDb(c);
        const userId = getUserId(c);
        const { id } = c.req.valid("param");
        const conv = queries.getConversationById(db, id);
        if (!conv || conv.userId !== userId) {
            return c.json({ result: "error", message: "Not found" }, conv ? 403 : 404);
        }
        queries.deleteConversation(db, id);
        return c.json({ result: /** @type {"success"} */ ("success") });
    })

    // ── Parameterized routes (messages sub-router) ──
    .route("/:id", messagesRouter);
