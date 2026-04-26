import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";

import { uuidSchema, ruleItemTypeSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";

/**
 * Creates a rule-items sub-router.
 * @returns {Hono} The rule-items router
 */
export function createRuleItemsRouter() {
    return new Hono()
        .use(async (c, next) => {
            const db = c.get("db");
            if (!db) {
                return c.json({ error: "Database not found" }, 500);
            }
            await next();
        })
        .get(
            "/",
            zValidator("query", z.object({ type: ruleItemTypeSchema.optional() })),
            async (c) => {
                const { type } = c.req.valid("query");
                const db = c.get("db");
                return c.json(queries.getRuleItems(db, type));
            },
        )
        .get("/:id", zValidator("param", z.object({ id: uuidSchema })), async (c) => {
            const { id } = c.req.valid("param");
            const db = c.get("db");
            const item = queries.getRuleItemById(db, id);
            if (!item) {
                return c.json({ error: "Not found" }, 404);
            }
            return c.json(item);
        });
}

// Default export for production (uses production DB from context)
const ruleItems = createRuleItemsRouter();
export { ruleItems as ruleItemsRouter };
