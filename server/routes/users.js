import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";

import { uuidSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";

/**
 * Creates a users sub-router.
 * @returns {Hono} The users router
 */
export function createUsersRouter() {
    return new Hono()
        .use(async (c, next) => {
            const db = c.get("db");
            if (!db) {
                return c.json({ error: "Database not found" }, 500);
            }
            await next();
        })
        .get("/", async (c) => {
            const db = c.get("db");
            return c.json(queries.getUsers(db));
        })
        .get("/:id", zValidator("param", z.object({ id: uuidSchema })), async (c) => {
            const { id } = c.req.valid("param");
            const db = c.get("db");
            const user = queries.getUserById(db, id);
            if (!user) {
                return c.json({ error: "Not found" }, 404);
            }
            return c.json(user);
        });
}

// Default export for production (uses production DB from context)
const users = createUsersRouter();
export { users as usersRouter };
