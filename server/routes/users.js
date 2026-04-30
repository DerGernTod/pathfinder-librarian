import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";

import { uuidSchema, updateUserSchema } from "../../shared/schemas.js";
import * as queries from "../db/queries.js";
import { sessionMiddleware } from "../middleware/session.js";

/**
 * Creates a users sub-router.
 */
export function createUsersRouter() {
    return (
        new Hono()
            // /me routes FIRST — before /:id to avoid "me" matching as a UUID param
            .get("/me", sessionMiddleware(), async (c) => {
                const db = c.get("db");
                const userId = c.get("userId");
                const user = queries.getUserById(db, userId);
                return c.json({
                    result: "success",
                    data: {
                        id: user.id,
                        name: user.name,
                        initials: user.initials,
                        subtitle: user.subtitle,
                        mode: user.mode,
                        email: user.email,
                        isTestUser: user.is_test_user === 1,
                        webauthnUserId: user.webauthn_user_id,
                    },
                });
            })
            .put("/me", sessionMiddleware(), zValidator("json", updateUserSchema), async (c) => {
                const db = c.get("db");
                const userId = c.get("userId");
                const data = c.req.valid("json");
                queries.updateUser(db, userId, data);
                const updated = queries.getUserById(db, userId);
                return c.json({
                    result: "success",
                    data: {
                        id: updated.id,
                        name: updated.name,
                        initials: updated.initials,
                        subtitle: updated.subtitle,
                        mode: updated.mode,
                        email: updated.email,
                        isTestUser: updated.is_test_user === 1,
                        webauthnUserId: updated.webauthn_user_id,
                    },
                });
            })
            .delete("/me", sessionMiddleware(), async (c) => {
                const db = c.get("db");
                const userId = c.get("userId");
                queries.deleteSessionsByUser(db, userId);
                queries.deleteUser(db, userId);
                // Foreign keys cascade: credentials, conversations → messages deleted automatically
                return c.json({ result: "success" });
            })
            // /:id routes AFTER /me
            .get("/", async (c) => {
                const db = c.get("db");
                return c.json({ result: "success", data: queries.getUsers(db) });
            })
            .get("/:id", zValidator("param", z.object({ id: uuidSchema })), async (c) => {
                const db = c.get("db");
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
