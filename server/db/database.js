import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    initials   TEXT NOT NULL,
    subtitle   TEXT NOT NULL,
    mode       TEXT NOT NULL DEFAULT 'gm' CHECK(mode IN ('gm', 'player'))
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
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL CHECK(type IN ('monster', 'spell', 'ability')),
    name       TEXT NOT NULL,
    data_json  TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const CREATE_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rule_items_type       ON rule_items(type, name);
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
    db.exec(CREATE_TABLES_SQL);
    db.exec(CREATE_INDEXES_SQL);
    return db;
}

// Production singleton
export const db = createDb("data/dev.sqlite");
