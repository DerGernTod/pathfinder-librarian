import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createDb } from "./database.js";
import * as queries from "./queries.js";
import { seedIfNeeded, SEED_IDS } from "./seed.js";

describe("queries", () => {
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

    describe("getAllConversations", () => {
        it("returns all seeded conversations", () => {
            const conversations = queries.getAllConversations(db);
            expect(conversations).toHaveLength(3);
            expect(conversations[0]).toHaveProperty("id");
            expect(conversations[0]).toHaveProperty("title");
            expect(conversations[0]).toHaveProperty("createdAt");
            expect(conversations[0]).not.toHaveProperty("user_id"); // camelCase
            expect(conversations[0]).not.toHaveProperty("created_at"); // camelCase
        });
    });

    describe("getConversationById", () => {
        it("returns conversation by id", () => {
            const conversations = queries.getAllConversations(db);
            const conv = queries.getConversationById(db, conversations[0].id);
            expect(conv).toBeDefined();
            expect(conv?.id).toBe(conversations[0].id);
            expect(conv?.title).toBe(conversations[0].title);
        });

        it("returns null for non-existent conversation", () => {
            const conv = queries.getConversationById(db, "00000000-0000-0000-0000-000000000000");
            expect(conv).toBeNull();
        });

        it("includes archivedAt field", () => {
            const conversations = queries.getAllConversations(db);
            const conv = queries.getConversationById(db, conversations[0].id);
            expect(conv).toHaveProperty("archivedAt");
            expect(conv?.archivedAt).toBeNull();
        });

        it("returns archivedAt as string for archived conversation", () => {
            const conversations = queries.getAllConversations(db);
            const convId = conversations[0].id;
            const timestamp = new Date().toISOString();
            db.run("UPDATE conversations SET archived_at = ? WHERE id = ?", [timestamp, convId]);
            const conv = queries.getConversationById(db, convId);
            expect(conv?.archivedAt).toBe(timestamp);
        });
    });

    describe("createConversation", () => {
        it("creates and returns new conversation with UUID", () => {
            const newConv = queries.createConversation(db, {
                title: "Test Conversation",
                userId: "00000000-0000-4000-8000-000000000001",
            });
            expect(newConv).toHaveProperty("id");
            expect(typeof newConv.id).toBe("string");
            expect(newConv.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
            );
            expect(newConv.title).toBe("Test Conversation");
            expect(newConv).toHaveProperty("createdAt");

            // Verify it's in the DB
            const allConvs = queries.getAllConversations(db);
            expect(allConvs).toHaveLength(4);
        });
    });

    describe("getMessagesByConversationId", () => {
        it("returns messages for conversation ordered by created_at", () => {
            const conversations = queries.getAllConversations(db);
            const messages = queries.getMessagesByConversationId(db, conversations[0].id);
            expect(messages.length).toBeGreaterThan(0);

            // Verify ordering
            for (let i = 1; i < messages.length; i++) {
                expect(
                    new Date(/** @type {string} */ (messages[i].createdAt)).getTime(),
                ).toBeGreaterThanOrEqual(
                    new Date(/** @type {string} */ (messages[i - 1].createdAt)).getTime(),
                );
            }

            // Verify camelCase
            expect(messages[0]).toHaveProperty("conversationId");
            expect(messages[0]).not.toHaveProperty("conversation_id");
        });

        it("returns empty array for non-existent conversation", () => {
            const messages = queries.getMessagesByConversationId(
                db,
                "00000000-0000-0000-0000-000000000000",
            );
            expect(messages).toEqual([]);
        });
    });

    describe("createMessage", () => {
        it("creates and returns user message", () => {
            const conversations = queries.getAllConversations(db);
            const msg = queries.createMessage(db, {
                conversationId: conversations[0].id,
                role: "user",
                mode: "player",
                content: "Test message",
                blocksJson: null,
            });
            expect(msg).toHaveProperty("id");
            expect(msg.role).toBe("user");
            expect(msg.mode).toBe("player");
            expect(msg.content).toBe("Test message");
            expect(msg.blocks).toBeNull();
        });

        it("creates and returns assistant message with blocks", () => {
            const conversations = queries.getAllConversations(db);
            const blocks = [
                { type: "text", markdown: "Test text" },
                {
                    type: "callout",
                    title: "Test",
                    markdown: "Test markdown content",
                },
            ];

            const msg = queries.createMessage(db, {
                conversationId: conversations[0].id,
                role: "assistant",
                mode: "gm",
                content: null,
                blocksJson: JSON.stringify(blocks),
            });
            expect(msg).toHaveProperty("id");
            expect(msg.role).toBe("assistant");
            expect(msg.mode).toBe("gm");
            expect(msg.content).toBeNull();
            expect(Array.isArray(msg.blocks)).toBe(true);
            expect(msg.blocks).toHaveLength(2);
            const assistantMsg =
                /** @type {import("../../shared/types.js").AssistantMessage} */ (
                    /** @type {unknown} */ (msg)
                );
            expect(assistantMsg.blocks).not.toBeNull();
            expect(assistantMsg.blocks?.[0]).toEqual({
                type: "text",
                markdown: "Test text",
            });
        });

        it("maintains backward compatibility with createUserMessage alias", () => {
            const conversations = queries.getAllConversations(db);
            const msg = queries.createUserMessage(db, {
                conversationId: conversations[0].id,
                role: "user",
                mode: "player",
                content: "Backward compat test",
                blocksJson: null,
            });
            expect(msg).toHaveProperty("id");
            expect(msg.role).toBe("user");
            expect(msg.content).toBe("Backward compat test");
            expect(msg.blocks).toBeNull();
        });
    });

    describe("getRuleItems", () => {
        it("returns root items only by default (excludes children)", () => {
            const items = queries.getRuleItems(db);
            expect(items).toHaveLength(5);
            for (const item of items) {
                expect(item.parentId).toBeUndefined();
            }
        });

        it("returns all items including children with includeChildren option", () => {
            const items = queries.getRuleItems(db, undefined, {
                includeChildren: true,
            });
            expect(items).toHaveLength(9);
        });

        it("returns filtered rule items by type", () => {
            const creatures = queries.getRuleItems(db, "creature");
            expect(creatures).toHaveLength(1);
            expect(creatures[0].type).toBe("creature");

            const spells = queries.getRuleItems(db, "spell");
            expect(spells).toHaveLength(1);
            expect(spells[0].type).toBe("spell");
        });

        it("returns items with compendiumSource field", () => {
            const items = queries.getRuleItems(db);
            expect(items[0]).toHaveProperty("compendiumSource");
            expect(items[1]).toHaveProperty("compendiumSource");
        });

        it("returns empty array for non-existent type", () => {
            const items = queries.getRuleItems(db, "weapon");
            expect(items).toEqual([]);
        });
    });

    describe("getRuleItemById", () => {
        it("returns rule item by id", () => {
            const items = queries.getRuleItems(db);
            const item = queries.getRuleItemById(db, items[0].id);
            expect(item).toBeDefined();
            expect(item?.id).toBe(items[0].id);
            expect(item?.name).toBe(items[0].name);
            expect(item).toHaveProperty("data");
        });

        it("returns null for non-existent rule item", () => {
            const item = queries.getRuleItemById(db, "00000000-0000-0000-0000-000000000000");
            expect(item).toBeNull();
        });
    });

    describe("upsertRuleItem", () => {
        it("inserts new item with compendium_source", () => {
            const result = queries.upsertRuleItem(db, {
                type: "creature",
                name: "Test Dragon",
                compendiumSource: "Compendium.pf2e.bestiary.Actor.abc123",
                dataJson: JSON.stringify({
                    name: "Test Dragon",
                    level: 5,
                    traits: ["Dragon"],
                }),
            });
            expect(result).toHaveProperty("id");
            expect(result.type).toBe("creature");
            expect(result.name).toBe("Test Dragon");
            expect(result.compendiumSource).toBe("Compendium.pf2e.bestiary.Actor.abc123");
            expect(result.data).toEqual({
                name: "Test Dragon",
                level: 5,
                traits: ["Dragon"],
            });
        });

        it("updates existing item when compendium_source matches", () => {
            const source = "Compendium.pf2e.bestiary.Actor.def456";
            queries.upsertRuleItem(db, {
                type: "creature",
                name: "Original Name",
                compendiumSource: source,
                dataJson: JSON.stringify({
                    name: "Original Name",
                    level: 3,
                    traits: [],
                }),
            });
            const updated = queries.upsertRuleItem(db, {
                type: "creature",
                name: "Updated Name",
                compendiumSource: source,
                dataJson: JSON.stringify({
                    name: "Updated Name",
                    level: 4,
                    traits: ["Beast"],
                }),
            });
            expect(updated.name).toBe("Updated Name");
            // Should be same item (updated), not a new one
            const bySource = queries.getRuleItemBySource(db, source);
            expect(bySource).not.toBeNull();
            if (!bySource) {
                return;
            }
            expect(bySource.name).toBe("Updated Name");
            // Verify no duplicate was created
            const allItems = db
                .query("SELECT COUNT(*) as count FROM rule_items WHERE compendium_source = ?")
                .get(source);
            expect(allItems.count).toBe(1);
        });
    });

    describe("getRuleItemBySource", () => {
        it("returns item by compendium UUID", () => {
            const source = "Compendium.pf2e.bestiary.Actor.xyz789";
            queries.upsertRuleItem(db, {
                type: "creature",
                name: "Lookup Creature",
                compendiumSource: source,
                dataJson: JSON.stringify({
                    name: "Lookup Creature",
                    level: 1,
                    traits: [],
                }),
            });
            const item = queries.getRuleItemBySource(db, source);
            expect(item).not.toBeNull();
            if (!item) {
                return;
            }
            expect(item.name).toBe("Lookup Creature");
            expect(item.compendiumSource).toBe(source);
        });

        it("returns null for unknown source", () => {
            const item = queries.getRuleItemBySource(db, "nonexistent-source");
            expect(item).toBeNull();
        });
    });

    describe("batchUpsertRuleItems", () => {
        it("inserts multiple new items", () => {
            const result = queries.batchUpsertRuleItems(db, [
                {
                    type: "creature",
                    name: "Batch Creature 1",
                    compendiumSource: "Compendium.pf2e.test.Item.batch1",
                    dataJson: JSON.stringify({
                        name: "Batch Creature 1",
                        level: 1,
                        traits: [],
                    }),
                },
                {
                    type: "spell",
                    name: "Batch Spell 1",
                    compendiumSource: "Compendium.pf2e.test.Item.batch2",
                    dataJson: JSON.stringify({
                        name: "Batch Spell 1",
                        level: 2,
                    }),
                },
            ]);

            expect(result.inserted).toBe(2);
            expect(result.updated).toBe(0);

            const item1 = queries.getRuleItemBySource(db, "Compendium.pf2e.test.Item.batch1");
            expect(item1).not.toBeNull();
            expect(item1?.name).toBe("Batch Creature 1");
        });

        it("updates existing items and inserts new ones", () => {
            // Pre-insert one item
            queries.upsertRuleItem(db, {
                type: "creature",
                name: "Original",
                compendiumSource: "Compendium.pf2e.test.Item.existing",
                dataJson: JSON.stringify({
                    name: "Original",
                    level: 1,
                    traits: [],
                }),
            });

            const result = queries.batchUpsertRuleItems(db, [
                {
                    type: "creature",
                    name: "Updated",
                    compendiumSource: "Compendium.pf2e.test.Item.existing",
                    dataJson: JSON.stringify({
                        name: "Updated",
                        level: 2,
                        traits: ["Beast"],
                    }),
                },
                {
                    type: "spell",
                    name: "New Spell",
                    compendiumSource: "Compendium.pf2e.test.Item.new",
                    dataJson: JSON.stringify({ name: "New Spell", level: 3 }),
                },
            ]);

            expect(result.inserted).toBe(1);
            expect(result.updated).toBe(1);

            const updated = queries.getRuleItemBySource(db, "Compendium.pf2e.test.Item.existing");
            expect(updated?.name).toBe("Updated");
        });

        it("rolls back on error", () => {
            // Try to insert with invalid type (will fail CHECK constraint)
            expect(() => {
                queries.batchUpsertRuleItems(db, [
                    {
                        type: "creature",
                        name: "Valid",
                        compendiumSource: "Compendium.pf2e.test.Item.valid",
                        dataJson: JSON.stringify({ name: "Valid" }),
                    },
                    {
                        type: "invalid-type",
                        name: "Invalid",
                        compendiumSource: "Compendium.pf2e.test.Item.invalid",
                        dataJson: JSON.stringify({ name: "Invalid" }),
                    },
                ]);
            }).toThrow();

            // The valid item should not have been inserted (rolled back)
            const item = queries.getRuleItemBySource(db, "Compendium.pf2e.test.Item.valid");
            expect(item).toBeNull();
        });

        it("handles empty array", () => {
            const result = queries.batchUpsertRuleItems(db, []);
            expect(result.inserted).toBe(0);
            expect(result.updated).toBe(0);
        });

        it("accepts all known rule item types", () => {
            const allTypes = [
                "creature",
                "spell",
                "melee",
                "weapon",
                "armor",
                "equipment",
                "action",
                "feat",
                "spellcastingEntry",
                "trait",
                "condition",
                "effect",
            ];
            const items = allTypes.map((type) => ({
                type,
                name: `Test ${type}`,
                compendiumSource: `Compendium.pf2e.test.Item.${type}`,
                dataJson: JSON.stringify({ name: `Test ${type}` }),
            }));
            const result = queries.batchUpsertRuleItems(db, items);
            expect(result.inserted).toBe(allTypes.length);
        });

        it("inserts items with parentId and linkedSource", () => {
            // Insert a parent first
            const parent = queries.upsertRuleItem(db, {
                type: "creature",
                name: "Parent Creature",
                compendiumSource: "Compendium.pf2e.test.Item.parent1",
                dataJson: JSON.stringify({ name: "Parent Creature", level: 5 }),
            });

            queries.batchUpsertRuleItems(db, [
                {
                    type: "melee",
                    name: "Child Melee",
                    compendiumSource: "Compendium.pf2e.test.Item.child1",
                    dataJson: JSON.stringify({
                        name: "Child Melee",
                        attack: "+10",
                    }),
                    parentId: parent.id,
                    linkedSource: "Compendium.pf2e.other.Item.linked",
                },
            ]);

            const child = queries.getRuleItemBySource(db, "Compendium.pf2e.test.Item.child1");
            expect(child).not.toBeNull();
            expect(child?.parentId).toBe(parent.id);
            expect(child?.linkedSource).toBe("Compendium.pf2e.other.Item.linked");
        });
    });

    describe("getChildItems", () => {
        it("returns children for a parent item", () => {
            const children = queries.getChildItems(db, SEED_IDS.RULE_MITFLIT_KING);
            expect(children).toHaveLength(4);
            for (const child of children) {
                expect(child.parentId).toBe(SEED_IDS.RULE_MITFLIT_KING);
            }
        });

        it("returns empty array for item with no children", () => {
            const children = queries.getChildItems(db, SEED_IDS.RULE_SAMPLE_SPELL);
            expect(children).toEqual([]);
        });

        it("returns empty array for non-existent item", () => {
            const children = queries.getChildItems(db, "00000000-0000-0000-0000-000000000000");
            expect(children).toEqual([]);
        });
    });

    describe("getParentItem", () => {
        it("returns parent for a child item", () => {
            const children = queries.getChildItems(db, SEED_IDS.RULE_MITFLIT_KING);
            const parent = queries.getParentItem(db, children[0].id);
            expect(parent).not.toBeNull();
            expect(parent?.id).toBe(SEED_IDS.RULE_MITFLIT_KING);
            expect(parent?.name).toBe("Mitflit King");
        });

        it("returns null for root items", () => {
            const parent = queries.getParentItem(db, SEED_IDS.RULE_MITFLIT_KING);
            expect(parent).toBeNull();
        });

        it("returns null for non-existent item", () => {
            const parent = queries.getParentItem(db, "00000000-0000-0000-0000-000000000000");
            expect(parent).toBeNull();
        });
    });

    describe("getRuleItemsByTypeAndNames", () => {
        it("returns matching items by type and names", () => {
            const result = queries.getRuleItemsByTypeAndNames(db, "trait", [
                "Humanoid",
                "Goblinoid",
            ]);
            expect(result.size).toBe(2);
            expect(result.get("Humanoid")).toBeDefined();
            expect(result.get("Humanoid")?.id).toBe(SEED_IDS.RULE_TRAIT_HUMANOID);
            expect(result.get("Goblinoid")).toBeDefined();
            expect(result.get("Goblinoid")?.id).toBe(SEED_IDS.RULE_TRAIT_GOBLINOID);
        });

        it("returns matching conditions by type and name", () => {
            const result = queries.getRuleItemsByTypeAndNames(db, "condition", ["Enfeebled"]);
            expect(result.size).toBe(1);
            expect(result.get("Enfeebled")).toBeDefined();
            expect(result.get("Enfeebled")?.id).toBe(SEED_IDS.RULE_CONDITION_ENFEEBLED);
        });

        it("returns empty map when no matches", () => {
            const result = queries.getRuleItemsByTypeAndNames(db, "trait", ["NonExistentTrait"]);
            expect(result.size).toBe(0);
        });

        it("returns empty map for empty names array", () => {
            const result = queries.getRuleItemsByTypeAndNames(db, "trait", []);
            expect(result.size).toBe(0);
        });

        it("only matches items of the specified type", () => {
            const result = queries.getRuleItemsByTypeAndNames(db, "creature", [
                "Humanoid",
                "Mitflit King",
            ]);
            expect(result.size).toBe(1);
            expect(result.get("Mitflit King")).toBeDefined();
            expect(result.get("Humanoid")).toBeUndefined();
        });
    });

    describe("cascade delete", () => {
        it("deletes children when parent is deleted", () => {
            // Verify children exist
            const childrenBefore = queries.getChildItems(db, SEED_IDS.RULE_MITFLIT_KING);
            expect(childrenBefore).toHaveLength(4);

            // Delete parent
            db.run("DELETE FROM rule_items WHERE id = ?", [SEED_IDS.RULE_MITFLIT_KING]);

            // Children should be gone
            const childrenAfter = queries.getChildItems(db, SEED_IDS.RULE_MITFLIT_KING);
            expect(childrenAfter).toHaveLength(0);
        });
    });

    describe("getConversationsByUser", () => {
        it("returns only non-archived conversations for user", () => {
            const conversations = queries.getConversationsByUser(db, SEED_IDS.USER_DEFAULT);
            expect(conversations).toHaveLength(2);
            for (const conv of conversations) {
                expect(conv).toHaveProperty("archivedAt");
                expect(conv.archivedAt).toBeNull();
            }
        });

        it("excludes archived conversations", () => {
            const conversationsBefore = queries.getConversationsByUser(db, SEED_IDS.USER_DEFAULT);
            expect(conversationsBefore).toHaveLength(2);

            // Archive one conversation
            const convId = conversationsBefore[0].id;
            db.run("UPDATE conversations SET archived_at = ? WHERE id = ?", [
                new Date().toISOString(),
                convId,
            ]);

            const conversationsAfter = queries.getConversationsByUser(db, SEED_IDS.USER_DEFAULT);
            expect(conversationsAfter).toHaveLength(1);
            expect(conversationsAfter[0].id).not.toBe(convId);
        });
    });

    describe("archiveConversation", () => {
        it("archives a conversation by setting archived_at", () => {
            const conversations = queries.getAllConversations(db);
            const convId = conversations[0].id;
            const archived = queries.archiveConversation(db, convId);
            expect(archived).not.toBeNull();
            expect(archived?.archivedAt).not.toBeNull();
            expect(typeof archived?.archivedAt).toBe("string");
        });

        it("is idempotent — calling twice does not error", () => {
            const conversations = queries.getAllConversations(db);
            const convId = conversations[0].id;
            queries.archiveConversation(db, convId);
            const second = queries.archiveConversation(db, convId);
            expect(second).not.toBeNull();
            expect(second?.archivedAt).not.toBeNull();
        });
    });

    describe("restoreConversation", () => {
        it("restores an archived conversation", () => {
            const conversations = queries.getAllConversations(db);
            const convId = conversations[0].id;
            queries.archiveConversation(db, convId);

            const restored = queries.restoreConversation(db, convId);
            expect(restored).not.toBeNull();
            expect(restored?.archivedAt).toBeNull();
        });

        it("is idempotent — calling restore on active conversation does not error", () => {
            const conversations = queries.getAllConversations(db);
            const convId = conversations[0].id;
            const restored = queries.restoreConversation(db, convId);
            expect(restored).not.toBeNull();
            expect(restored?.archivedAt).toBeNull();
        });
    });

    describe("deleteConversation", () => {
        it("deletes a conversation from the database", () => {
            const conversations = queries.getAllConversations(db);
            const convId = conversations[0].id;
            queries.deleteConversation(db, convId);

            const deleted = queries.getConversationById(db, convId);
            expect(deleted).toBeNull();
        });

        it("cascades deletes messages", () => {
            const conversations = queries.getAllConversations(db);
            const convId = conversations[0].id;

            // Verify messages exist
            const messagesBefore = queries.getMessagesByConversationId(db, convId);
            expect(messagesBefore.length).toBeGreaterThan(0);

            queries.deleteConversation(db, convId);

            const messagesAfter = queries.getMessagesByConversationId(db, convId);
            expect(messagesAfter).toHaveLength(0);
        });
    });

    describe("getArchivedConversationsByUser", () => {
        it("returns only archived conversations for user", () => {
            // Archive one of USER_DEFAULT's conversations
            const conversations = queries.getConversationsByUser(db, SEED_IDS.USER_DEFAULT);
            const convId = conversations[0].id;
            queries.archiveConversation(db, convId);

            const archived = queries.getArchivedConversationsByUser(db, SEED_IDS.USER_DEFAULT);
            expect(archived).toHaveLength(1);
            expect(archived[0].id).toBe(convId);
            expect(archived[0].archivedAt).not.toBeNull();
        });

        it("returns empty array when none archived", () => {
            const archived = queries.getArchivedConversationsByUser(db, SEED_IDS.USER_DEFAULT);
            expect(archived).toEqual([]);
        });
    });

    describe("getUsers", () => {
        it("returns all users", () => {
            const users = queries.getUsers(db);
            expect(users.length).toBeGreaterThanOrEqual(1);
            expect(users[0]).toHaveProperty("id");
            expect(users[0]).toHaveProperty("name");
            expect(users[0]).toHaveProperty("initials");
            expect(users[0]).toHaveProperty("subtitle");
            expect(users[0]).toHaveProperty("mode");
        });
    });

    describe("getUserById", () => {
        it("returns user by id", () => {
            const users = queries.getUsers(db);
            const user = queries.getUserById(db, users[0].id);
            expect(user).toBeDefined();
            expect(user?.id).toBe(users[0].id);
            expect(user?.name).toBe(users[0].name);
        });

        it("returns null for non-existent user", () => {
            const user = queries.getUserById(db, "00000000-0000-0000-0000-000000000000");
            expect(user).toBeNull();
        });
    });
});
