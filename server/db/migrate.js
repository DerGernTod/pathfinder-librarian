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

    // Check columns BEFORE _migrateRuleItemsConstraint (which may recreate the table)
    const ruleItemColumns = database
        .query("PRAGMA table_info(rule_items)")
        .all()
        .map((col) => col.name);
    if (!ruleItemColumns.includes("compendium_source")) {
        database.run("ALTER TABLE rule_items ADD COLUMN compendium_source TEXT");
    }

    // (Moved below)

    // Migration: expand CHECK constraint by recreating table
    // SQLite cannot ALTER CONSTRAINT, so use create-new / copy-data / drop-old / rename pattern
    _migrateRuleItemsConstraint(database);

    // Migration: add parent_id and linked_source columns for parent-child relationships
    if (!ruleItemColumns.includes("parent_id")) {
        database.run(
            "ALTER TABLE rule_items ADD COLUMN parent_id TEXT REFERENCES rule_items(id) ON DELETE CASCADE",
        );
    }
    if (!ruleItemColumns.includes("linked_source")) {
        database.run("ALTER TABLE rule_items ADD COLUMN linked_source TEXT");
    }

    // Create indexes for parent-child and crosslink columns
    database.run("CREATE INDEX IF NOT EXISTS idx_rule_items_parent ON rule_items(parent_id)");
    database.run("CREATE INDEX IF NOT EXISTS idx_rule_items_linked ON rule_items(linked_source)");

    // Migration: monster → creature type rename
    database.run("UPDATE rule_items SET type = 'creature' WHERE type = 'monster'");

    // Clean up expired challenges (older than 5 minutes)
    database.run("DELETE FROM challenges WHERE created_at < datetime('now', '-5 minutes')");
}

/**
 * Migrates the rule_items table to expand the CHECK constraint.
 * Uses the create-new / copy-data / drop-old / rename pattern.
 * @param {import("bun:sqlite").Database} database
 */
function _migrateRuleItemsConstraint(database) {
    // Check if the table already has the new constraint by inspecting the SQL
    const tableInfo = database
        .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'rule_items'")
        .get();
    if (!tableInfo) {
        return;
    }
    const sql = /** @type {string} */ (tableInfo.sql);
    // If the constraint already includes 'backpack', no migration needed
    if (sql.includes("'backpack'")) {
        return;
    }

    // If a previous migration was interrupted, rule_items_old may still exist
    database.run("DROP TABLE IF EXISTS rule_items_old");
    database.run("ALTER TABLE rule_items RENAME TO rule_items_old");
    database.run(`
        CREATE TABLE rule_items (
            id                TEXT PRIMARY KEY,
            type              TEXT NOT NULL CHECK(type IN ('creature', 'spell', 'melee', 'weapon', 'armor', 'equipment', 'action', 'feat', 'spellcastingEntry', 'trait', 'condition', 'effect', 'class', 'ancestry', 'heritage', 'background', 'deity', 'consumable', 'ammo', 'shield', 'hazard', 'treasure', 'backpack')),
            name              TEXT NOT NULL,
            compendium_source TEXT,
            parent_id         TEXT REFERENCES rule_items(id) ON DELETE CASCADE,
            linked_source     TEXT,
            data_json         TEXT NOT NULL,
            created_at        TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    database.run(`
        INSERT INTO rule_items (id, type, name, compendium_source, parent_id, linked_source, data_json, created_at)
        SELECT id, CASE WHEN type = 'monster' THEN 'creature' ELSE type END, name, compendium_source, parent_id, linked_source, data_json, created_at FROM rule_items_old
    `);
    database.run("DROP TABLE rule_items_old");
    database.run("CREATE INDEX IF NOT EXISTS idx_rule_items_type ON rule_items(type, name)");
    database.run(
        "CREATE INDEX IF NOT EXISTS idx_rule_items_source ON rule_items(compendium_source)",
    );
}
