import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createDb } from "./database.js";
import { seedIfNeeded, resetAndReseedDb, SEED_IDS } from "./seed.js";

describe("database", () => {
    /** @type {import("bun:sqlite").Database} */
    let db;

    beforeEach(() => {
        db = createDb(":memory:");
        seedIfNeeded(db);
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    it("creates all tables", () => {
        const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
        const tableNames = tables.map((t) => t.name);
        expect(tableNames).toContain("users");
        expect(tableNames).toContain("conversations");
        expect(tableNames).toContain("messages");
        expect(tableNames).toContain("rule_items");
    });

    it("creates indexes", () => {
        const indexes = db.query("SELECT name FROM sqlite_master WHERE type='index'").all();
        const indexNames = indexes.map((i) => i.name);
        expect(indexNames).toContain("idx_messages_conversation");
        expect(indexNames).toContain("idx_rule_items_type");
    });

    it("enables foreign keys", () => {
        const result = db.query("PRAGMA foreign_keys").get();
        expect(result.foreign_keys).toBe(1);
    });

    it("enforces foreign key constraints", () => {
        expect(() => {
            db.run(
                "INSERT INTO messages (id, conversation_id, role, mode, content) VALUES (?, ?, ?, ?, ?)",
                [
                    crypto.randomUUID(),
                    "00000000-0000-0000-0000-000000000000",
                    "user",
                    "player",
                    "test",
                ],
            );
        }).toThrow();
    });

    it("seeds users", () => {
        const users = db.query("SELECT * FROM users").all();
        expect(users.length).toBeGreaterThanOrEqual(1);
        expect(users[0].id).toBe(SEED_IDS.USER_DEFAULT);
    });

    it("seeds conversations", () => {
        const conversations = db.query("SELECT * FROM conversations").all();
        expect(conversations.length).toBe(3);
        expect(conversations[0].id).toBe(SEED_IDS.CONV_MITFLIT);
        expect(conversations[1].id).toBe(SEED_IDS.CONV_CHANDELIER);
        expect(conversations[2].id).toBe(SEED_IDS.CONV_REAGENTS);
    });

    it("seeds messages with correct ordering", () => {
        const messages = db.query("SELECT * FROM messages ORDER BY created_at").all();
        expect(messages.length).toBe(14);
        // Verify all messages have created_at timestamps
        messages.forEach((msg) => {
            expect(msg.created_at).toBeDefined();
            expect(typeof msg.created_at).toBe("string");
        });
    });

    it("seeds rule items", () => {
        const ruleItems = db.query("SELECT * FROM rule_items ORDER BY id").all();
        expect(ruleItems.length).toBe(9);
        const ids = ruleItems.map((r) => r.id);
        expect(ids).toContain(SEED_IDS.RULE_MITFLIT_KING);
        expect(ids).toContain(SEED_IDS.RULE_SAMPLE_SPELL);
    });

    it("seed is idempotent", () => {
        const beforeConvCount = db.query("SELECT COUNT(*) as count FROM conversations").get().count;
        const beforeMsgCount = db.query("SELECT COUNT(*) as count FROM messages").get().count;

        seedIfNeeded(db);

        const afterConvCount = db.query("SELECT COUNT(*) as count FROM conversations").get().count;
        const afterMsgCount = db.query("SELECT COUNT(*) as count FROM messages").get().count;

        expect(afterConvCount).toBe(beforeConvCount);
        expect(afterMsgCount).toBe(beforeMsgCount);
    });

    it("resetAndReseedDb wipes and reseeds", () => {
        // Add a custom conversation
        const customConvId = crypto.randomUUID();
        db.run("INSERT INTO conversations (id, title, user_id) VALUES (?, ?, ?)", [
            customConvId,
            "Custom Conversation",
            SEED_IDS.USER_DEFAULT,
        ]);

        // Verify it was added
        let count = db.query("SELECT COUNT(*) as count FROM conversations").get().count;
        expect(count).toBe(4);

        // Reset and reseed
        resetAndReseedDb(db);

        // Verify back to original seed count
        count = db.query("SELECT COUNT(*) as count FROM conversations").get().count;
        expect(count).toBe(3);
    });
});
