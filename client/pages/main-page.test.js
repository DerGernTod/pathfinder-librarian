import "./main-page.js";
import { describe, it, expect, beforeEach } from "bun:test";

import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from "../utils/mock-data.js";

describe("main-page", () => {
    let element;

    beforeEach(() => {
        document.body.innerHTML = "";
        element = document.createElement("main-page");
        document.body.appendChild(element);
    });

    it("should initialize with mock data", () => {
        expect(element.conversations).toEqual(MOCK_CONVERSATIONS);
        expect(element.messages).toEqual(MOCK_MESSAGES);
        expect(element.activeConversationId).toBe("1");
    });

    it("should filter messages by active conversation", () => {
        element.activeConversationId = "1";
        expect(element.filteredMessages).toEqual(
            MOCK_MESSAGES.filter((m) => m.conversationId === "1"),
        );

        element.activeConversationId = "2";
        expect(element.filteredMessages).toEqual(
            MOCK_MESSAGES.filter((m) => m.conversationId === "2"),
        );

        element.activeConversationId = "3";
        expect(element.filteredMessages).toEqual(
            MOCK_MESSAGES.filter((m) => m.conversationId === "3"),
        );
    });

    it("should return empty array for non-existent conversation", () => {
        element.activeConversationId = "999";
        expect(element.filteredMessages).toEqual([]);
    });

    it("should update activeConversationId when selecting conversation", () => {
        const event = new CustomEvent("select-conversation", { detail: { id: "2" } });
        element.handleSelectConversation(event);
        expect(element.activeConversationId).toBe("2");
    });

    it("should add message with conversationId when sending", () => {
        const initialLength = element.messages.length;
        const event = new CustomEvent("send-message", { detail: { text: "Test message" } });
        element.handleSendMessage(event);

        expect(element.messages.length).toBe(initialLength + 1);
        const newMessage = element.messages[element.messages.length - 1];
        expect(newMessage.content).toBe("Test message");
        expect(newMessage.role).toBe("user");
        expect(newMessage.conversationId).toBe(element.activeConversationId);
    });

    it("should filter messages after switching conversations", () => {
        element.activeConversationId = "1";
        const conv1Messages = element.filteredMessages;

        element.activeConversationId = "2";
        const conv2Messages = element.filteredMessages;

        expect(conv1Messages).not.toEqual(conv2Messages);
        expect(conv1Messages.every((m) => m.conversationId === "1")).toBe(true);
        expect(conv2Messages.every((m) => m.conversationId === "2")).toBe(true);
    });

    it("should switch mode correctly", () => {
        expect(element.mode).toBe("player");

        const event = new CustomEvent("mode-change", { detail: { mode: "gm" } });
        element.handleModeChange(event);
        expect(element.mode).toBe("gm");
    });

    it("should toggle sidebar", () => {
        expect(element.sidebarExpanded).toBe(true);

        const event = new CustomEvent("toggle-sidebar", { detail: { expanded: false } });
        element.handleSidebarToggle(event);
        expect(element.sidebarExpanded).toBe(false);
    });
});
