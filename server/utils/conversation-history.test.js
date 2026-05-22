import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createDb } from "../db/database.js";
import { createConversation, createMessage, createUser } from "../db/queries.js";
import {
    estimateTokenCount,
    formatConversationForLlm,
    serializeBlocks,
    shouldCompact,
} from "./conversation-history.js";

describe("conversation-history", () => {
    describe("serializeBlocks", () => {
        it("returns empty string for null blocks", () => {
            expect(serializeBlocks(null)).toBe("");
        });

        it("returns empty string for empty array", () => {
            expect(serializeBlocks([])).toBe("");
        });

        it("handles text blocks", () => {
            const result = serializeBlocks([{ type: "text", markdown: "Hello Pathfinder!" }]);
            expect(result).toBe("Hello Pathfinder!");
        });

        it("handles callout blocks", () => {
            const result = serializeBlocks([
                { type: "callout", title: "Key Rule", markdown: "**critical hit**" },
            ]);
            expect(result).toBe("[Key Rule] **critical hit**");
        });

        it("handles stat-block blocks", () => {
            const result = serializeBlocks([
                { type: "stat-block", title: "Mitflit King", ruleItemId: "abc-123" },
            ]);
            expect(result).toBe("[Stat Block: Mitflit King]");
        });

        it("handles rule-detail blocks", () => {
            const result = serializeBlocks([
                { type: "rule-detail", title: "Enfeebled", ruleItemId: "def-456" },
            ]);
            expect(result).toBe("[Rule Detail: Enfeebled]");
        });

        it("uses default titles for stat-block without title", () => {
            const result = serializeBlocks([{ type: "stat-block", ruleItemId: "abc-123" }]);
            expect(result).toBe("[Stat Block: Creature]");
        });

        it("uses default titles for rule-detail without title", () => {
            const result = serializeBlocks([{ type: "rule-detail", ruleItemId: "def-456" }]);
            expect(result).toBe("[Rule Detail: Item]");
        });

        it("handles custom-stat-block blocks", () => {
            const result = serializeBlocks([
                {
                    type: "custom-stat-block",
                    title: "Sylvaris",
                    data: { name: "Sylvaris", level: 5 },
                },
            ]);
            expect(result).toBe("[Custom Stat Block: Sylvaris]");
        });

        it("uses default title for custom-stat-block without title", () => {
            // Defensive test: custom-stat-blocks normally have title, but
            // serializeBlocks should handle the edge case gracefully
            const result = serializeBlocks(
                /** @type {import("../../shared/types.js").MessageBlock[]} */ (
                    /** @type {unknown} */ ([
                        {
                            type: "custom-stat-block",
                            data: { name: "Unknown", level: 1 },
                        },
                    ])
                ),
            );
            expect(result).toBe("[Custom Stat Block: Creature]");
        });

        it("handles mixed block types", () => {
            const result = serializeBlocks([
                { type: "text", markdown: "Intro text" },
                { type: "callout", title: "Note", markdown: "See below" },
                { type: "stat-block", title: "Goblin", ruleItemId: "abc" },
            ]);
            expect(result).toBe("Intro text\n\n[Note] See below\n\n[Stat Block: Goblin]");
        });

        it("skips null entries gracefully", () => {
            const result = serializeBlocks(
                /** @type {import("../../shared/types.js").MessageBlock[]} */ ([
                    null,
                    { type: "text", markdown: "valid" },
                ]),
            );
            expect(result).toBe("valid");
        });
    });

    describe("estimateTokenCount", () => {
        it("returns reasonable estimate for known strings", () => {
            const contents = [{ role: "user", parts: [{ text: "a".repeat(400) }] }];
            const tokens = estimateTokenCount(contents);
            expect(tokens).toBe(100);
        });

        it("sums across multiple turns", () => {
            const contents = [
                { role: "user", parts: [{ text: "a".repeat(200) }] },
                { role: "model", parts: [{ text: "b".repeat(200) }] },
            ];
            const tokens = estimateTokenCount(contents);
            expect(tokens).toBe(100);
        });
    });

    describe("shouldCompact", () => {
        it("returns false for short contents", () => {
            const contents = [{ role: "user", parts: [{ text: "Hello" }] }];
            expect(shouldCompact(contents)).toBe(false);
        });

        it("returns true for contents exceeding threshold", () => {
            const longText = "x".repeat(500000 * 4 + 1);
            const contents = [{ role: "user", parts: [{ text: longText }] }];
            expect(shouldCompact(contents)).toBe(true);
        });

        it("respects custom threshold", () => {
            const contents = [{ role: "user", parts: [{ text: "a".repeat(100) }] }];
            expect(shouldCompact(contents, 10)).toBe(true);
            expect(shouldCompact(contents, 100)).toBe(false);
        });
    });

    describe("formatConversationForLlm", () => {
        /** @type {ReturnType<typeof createDb>} */
        let db;
        /** @type {string} */
        let convId;

        beforeEach(() => {
            db = createDb(":memory:");
            const user = createUser(db, {
                name: "Test User",
                initials: "TU",
                subtitle: "Test",
                mode: "player",
                email: null,
                isTestUser: false,
            });
            const conv = createConversation(db, { title: "Test Chat", userId: user.id });
            convId = conv.id;
        });

        afterEach(() => {
            if (db) {
                db.close();
            }
        });

        it("returns single user turn when no history exists", () => {
            createMessage(db, {
                conversationId: convId,
                role: "user",
                mode: "player",
                content: "Hello",
                blocksJson: null,
            });

            const contents = formatConversationForLlm(db, convId);

            expect(contents).toHaveLength(1);
            expect(contents[0].role).toBe("user");
            expect(contents[0].parts[0].text).toBe("Hello");
        });

        it("returns alternating user/model turns for multi-message conversation", () => {
            createMessage(db, {
                conversationId: convId,
                role: "user",
                mode: "player",
                content: "First question",
                blocksJson: null,
            });
            createMessage(db, {
                conversationId: convId,
                role: "assistant",
                mode: "player",
                content: null,
                blocksJson: JSON.stringify([{ type: "text", markdown: "First answer" }]),
            });
            createMessage(db, {
                conversationId: convId,
                role: "user",
                mode: "player",
                content: "Follow-up question",
                blocksJson: null,
            });

            const contents = formatConversationForLlm(db, convId);

            expect(contents).toHaveLength(3);
            expect(contents[0].role).toBe("user");
            expect(contents[0].parts[0].text).toBe("First question");
            expect(contents[1].role).toBe("model");
            expect(contents[1].parts[0].text).toContain("First answer");
            expect(contents[2].role).toBe("user");
            expect(contents[2].parts[0].text).toBe("Follow-up question");
        });

        it("correctly serializes assistant blocks to text", () => {
            createMessage(db, {
                conversationId: convId,
                role: "assistant",
                mode: "player",
                content: null,
                blocksJson: JSON.stringify([
                    { type: "text", markdown: "Some info" },
                    { type: "stat-block", title: "Goblin", ruleItemId: "ri1" },
                ]),
            });
            createMessage(db, {
                conversationId: convId,
                role: "user",
                mode: "player",
                content: "Next question",
                blocksJson: null,
            });

            const contents = formatConversationForLlm(db, convId);

            const modelTurn = contents.find((c) => c.role === "model");
            expect(modelTurn).toBeDefined();
            expect(modelTurn?.parts[0].text).toContain("Some info");
            expect(modelTurn?.parts[0].text).toContain("[Stat Block: Goblin]");
        });

        it("prepends compacted summary as pseudo-turn when compactedSummary exists", () => {
            createMessage(db, {
                conversationId: convId,
                role: "user",
                mode: "player",
                content: "Old question",
                blocksJson: null,
            });
            createMessage(db, {
                conversationId: convId,
                role: "user",
                mode: "player",
                content: "New question",
                blocksJson: null,
            });

            db.run("UPDATE conversations SET compacted_summary = ? WHERE id = ?", [
                "We discussed goblins and fireballs.",
                convId,
            ]);

            const contents = formatConversationForLlm(db, convId);

            expect(contents[0].role).toBe("user");
            expect(contents[0].parts[0].text).toContain("Previous conversation summary");
            expect(contents[0].parts[0].text).toContain("We discussed goblins and fireballs.");
            expect(contents[1].role).toBe("model");
            expect(contents[1].parts[0].text).toContain("Understood");

            const lastTurn = contents[contents.length - 1];
            expect(lastTurn.role).toBe("user");
            expect(lastTurn.parts[0].text).toBe("New question");
        });

        it("applies window limit to history messages", () => {
            for (let i = 0; i < 50; i++) {
                createMessage(db, {
                    conversationId: convId,
                    role: "user",
                    mode: "player",
                    content: `Question ${i}`,
                    blocksJson: null,
                });
                createMessage(db, {
                    conversationId: convId,
                    role: "assistant",
                    mode: "player",
                    content: null,
                    blocksJson: JSON.stringify([{ type: "text", markdown: `Answer ${i}` }]),
                });
            }

            const contents = formatConversationForLlm(db, convId);

            // Window is 20 turns * 2 = 40 messages
            expect(contents).toHaveLength(40);
            expect(contents[0].parts[0].text).toBe("Question 30");
            expect(contents[contents.length - 1].role).toBe("model");
            expect(contents[contents.length - 1].parts[0].text).toContain("Answer 49");
        });

        it("includes persisted user message from DB without duplication", () => {
            createMessage(db, {
                conversationId: convId,
                role: "user",
                mode: "player",
                content: "My current message",
                blocksJson: null,
            });

            const contents = formatConversationForLlm(db, convId);

            const userTurns = contents.filter((c) => c.role === "user");
            expect(userTurns).toHaveLength(1);
            expect(userTurns[0].parts[0].text).toBe("My current message");
        });
    });
});
