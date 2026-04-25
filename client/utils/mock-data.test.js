import { describe, it, expect } from "bun:test";

import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from "./mock-data.js";

describe("mock-data", () => {
    describe("MOCK_CONVERSATIONS", () => {
        it("should have 3 conversations", () => {
            expect(MOCK_CONVERSATIONS).toHaveLength(3);
        });

        it("should have conversation with id '1'", () => {
            const conv1 = MOCK_CONVERSATIONS.find((c) => c.id === "1");
            expect(conv1).toBeDefined();
            expect(conv1?.title).toBe("Mitflit King Capture");
        });

        it("should have conversation with id '2'", () => {
            const conv2 = MOCK_CONVERSATIONS.find((c) => c.id === "2");
            expect(conv2).toBeDefined();
            expect(conv2?.title).toBe("Chandelier Assassination");
        });

        it("should have conversation with id '3'", () => {
            const conv3 = MOCK_CONVERSATIONS.find((c) => c.id === "3");
            expect(conv3).toBeDefined();
            expect(conv3?.title).toBe("Buying rare reagents");
        });
    });

    describe("MOCK_MESSAGES", () => {
        it("should have messages for all conversations", () => {
            const conv1Messages = MOCK_MESSAGES.filter((m) => m.conversationId === "1");
            const conv2Messages = MOCK_MESSAGES.filter((m) => m.conversationId === "2");
            const conv3Messages = MOCK_MESSAGES.filter((m) => m.conversationId === "3");

            expect(conv1Messages.length).toBeGreaterThan(0);
            expect(conv2Messages.length).toBeGreaterThan(0);
            expect(conv3Messages.length).toBeGreaterThan(0);
        });

        it("should have at least 4 messages for conversation 1", () => {
            const conv1Messages = MOCK_MESSAGES.filter((m) => m.conversationId === "1");
            expect(conv1Messages.length).toBeGreaterThanOrEqual(4);
        });

        it("should have at least 2 messages for conversation 2", () => {
            const conv2Messages = MOCK_MESSAGES.filter((m) => m.conversationId === "2");
            expect(conv2Messages.length).toBeGreaterThanOrEqual(2);
        });

        it("should have at least 2 messages for conversation 3", () => {
            const conv3Messages = MOCK_MESSAGES.filter((m) => m.conversationId === "3");
            expect(conv3Messages.length).toBeGreaterThanOrEqual(2);
        });

        it("should have all messages with conversationId", () => {
            const messagesWithoutConversationId = MOCK_MESSAGES.filter((m) => !m.conversationId);
            expect(messagesWithoutConversationId).toHaveLength(0);
        });

        it("should have valid message structure", () => {
            MOCK_MESSAGES.forEach((message) => {
                expect(message).toHaveProperty("id");
                expect(message).toHaveProperty("role");
                expect(message).toHaveProperty("conversationId");
                expect(["user", "assistant"]).toContain(message.role);
            });
        });
    });
});
