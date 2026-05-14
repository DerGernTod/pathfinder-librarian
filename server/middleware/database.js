import { db as defaultDb } from "../db/database.js";

/**
 * Hono middleware that sets the database instance in context.
 * This allows tests to override the database without mocking.
 * @param {{ database?: import("bun:sqlite").Database, vectorDb?: import("bun:sqlite").Database | null }} options - If database is provided, uses that instead of default db.
 */
export function databaseMiddleware(options = {}) {
    const database = options.database || defaultDb;
    const vectorDb = options.vectorDb ?? null;

    return async (
        /** @type {import("hono").Context} */ c,
        /** @type {import("hono").Next} */ next,
    ) => {
        c.set("db", database);
        c.set("vectorDb", vectorDb);
        return next();
    };
}
