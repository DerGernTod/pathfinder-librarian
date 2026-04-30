import { db as defaultDb } from "../db/database.js";

/**
 * Hono middleware that sets the database instance in context.
 * This allows tests to override the database without mocking.
 * @param {{ database?: import("bun:sqlite").Database }} options - If database is provided, uses that instead of default db.
 */
export function databaseMiddleware(options = {}) {
    const database = options.database || defaultDb;

    return async (c, next) => {
        c.set("db", database);
        return next();
    };
}
