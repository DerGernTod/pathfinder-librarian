import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";

import { uuidSchema, updateUserSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { sessionMiddleware } from "../middleware/session.js";
import { getDb, getUserId } from "../utils/context.js";

/**
 * Creates a users sub-router.
 */
export function createUsersRouter() {
    return (
        new Hono()
            // /me routes FIRST — before /:id to avoid "me" matching as a UUID param
            .get("/me", sessionMiddleware(), async (c) => {
                const db = getDb(c);
                const userId = getUserId(c);
                const user = queries.getUserById(db, userId);
                return c.json({
                    result: "success",
                    data: user,
                });
            })
            .put("/me", sessionMiddleware(), zValidator("json", updateUserSchema), async (c) => {
                const db = getDb(c);
                const userId = getUserId(c);
                const data =
                    /** @type {{ name?: string, mode?: "gm" | "player", subtitle?: string }} */ (
                        c.req.valid("json")
                    );
                queries.updateUser(db, userId, data);
                const updated = queries.getUserById(db, userId);
                return c.json({
                    result: "success",
                    data: updated,
                });
            })
            .delete("/me", sessionMiddleware(), async (c) => {
                const db = getDb(c);
                const userId = getUserId(c);
                queries.deleteSessionsByUser(db, userId);
                queries.deleteUser(db, userId);
                // Foreign keys cascade: credentials, conversations → messages deleted automatically
                return c.json({ result: "success" });
            })
            // /:id routes AFTER /me
            .get("/", async (c) => {
                const db = getDb(c);
                return c.json({ result: "success", data: queries.getUsers(db) });
            })
            .get("/:id", zValidator("param", z.object({ id: uuidSchema })), async (c) => {
                const db = getDb(c);
                const { id } = c.req.valid("param");
                const user = queries.getUserById(db, id);
                if (!user) {
                    return c.json(
                        { result: /** @type {"error"} */ ("error"), message: "Not found" },
                        404,
                    );
                }
                return c.json({ result: /** @type {"success"} */ ("success"), data: user });
            })
    );
}

// Default export for production (uses production DB from context)
const users = createUsersRouter();
export { users as usersRouter };
