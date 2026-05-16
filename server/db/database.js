import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    initials        TEXT NOT NULL,
    subtitle        TEXT NOT NULL,
    mode            TEXT NOT NULL DEFAULT 'gm' CHECK(mode IN ('gm', 'player'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    mode            TEXT NOT NULL CHECK(mode IN ('player', 'gm')),
    content         TEXT,
    blocks_json     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rule_items (
    id                TEXT PRIMARY KEY,
    type              TEXT NOT NULL CHECK(type IN ('creature', 'spell', 'melee', 'weapon', 'armor', 'equipment', 'action', 'feat', 'spellcastingEntry', 'trait', 'condition', 'effect', 'class', 'ancestry', 'heritage', 'background', 'deity', 'consumable', 'ammo', 'shield', 'hazard', 'treasure', 'backpack')),
    name              TEXT NOT NULL,
    compendium_source TEXT,
    parent_id         TEXT REFERENCES rule_items(id) ON DELETE CASCADE,
    linked_source     TEXT,
    data_json         TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credentials (
    id                       TEXT PRIMARY KEY,
    user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key               TEXT NOT NULL,
    counter                  INTEGER NOT NULL DEFAULT 0,
    device_type              TEXT NOT NULL DEFAULT 'singleDevice',
    backed_up                INTEGER NOT NULL DEFAULT 0,
    transports               TEXT,
    aaguid                   TEXT NOT NULL DEFAULT '',
    created_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS challenges (
    id          TEXT PRIMARY KEY,
    challenge   TEXT NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('registration', 'authentication', 'device-registration')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const CREATE_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rule_items_type       ON rule_items(type, name);
CREATE INDEX IF NOT EXISTS idx_rule_items_source     ON rule_items(compendium_source);
CREATE INDEX IF NOT EXISTS idx_rule_items_parent     ON rule_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_rule_items_linked     ON rule_items(linked_source);
CREATE INDEX IF NOT EXISTS idx_sessions_token       ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user        ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_user     ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_created   ON challenges(created_at);
`;

/**
 * Creates and initializes a SQLite database with the given path.
 * @param {string} dbPath - Path to the database file (use ":memory:" for in-memory)
 * @returns {Database} The initialized database instance
 */
export function createDb(dbPath) {
    // Create directory if needed (only for file-based DBs)
    if (dbPath !== ":memory:" && !dbPath.startsWith("file:")) {
        const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
        mkdirSync(dir, { recursive: true });
    }
    const db = new Database(dbPath);
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA journal_mode=WAL");
    db.exec(CREATE_TABLES_SQL);
    // Run migrations to add new columns and clean up expired challenges
    const { migrateDb } = require("./migrate.js");
    migrateDb(db);
    db.exec(CREATE_INDEXES_SQL);
    return db;
}

// Production singleton
export const db = createDb("data/dev.sqlite");
