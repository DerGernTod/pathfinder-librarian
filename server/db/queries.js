import { z } from "zod";

import { db } from "./database.js";

const ConversationSchema = z
    .object({
        id: z.string(),
        title: z.string(),
        user_id: z.string(),
        created_at: z.string(),
    })
    .transform((row) => ({
        id: row.id,
        title: row.title,
        userId: row.user_id,
        createdAt: row.created_at,
    }));

const ConversationListSchema = z.array(ConversationSchema);

const MessageSchema = z
    .object({
        id: z.string(),
        conversation_id: z.string(),
        role: z.enum(["user", "assistant"]),
        mode: z.enum(["player", "gm"]),
        content: z.string().nullable(),
        blocks_json: z.string().nullable(),
        created_at: z.string(),
    })
    .transform((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        mode: row.mode,
        content: row.content,
        blocks: row.blocks_json ? /** @type {unknown} */ (JSON.parse(row.blocks_json)) : null,
        createdAt: row.created_at,
    }));

const MessageItemListSchema = z.array(MessageSchema);

const RuleItemSchema = z
    .object({
        id: z.string(),
        type: z.enum(["monster", "spell", "ability"]),
        name: z.string(),
        data_json: z.string(),
        created_at: z.string(),
    })
    .transform((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        data: /** @type {unknown} */ (JSON.parse(row.data_json)),
        createdAt: row.created_at,
    }));

const RuleItemListSchema = z.array(RuleItemSchema);

export const UserSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        initials: z.string(),
        subtitle: z.string(),
        mode: z.enum(["gm", "player"]),
        email: z.email().nullable(),
        is_test_user: z.number().optional(),
        webauthn_user_id: z.string().optional(),
        webauthnUserId: z.string().optional(), // For output only, not stored in DB
        isTestUser: z.boolean().optional(), // For output only, not stored in DB
    })
    .transform((user) => ({
        ...user,
        webauthnUserId: user["webauthn_user_id"] || undefined,
        isTestUser: user["is_test_user"] === 1 || false,
    }));

const UserListSchema = z.array(UserSchema);

const ChallengeSchema = z
    .object({
        id: z.string(),
        challenge: z.string(),
        type: z.enum(["registration", "authentication", "device-registration"]),
        created_at: z.string(),
    })
    .transform((row) => ({
        id: row.id,
        challenge: row.challenge,
        type: row.type,
        createdAt: row.created_at,
    }));

export const CredentialSchema = z
    .object({
        id: z.string(),
        user_id: z.string(),
        public_key: z.string(),
        counter: z.number(),
        device_type: z.string(),
        backed_up: z.number(),
        transports: z
            .string()
            .nullable()
            .transform((val) => (val ? z.array(z.string()).parse(JSON.parse(val)) : null)),
        aaguid: z.string(),
        created_at: z.string(),
    })
    .transform((row) => ({
        id: row.id,
        userId: row.user_id,
        publicKey: row.public_key,
        counter: row.counter,
        deviceType: row.device_type,
        backedUp: row.backed_up === 1,
        transports: row.transports,
        aaguid: row.aaguid,
        createdAt: row.created_at,
    }));

export const CredentialListSchema = z.array(CredentialSchema);

export const DeviceSchema = z
    .object({
        id: z.string(),
        device_type: z.string(),
        backed_up: z.number(),
        created_at: z.string(),
    })
    .transform((row) => ({
        id: row.id,
        deviceType: row.device_type,
        backedUp: row.backed_up === 1,
        createdAt: row.created_at,
    }));

export const DeviceListSchema = z.array(DeviceSchema);

/**
 * Gets all conversations from the database.
 * @param {import("bun:sqlite").Database} database - The database instance (defaults to production DB)
 * @returns {z.infer<typeof ConversationListSchema>}
 */
export function getAllConversations(database = db) {
    /** @type {unknown} */
    const rows = database
        .query("SELECT id, title, user_id, created_at FROM conversations ORDER BY created_at DESC")
        .all();

    return ConversationListSchema.parse(rows);
}

/**
 * Gets a conversation by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} id - The conversation ID
 * @returns {z.infer<typeof ConversationSchema> | null}
 */
