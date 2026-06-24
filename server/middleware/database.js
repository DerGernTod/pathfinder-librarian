import { db as defaultDb } from "../db/database.js";

/**
 * Hono middleware that sets the database instance and vector store in context.
 * This allows tests to override either without mocking.
 * @param {{ database?: import("bun:sqlite").Database, vectorStore?: import("../utils/vector-store.js").VectorStore | null }} options - If database is provided, uses that instead of default db.
 */
export function databaseMiddleware(options = {}) {
    const database = options.database || defaultDb;
    const vectorStore = options.vectorStore ?? null;

    return async (
        /** @type {import("hono").Context} */ c,
        /** @type {import("hono").Next} */ next,
    ) => {
        c.set("db", database);
        c.set("vectorStore", vectorStore);
        return next();
    };
}
