import "./main-page.js";
import { describe, it, expect, beforeEach, mock } from "bun:test";

function createMainPage() {
    return /** @type {import("./main-page.js").MainPage} */ (document.createElement("main-page"));
}

/** @type {Record<string, any>} */
const baseClientMock = {
    "/api/conversations": {
        data: [],
    },
};

describe("main-page", () => {
    /** @type {import("./main-page.js").MainPage} */
    let element;

    beforeEach(() => {
        document.body.innerHTML = "";
        // @ts-expect-error - override global fetch with our mock
        globalThis.fetch = mock((url) => {
            if (url in baseClientMock) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(baseClientMock[url]),
                });
            }
            throw new Error(`Unexpected fetch URL: ${url}`);
        });
        element = createMainPage();
        document.body.appendChild(element);
    });

    it("should initialize with empty state", () => {
        expect(element.conversations).toEqual([]);
        expect(element.messages).toEqual([]);
        expect(element.activeConversationId).toBe("");
        // Note: loading is set to false after firstUpdated, so we check initial properties
        expect(element.mode).toBe("player");
        expect(element.sidebarExpanded).toBe(true);
    });

    it("should filter messages by active conversation", () => {
        element.messages = [
            {
                id: "1",
                conversationId: "conv1",
                content: "Test 1",
                role: "user",
                mode: "player",
                createdAt: new Date().toISOString(),
            },
            {
                id: "2",
                conversationId: "conv2",
                content: "Test 2",
                role: "user",
                mode: "player",
                createdAt: new Date().toISOString(),
            },
            {
                id: "3",
                conversationId: "conv1",
                content: "Test 3",
                role: "user",
                mode: "player",
                createdAt: new Date().toISOString(),
            },
        ];
        element.activeConversationId = "conv1";

        expect(element.filteredMessages).toEqual([
            expect.objectContaining({ id: "1", conversationId: "conv1" }),
            expect.objectContaining({ id: "3", conversationId: "conv1" }),
        ]);
    });

    it("should return empty array for non-existent conversation", () => {
        element.messages = [
            {
                id: "1",
                conversationId: "conv1",
                content: "Test",
                role: "user",
                mode: "player",
                createdAt: new Date().toISOString(),
            },
        ];
        element.activeConversationId = "nonexistent";
        expect(element.filteredMessages).toEqual([]);
    });

    it("should switch mode correctly", () => {
        expect(element.mode).toBe("player");

        const event = new CustomEvent("mode-change", {
            detail: { mode: /** @type {import("../../shared/types.js").Mode} */ ("gm") },
        });
        element.handleModeChange(event);
        expect(element.mode).toBe("gm");
    });

    it("should toggle sidebar", () => {
        expect(element.sidebarExpanded).toBe(true);

        const event = new CustomEvent("toggle-sidebar", { detail: { expanded: false } });
        element.handleSidebarToggle(event);
        expect(element.sidebarExpanded).toBe(false);
    });

    it("should handle select-conversation event", async () => {
        element.activeConversationId = "conv1";

        const fetchMessagesMock = mock((_arg) => Promise.resolve([]));
        // @ts-expect-error - override fetchMessages with our mock
        element.fetchMessages = fetchMessagesMock;

        const event = new CustomEvent("select-conversation", { detail: { id: "conv2" } });
        await element.handleSelectConversation(event);

        expect(element.activeConversationId).toBe("conv2");
        expect(fetchMessagesMock).toHaveBeenCalled();
        expect(fetchMessagesMock.mock.calls[0][0]).toBe("conv2");
    });

    it("should add message when sending", async () => {
        element.activeConversationId = "conv1";
        element.messages = [
            {
                id: "1",
                conversationId: "conv1",
                content: "Old",
                role: "user",
                mode: "player",
                createdAt: new Date().toISOString(),
            },
        ];

        const mockMessage = {
            id: "2",
            conversationId: "conv1",
            content: "Test message",
            role: "user",
            mode: "player",
            createdAt: new Date().toISOString(),
        };

        // Mock the RPC client
        const mockResponse = {
            ok: true,
            json: () => Promise.resolve({ result: "success", data: mockMessage }),
        };
        // @ts-expect-error - override global fetch with our mock
        globalThis.fetch = mock(() => Promise.resolve(mockResponse));

        const event = new CustomEvent("send-message", { detail: { text: "Test message" } });
        await element.handleSendMessage(event);

        expect(element.messages.length).toBe(2);
        expect(element.messages[1].content).toBe("Test message");
    });

    it("should create new conversation", async () => {
        element.conversations = [
            { id: "conv1", title: "Old", userId: "user1", createdAt: new Date().toISOString() },
        ];

        const mockConv = {
            id: "conv2",
            title: "New Conversation",
            userId: "user1",
            createdAt: new Date().toISOString(),
        };

        let callCount = 0;
        const mockFetch = mock(() => {
            callCount++;
            if (callCount === 1) {
                // First call: create conversation
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: mockConv }),
                });
            } else {
                // Second call: fetch messages
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                });
            }
        });
        // @ts-expect-error - override global fetch with our mock
        globalThis.fetch = mockFetch;

        await element.handleNewChat();

        expect(element.conversations.length).toBe(2);
        expect(element.conversations[1].id).toBe("conv2");
        expect(element.activeConversationId).toBe("conv2");
    });
});