export function getConversationById(database, id) {
    /** @type {unknown} */
    const row = database
        .query("SELECT id, title, user_id, created_at FROM conversations WHERE id = ?")
        .get(id);
    if (!row) {
        return null;
    }
    return ConversationSchema.parse(row);
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
 * @returns {z.infer<typeof MessageItemListSchema>}
 */
export function getMessagesByConversationId(database, conversationId) {
    /** @type {unknown} */
    const rows = database
        .query(
            "SELECT id, conversation_id, role, mode, content, blocks_json, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at",
        )
        .all(conversationId);
    return MessageItemListSchema.parse(rows);
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
 * @returns {z.infer<typeof RuleItemListSchema>}
 */
export function getRuleItems(database, type) {
    let query = "SELECT id, type, name, data_json, created_at FROM rule_items";
    const params = [];
    if (type) {
        query += " WHERE type = ?";
        params.push(type);
    }
    query += " ORDER BY name";
    /** @type {unknown} */
    const rows = database.query(query).all(...params);
    return RuleItemListSchema.parse(rows);
}

/**
 * Gets a rule item by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} id - The rule item ID
 * @returns {z.infer<typeof RuleItemSchema> | null}
 */
export function getRuleItemById(database, id) {
    /** @type {unknown} */
    const row = database
        .query("SELECT id, type, name, data_json, created_at FROM rule_items WHERE id = ?")
        .get(id);
    if (!row) {
        return null;
    }
    return RuleItemSchema.parse(row);
}

/**
 * Gets all users.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @returns {z.infer<typeof UserListSchema>}
 */
export function getUsers(database = db) {
    /** @type {unknown} */
    const rows = database
        .query(
            "SELECT id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id FROM users",
        )
        .all();
    return UserListSchema.parse(rows);
}

/**
 * Gets a user by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} id - The user ID
 * @returns {z.infer<typeof UserSchema> | null}
 */
export function getUserById(database, id) {
    /** @type {unknown} */
    const row = database
        .query(
            "SELECT id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id FROM users WHERE id = ?",
        )
        .get(id);
    if (!row) {
        return null;
    }
    return UserSchema.parse(row);
}

/**
 * Gets conversations for a specific user.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} userId - The user ID
 * @returns {z.infer<typeof ConversationListSchema>}
 */
export function getConversationsByUser(database, userId) {
    const rows = database
        .query(
            "SELECT id, title, user_id, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC",
        )
        .all(userId);
    return ConversationListSchema.parse(rows);
}

// Session queries

const SessionSchema = z
    .object({
        id: z.string(),
        user_id: z.string(),
        token: z.string(),
        created_at: z.string(),
        expires_at: z.string(),
    })
    .transform((session) => ({
        id: session.id,
        userId: session["user_id"],
        token: session.token,
        createdAt: session["created_at"],
        expiresAt: session["expires_at"],
    }));

/**
 * Creates a new session.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {{ userId: string, token: string, expiresAt: string }} data - Session data
 * @returns {z.infer<typeof SessionSchema>}
 */
export function createSession(database, { userId, token, expiresAt }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    database.run(
        "INSERT INTO sessions (id, user_id, token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        [id, userId, token, now, expiresAt],
    );
    return { id, userId, token, createdAt: now, expiresAt };
}

/**
 * Gets a session by token.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} token - The session token
 * @returns {z.infer<typeof SessionSchema> | null}
 */
export function getSessionByToken(database, token) {
    /** @type {unknown} */
    const row = database
        .query("SELECT id, user_id, token, created_at, expires_at FROM sessions WHERE token = ?")
        .get(token);
    if (!row) {
        return null;
    }
    return SessionSchema.parse(row);
}

/**
 * Deletes a session by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} sessionId - The session ID
 */
export function deleteSession(database, sessionId) {
    database.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
}

/**
 * Deletes all sessions for a user.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} userId - The user ID
 */
export function deleteSessionsByUser(database, userId) {
    database.run("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

/**
 * Refreshes a session's expiration time.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} sessionId - The session ID
 * @param {{ newExpiresAt: string }} data - New expiration time
 */
export function refreshSession(database, sessionId, { newExpiresAt }) {
    database.run("UPDATE sessions SET expires_at = ? WHERE id = ?", [newExpiresAt, sessionId]);
}

// Credential queries

/**
 * Creates a new credential.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {{ id: string, userId: string, publicKey: string, counter: number, deviceType: string, backedUp: boolean, transports: string[] | null, aaguid: string }} data - Credential data
 * @returns {{ id: string, userId: string, publicKey: string, counter: number, deviceType: string, backedUp: boolean, transports: string[] | null, aaguid: string, createdAt: string }}
 */
export function createCredential(
    database,
    { id, userId, publicKey, counter, deviceType, backedUp, transports, aaguid },
) {
    const now = new Date().toISOString();
    const transportsJson = transports ? JSON.stringify(transports) : null;
    database.run(
        "INSERT INTO credentials (id, user_id, public_key, counter, device_type, backed_up, transports, aaguid, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, userId, publicKey, counter, deviceType, backedUp ? 1 : 0, transportsJson, aaguid, now],
    );
    return {
        id,
        userId,
        publicKey,
        counter,
        deviceType,
        backedUp,
        transports,
        aaguid,
        createdAt: now,
    };
}

/**
 * Gets all credentials for a user.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} userId - The user ID
 * @returns {z.infer<typeof CredentialListSchema>}
 */
export function getCredentialsByUser(database, userId) {
    /** @type {unknown} */
    const rows = database
        .query(
            "SELECT id, user_id, public_key, counter, device_type, backed_up, transports, aaguid, created_at FROM credentials WHERE user_id = ?",
        )
        .all(userId);
    return CredentialListSchema.parse(rows);
}

/**
 * Gets a credential by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} credentialId - The credential ID
 * @returns {z.infer<typeof CredentialSchema> | null}
 */
export function getCredentialById(database, credentialId) {
    /** @type {unknown} */
    const row = database
        .query(
            "SELECT id, user_id, public_key, counter, device_type, backed_up, transports, aaguid, created_at FROM credentials WHERE id = ?",
        )
        .get(credentialId);
    if (!row) {
        return null;
    }
    return CredentialSchema.parse(row);
}

/**
 * Updates a credential's counter.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} credentialId - The credential ID
 * @param {number} newCounter - The new counter value
 */
export function updateCredentialCounter(database, credentialId, newCounter) {
    database.run("UPDATE credentials SET counter = ? WHERE id = ?", [newCounter, credentialId]);
}

/**
 * Deletes a credential by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} credentialId - The credential ID
 */
export function deleteCredential(database, credentialId) {
    database.run("DELETE FROM credentials WHERE id = ?", [credentialId]);
}

// Challenge queries

/**
 * Creates a new challenge.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {{ challenge: string, type: "registration" | "authentication" | "device-registration" }} data - Challenge data
 * @returns {z.infer<typeof ChallengeSchema>}
 */
export function createChallenge(database, { challenge, type }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    database.run("INSERT INTO challenges (id, challenge, type, created_at) VALUES (?, ?, ?, ?)", [
        id,
        challenge,
        type,
        now,
    ]);
    return { id, challenge, type, createdAt: now };
}

/**
 * Gets a challenge by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} challengeId - The challenge ID
 * @returns {z.infer<typeof ChallengeSchema> | null}
 */
export function getChallengeById(database, challengeId) {
    /** @type {unknown} */
    const row = database
        .query("SELECT id, challenge, type, created_at FROM challenges WHERE id = ?")
        .get(challengeId);
    if (!row) {
        return null;
    }
    return ChallengeSchema.parse(row);
}

/**
 * Deletes a challenge by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} challengeId - The challenge ID
 */
export function deleteChallenge(database, challengeId) {
    database.run("DELETE FROM challenges WHERE id = ?", [challengeId]);
}

/**
 * Cleans up expired challenges.
 * @param {import("bun:sqlite").Database} database - The database instance
 */
export function cleanExpiredChallenges(database) {
    database.run("DELETE FROM challenges WHERE created_at < datetime('now', '-5 minutes')");
}

// User queries (additions)

/**
 * Creates a new user.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {{ name: string, initials: string, subtitle: string, mode: "gm" | "player", email: string | null, isTestUser: boolean }} data - User data
 * @returns {z.infer<typeof UserSchema>}
 */
export function createUser(database, { name, initials, subtitle, mode, email, isTestUser }) {
    const id = crypto.randomUUID();
    database.run(
        "INSERT INTO users (id, name, initials, subtitle, mode, email, is_test_user) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, name, initials, subtitle, mode, email, isTestUser ? 1 : 0],
    );
    return { id, name, initials, subtitle, mode, email, isTestUser, webauthnUserId: undefined };
}

/**
 * Gets a user by email (case-insensitive).
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} email - The email address
 * @returns {z.infer<typeof UserSchema> | null}
 */
export function getUserByEmail(database, email) {
    /** @type {unknown} */
    const row = database
        .query(
            "SELECT id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id FROM users WHERE LOWER(email) = LOWER(?)",
        )
        .get(email);
    if (!row) {
        return null;
    }
    return UserSchema.parse(row);
}

/**
 * Gets a user by WebAuthn user ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} webauthnUserId - The WebAuthn user ID
 * @returns {z.infer<typeof UserSchema> | null}
 */
export function getUserByWebauthnUserId(database, webauthnUserId) {
    /** @type {unknown} */
    const row = database
        .query(
            "SELECT id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id FROM users WHERE webauthn_user_id = ?",
        )
        .get(webauthnUserId);
    if (!row) {
        return null;
    }
    return UserSchema.parse(row);
}

/**
 * Updates a user.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} id - The user ID
 * @param {{ name?: string, mode?: "gm" | "player", subtitle?: string }} data - User data to update
 */
export function updateUser(database, id, { name, mode, subtitle }) {
    const updates = [];
    const params = [];
    if (name !== undefined) {
        updates.push("name = ?");
        params.push(name);
    }
    if (mode !== undefined) {
        updates.push("mode = ?");
        params.push(mode);
    }
    if (subtitle !== undefined) {
        updates.push("subtitle = ?");
        params.push(subtitle);
    }
    if (updates.length === 0) {
        return;
    }
    params.push(id);
    database.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
}

/**
 * Deletes a user by ID.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} id - The user ID
 */
export function deleteUser(database, id) {
    database.run("DELETE FROM users WHERE id = ?", [id]);
}

/**
 * Checks if a user has any credentials.
 * @param {import("bun:sqlite").Database} database - The database instance
 * @param {string} userId - The user ID
 * @returns {boolean} - True if the user has at least one credential
 */
export function hasCredentials(database, userId) {
    const row = database
        .query("SELECT COUNT(*) as count FROM credentials WHERE user_id = ?")
        .get(userId);
    return row.count > 0;
}
