import { beforeEach, describe, expect, it } from "bun:test";

import { createDb } from "./database.js";
import * as queries from "./queries.js";
import { seedIfNeeded } from "./seed.js";

describe("queries", () => {
    /** @type {import("bun:sqlite").Database} */
    let db;

    beforeEach(() => {
        db = createDb(":memory:");
        seedIfNeeded(db);
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
                { type: "paragraph", text: "Test paragraph" },
                {
                    type: "callout",
                    title: "Test",
                    segments: [{ text: "Test segment", highlight: false }],
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
            expect(
                /** @type {import("../../shared/types.js").AssistantMessage} */ (
                    /** @type {unknown} */ (msg)
                ).blocks[0],
            ).toEqual({ type: "paragraph", text: "Test paragraph" });
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
        it("returns all rule items when no filter", () => {
            const items = queries.getRuleItems(db);
            expect(items).toHaveLength(2);
        });

        it("returns filtered rule items by type", () => {
            const monsters = queries.getRuleItems(db, "monster");
            expect(monsters).toHaveLength(1);
            expect(monsters[0].type).toBe("monster");

            const spells = queries.getRuleItems(db, "spell");
            expect(spells).toHaveLength(1);
            expect(spells[0].type).toBe("spell");
        });

        it("returns empty array for non-existent type", () => {
            const items = queries.getRuleItems(db, "ability");
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
