import { db } from "./database.js";

/**
 * Gets all conversations from the database.
 * @param {import("bun:sqlite").Database} database - The database instance (defaults to production DB)
 * @returns {Array<{ id: string, title: string, userId: string, createdAt: string }>}
 */
export function getAllConversations(database = db) {
    const rows = database
        .query("SELECT id, title, user_id, created_at FROM conversations ORDER BY created_at DESC")
        .all();
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        userId: row.user_id,
        createdAt: row.created_at,
    }));
}

/**
 * Gets a conversation by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} id - The conversation ID
 * @returns {{ id: string, title: string, userId: string, createdAt: string } | null}
 */
export function getConversationById(database, id) {
    const row = database
        .query("SELECT id, title, user_id, created_at FROM conversations WHERE id = ?")
        .get(id);
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        title: row.title,
        userId: row.user_id,
        createdAt: row.created_at,
    };
}

/**
 * Creates a new conversation.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {{ title: string, userId: string }} data - The conversation data
 * @returns {{ id: string, title: string, userId: string, createdAt: string }}
 */
export function createConversation(database, { title, userId }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    database.run("INSERT INTO conversations (id, title, user_id, created_at) VALUES (?, ?, ?, ?)", [
        id,
        title,
        userId,
        now,
    ]);
    return { id, title, userId, createdAt: now };
}

/**
 * Gets all messages for a conversation, ordered by created_at.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} conversationId - The conversation ID
 * @returns {Array<import("../../shared/types.js").Message>}
 */
export function getMessagesByConversationId(database, conversationId) {
    const rows = database
        .query(
            "SELECT id, conversation_id, role, mode, content, blocks_json, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at",
        )
        .all(conversationId);
    return rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        mode: row.mode,
        content: row.content,
        blocks: row.blocks_json ? JSON.parse(row.blocks_json) : null,
        createdAt: row.created_at,
    }));
}

/**
 * Creates a new message.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {Omit<import("../../shared/types.js").UserMessage, "id"> & { conversationId: string, content: string | null, blocksJson: string | null }} data - The message data
 * @returns {import("../../shared/types.js").UserMessage} }}
 */
export function createUserMessage(database, { conversationId, role, mode, content, blocksJson }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    database.run(
        "INSERT INTO messages (id, conversation_id, role, mode, content, blocks_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, conversationId, role, mode, content, blocksJson, now],
    );
    return {
        id,
        conversationId,
        role,
        mode,
        content,
    };
}

/**
 * Gets all rule items, optionally filtered by type.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {"monster" | "spell" | "ability"} [type] - Optional type filter
 * @returns {Array<{ id: string, type: "monster" | "spell" | "ability", name: string, data: any, createdAt: string }>}
 */
export function getRuleItems(database, type) {
    let query = "SELECT id, type, name, data_json, created_at FROM rule_items";
    const params = [];
    if (type) {
        query += " WHERE type = ?";
        params.push(type);
    }
    query += " ORDER BY name";
    const rows = database.query(query).all(...params);
    return rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        data: JSON.parse(row.data_json),
        createdAt: row.created_at,
    }));
}

/**
 * Gets a rule item by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} id - The rule item ID
 * @returns {{ id: string, type: "monster" | "spell" | "ability", name: string, data: any, createdAt: string } | null}
 */
export function getRuleItemById(database, id) {
    const row = database
        .query("SELECT id, type, name, data_json, created_at FROM rule_items WHERE id = ?")
        .get(id);
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        type: row.type,
        name: row.name,
        data: JSON.parse(row.data_json),
        createdAt: row.created_at,
    };
}

/**
 * Gets all users.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @returns {Array<{ id: string, name: string, initials: string, subtitle: string, mode: "gm" | "player" }>}
 */
export function getUsers(database = db) {
    const rows = database.query("SELECT id, name, initials, subtitle, mode FROM users").all();
    return rows;
}

/**
 * Gets a user by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} id - The user ID
 * @returns {{ id: string, name: string, initials: string, subtitle: string, mode: "gm" | "player" } | null}
 */
export function getUserById(database, id) {
    const row = database
        .query("SELECT id, name, initials, subtitle, mode FROM users WHERE id = ?")
        .get(id);
    return row || null;
}
