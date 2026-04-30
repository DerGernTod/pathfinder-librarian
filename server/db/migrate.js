/**
 * Runs database migrations to add auth-related columns and tables.
 * Cleans up expired challenges on each startup.
 * @param {import("bun:sqlite").Database} database
 */
export function migrateDb(database) {
    const userColumns = database
        .query("PRAGMA table_info(users)")
        .all()
        .map((col) => col.name);

    if (!userColumns.includes("email")) {
        database.run("ALTER TABLE users ADD COLUMN email TEXT");
    }
    if (!userColumns.includes("is_test_user")) {
        database.run("ALTER TABLE users ADD COLUMN is_test_user INTEGER NOT NULL DEFAULT 0");
    }
    if (!userColumns.includes("webauthn_user_id")) {
        database.run("ALTER TABLE users ADD COLUMN webauthn_user_id TEXT");
    }

    // Clean up expired challenges (older than 5 minutes)
    database.run("DELETE FROM challenges WHERE created_at < datetime('now', '-5 minutes')");
}
