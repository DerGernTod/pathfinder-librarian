import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createDb } from "./database.js";
import * as queries from "./queries.js";
import { clearAllTables, seedForUser, seedRuleItems, SEED_IDS } from "./seed.js";

describe("clearAllTables", () => {
    /** @type {import("bun:sqlite").Database} */
    let db;

    beforeEach(() => {
        db = createDb(":memory:");
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    it("empties all tables", () => {
        // Pre-populate with seed data
        seedRuleItems(db);
        db.run(
            "INSERT INTO users (id, name, initials, subtitle, mode, email, is_test_user) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [crypto.randomUUID(), "Test", "TE", "Tester", "gm", "test@test.local", 1],
        );

        // Verify data exists (2 root + 4 children)
        expect(db.query("SELECT COUNT(*) as count FROM rule_items").get().count).toBe(6);
        expect(db.query("SELECT COUNT(*) as count FROM users").get().count).toBe(1);

        clearAllTables(db);

        expect(db.query("SELECT COUNT(*) as count FROM messages").get().count).toBe(0);
        expect(db.query("SELECT COUNT(*) as count FROM conversations").get().count).toBe(0);
        expect(db.query("SELECT COUNT(*) as count FROM rule_items").get().count).toBe(0);
        expect(db.query("SELECT COUNT(*) as count FROM challenges").get().count).toBe(0);
        expect(db.query("SELECT COUNT(*) as count FROM sessions").get().count).toBe(0);
        expect(db.query("SELECT COUNT(*) as count FROM credentials").get().count).toBe(0);
        expect(db.query("SELECT COUNT(*) as count FROM users").get().count).toBe(0);
    });

    it("can be called on empty database safely", () => {
        expect(() => clearAllTables(db)).not.toThrow();
    });
});

describe("seedForUser", () => {
    /** @type {import("bun:sqlite").Database} */
    let db;
    const testUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    beforeEach(() => {
        db = createDb(":memory:");
        // Seed users table with a user
        db.run(
            "INSERT INTO users (id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [testUserId, "Test GM", "TG", "Game Master", "gm", "test-gm@local.test", 1, testUserId],
        );
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    it("creates 2 conversations for the user", () => {
        seedForUser(db, testUserId, "gm");

        const conversations = db
            .query("SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at")
            .all(testUserId);
        expect(conversations.length).toBe(2);
        expect(conversations[0].title).toBe("Chandelier Assassination");
        expect(conversations[1].title).toBe("Mitflit King Capture");
    });

    it("creates 6 messages for Mitflit and 4 for Chandelier conversation", () => {
        seedForUser(db, testUserId, "gm");

        const conversations = db
            .query("SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at")
            .all(testUserId);

        const chandelierMsgs = db
            .query("SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?")
            .get(conversations[0].id);
        expect(chandelierMsgs.count).toBe(4);

        const mitflitMsgs = db
            .query("SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?")
            .get(conversations[1].id);
        expect(mitflitMsgs.count).toBe(6);
    });

    it("is idempotent — calling twice does not duplicate data", () => {
        seedForUser(db, testUserId, "gm");
        const convCount1 = db.query("SELECT COUNT(*) as count FROM conversations").get().count;
        const msgCount1 = db.query("SELECT COUNT(*) as count FROM messages").get().count;

        seedForUser(db, testUserId, "gm");
        const convCount2 = db.query("SELECT COUNT(*) as count FROM conversations").get().count;
        const msgCount2 = db.query("SELECT COUNT(*) as count FROM messages").get().count;

        expect(convCount2).toBe(convCount1);
        expect(msgCount2).toBe(msgCount1);
    });

    it("does not mutate other users' data", () => {
        const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
        db.run(
            "INSERT INTO users (id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [otherUserId, "Other", "OT", "Player", "player", "other@local.test", 1, otherUserId],
        );
        seedForUser(db, otherUserId, "gm");
        const otherConvCount = db
            .query("SELECT COUNT(*) as count FROM conversations WHERE user_id = ?")
            .get(otherUserId).count;
        expect(otherConvCount).toBe(2);

        // Now seed for the first user
        seedForUser(db, testUserId, "gm");
        const firstConvCount = db
            .query("SELECT COUNT(*) as count FROM conversations WHERE user_id = ?")
            .get(testUserId).count;
        expect(firstConvCount).toBe(2);

        // Verify other user still has 2 conversations (not affected)
        const otherConvCount2 = db
            .query("SELECT COUNT(*) as count FROM conversations WHERE user_id = ?")
            .get(otherUserId).count;
        expect(otherConvCount2).toBe(2);

        // Total conversations should be 4
        const totalConv = db.query("SELECT COUNT(*) as count FROM conversations").get().count;
        expect(totalConv).toBe(4);
    });
});

describe("seedRuleItems", () => {
    /** @type {import("bun:sqlite").Database} */
    let db;

    beforeEach(() => {
        db = createDb(":memory:");
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
    });

    it("seeds 6 rule items (2 root + 4 children)", () => {
        seedRuleItems(db);
        const items = db.query("SELECT * FROM rule_items ORDER BY id").all();
        expect(items.length).toBe(6);
        const ids = items.map((r) => r.id);
        expect(ids).toContain(SEED_IDS.RULE_MITFLIT_KING);
        expect(ids).toContain(SEED_IDS.RULE_SAMPLE_SPELL);
    });

    it("seeds mitflit king with creature type", () => {
        seedRuleItems(db);
        const item = queries.getRuleItemById(db, SEED_IDS.RULE_MITFLIT_KING);
        expect(item).not.toBeNull();
        if (!item) {
            return;
        }
        expect(item.type).toBe("creature");
    });

    it("seeds mitflit king with structured CreatureData shape", () => {
        seedRuleItems(db);
        const item = queries.getRuleItemById(db, SEED_IDS.RULE_MITFLIT_KING);
        expect(item).not.toBeNull();
        if (!item) {
            return;
        }
        const data = /** @type {Record<string, unknown>} */ (item.data);
        // AC is an object with value, not a flat number
        const attrs = /** @type {Record<string, unknown>} */ (data.attributes);
        expect(typeof attrs.ac).toBe("object");
        const acObj = /** @type {{ value: number }} */ (attrs.ac);
        expect(acObj.value).toBe(21);
        // HP is an object with value and max
        const hpObj = /** @type {{ value: number, max: number }} */ (attrs.hp);
        expect(hpObj).toEqual({ value: 55, max: 55 });
        // Abilities use { mod } objects
        const abilities = /** @type {Record<string, { mod: number }>} */ (data.abilities);
        expect(abilities.str).toEqual({ mod: 2 });
        expect(abilities.dex).toEqual({ mod: 4 });
        // Skills use { value } objects
        const skills = /** @type {Record<string, { value: number }>} */ (data.skills);
        expect(skills.Acrobatics).toEqual({ value: 9 });
        // Melee entries exist
        const melee = /** @type {Array<Record<string, unknown>>} */ (data.melee);
        expect(Array.isArray(melee)).toBe(true);
        expect(melee.length).toBeGreaterThan(0);
        // Spellcasting entries exist
        const spellcasting = /** @type {Array<Record<string, unknown>>} */ (data.spellcasting);
        expect(Array.isArray(spellcasting)).toBe(true);
        expect(spellcasting.length).toBeGreaterThan(0);
        // Actions use numeric actionType
        const actions = /** @type {Array<Record<string, unknown>>} */ (data.actions);
        expect(Array.isArray(actions)).toBe(true);
        expect(actions[0].actionType).toBe(1);
    });

    it("is idempotent", () => {
        seedRuleItems(db);
        const count1 = db.query("SELECT COUNT(*) as count FROM rule_items").get().count;
        seedRuleItems(db);
        const count2 = db.query("SELECT COUNT(*) as count FROM rule_items").get().count;
        expect(count2).toBe(count1);
        expect(count2).toBe(6);
    });

    it("seeds Mitflit King children with correct parent_id", () => {
        seedRuleItems(db);

        // Root items only via getRuleItems
        const rootItems = queries.getRuleItems(db);
        expect(rootItems).toHaveLength(2);

        // Children of Mitflit King
        const children = queries.getChildItems(db, SEED_IDS.RULE_MITFLIT_KING);
        expect(children).toHaveLength(4);

        // Verify child types
        const childTypes = children.map((c) => c.type);
        expect(childTypes).toContain("melee");
        expect(childTypes).toContain("action");
        expect(childTypes).toContain("spellcastingEntry");

        // Verify all children have correct parent_id
        for (const child of children) {
            expect(child.parentId).toBe(SEED_IDS.RULE_MITFLIT_KING);
        }
    });
});
