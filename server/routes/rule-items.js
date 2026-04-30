import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";

import { uuidSchema, ruleItemTypeSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { getDb } from "../utils/context.js";

/**
 * Creates a rule-items sub-router.
 */
export function createRuleItemsRouter() {
    return new Hono()
        .get(
            "/",
            zValidator("query", z.object({ type: ruleItemTypeSchema.optional() })),
            async (c) => {
                const db = getDb(c);
                const { type } = c.req.valid("query");
                return c.json({
                    result: /** @type {"success"} */ ("success"),
                    data: queries.getRuleItems(db, type),
                });
            },
        )
        .get("/:id", zValidator("param", z.object({ id: uuidSchema })), async (c) => {
            const db = getDb(c);
            const { id } = c.req.valid("param");
            const item = queries.getRuleItemById(db, id);
            if (!item) {
                return c.json(
                    { result: /** @type {"error"} */ ("error"), message: "Not found" },
                    404,
                );
            }
            return c.json({ result: /** @type {"success"} */ ("success"), data: item });
        });
}

// Default export for production (uses production DB from context)
const ruleItems = createRuleItemsRouter();
export { ruleItems as ruleItemsRouter };
