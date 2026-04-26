import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";

import { uuidSchema } from "../../shared/schemas.js";
import { db } from "../db/database.js";
import * as queries from "../db/queries.js";

/**
 * Creates a users sub-router.
 */
export function createUsersRouter() {
    return new Hono()
        .get("/", async (c) => {
            return c.json({ result: "success", data: queries.getUsers(db) });
        })
        .get("/:id", zValidator("param", z.object({ id: uuidSchema })), async (c) => {
            const { id } = c.req.valid("param");
            const user = queries.getUserById(db, id);
            if (!user) {
                return c.json(
                    { result: /** @type {"error"} */ ("error"), message: "Not found" },
                    404,
                );
            }
            return c.json({ result: /** @type {"success"} */ ("success"), data: user });
        });
}

// Default export for production (uses production DB from context)
const users = createUsersRouter();
export { users as usersRouter };
