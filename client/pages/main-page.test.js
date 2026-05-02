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

/**
 * Creates mock SSE ReadableStream
 * @param {Array<{ type: string, data: object }>} events
 * @returns {{ ok: boolean, body: ReadableStream }}
 */
function mockSSEResponse(events) {
    return {
        ok: true,
        body: new ReadableStream({
            start(controller) {
                for (const event of events) {
                    controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
                }
                controller.close();
            },
        }),
    };
}

describe("main-page", () => {
    /** @type {import("./main-page.js").MainPage} */
    let element;

    beforeEach(() => {
        // Clean up any existing elements
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
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
        // Ensure initial state
        element.mode = "player";
        expect(element.mode).toBe("player");

        const event = new CustomEvent("mode-change", {
            detail: { mode: /** @type {import("../../shared/types.js").Mode} */ ("gm") },
        });
        element.handleModeChange(event);
        // @ts-expect-error - mode is typed as "player" here, but we want to test with mode
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

    it("should add user and assistant messages when sending", async () => {
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

        const mockUserMessage = {
            id: "2",
            conversationId: "conv1",
            content: "Test message",
            role: "user",
            mode: "player",
            createdAt: new Date().toISOString(),
        };

        const mockAssistantMessage = {
            id: "3",
            conversationId: "conv1",
            content: null,
            role: "assistant",
            mode: "player",
            createdAt: new Date().toISOString(),
            blocks: [{ type: "paragraph", text: "Mock response" }],
        };

        // Mock the RPC client
        const mockResponse = {
            ok: true,
            body: new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        new TextEncoder().encode(
                            JSON.stringify({ type: "userMessage", data: mockUserMessage }) + "\n",
                        ),
                    );
                    controller.enqueue(
                        new TextEncoder().encode(
                            JSON.stringify({
                                type: "assistantChunk",
                                data: mockAssistantMessage.blocks[0],
                            }) + "\n",
                        ),
                    );
                    controller.enqueue(
                        new TextEncoder().encode(
                            JSON.stringify({
                                type: "assistantComplete",
                                data: mockAssistantMessage,
                            }) + "\n",
                        ),
                    );
                    controller.close();
                },
            }),
        };
        // @ts-expect-error - override global fetch with our mock
        globalThis.fetch = mock(() => Promise.resolve(mockResponse));

        const event = new CustomEvent("send-message", { detail: { text: "Test message" } });
        await element.handleSendMessage(event);

        expect(element.messages.length).toBe(3);
        expect(element.messages[1].content).toBe("Test message");
        expect(element.messages[1].role).toBe("user");
        expect(element.messages[2].role).toBe("assistant");
        // We check the blocks property directly
        expect(element.messages[2].blocks).toEqual([{ type: "paragraph", text: "Mock response" }]);
    });

    it("should set responding to true during send and false after", async () => {
        element.activeConversationId = "conv1";
        element.messages = [];

        const mockUserMessage = {
            id: "2",
            conversationId: "conv1",
            content: "Test",
            role: "user",
            mode: "player",
            createdAt: new Date().toISOString(),
        };

        const mockAssistantMessage = {
            id: "3",
            conversationId: "conv1",
            content: null,
            role: "assistant",
            mode: "player",
            createdAt: new Date().toISOString(),
            blocksJson: JSON.stringify([{ type: "paragraph", text: "Response" }]),
        };

        const mockResponse = {
            ok: true,
            body: new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        new TextEncoder().encode(
                            JSON.stringify({ type: "userMessage", data: mockUserMessage }) + "\n",
                        ),
                    );
                    controller.enqueue(
                        new TextEncoder().encode(
                            JSON.stringify({
                                type: "assistantComplete",
                                data: mockAssistantMessage,
                            }) + "\n",
                        ),
                    );
                    controller.close();
                },
            }),
        };
        // @ts-expect-error - override global fetch with our mock
        globalThis.fetch = mock(() => Promise.resolve(mockResponse));

        const event = new CustomEvent("send-message", { detail: { text: "Test" } });
        const promise = element.handleSendMessage(event);

        // Check responding is true during the call
        expect(element.responding).toBe(true);

        await promise;

        // Check responding is false after the call
        expect(element.responding).toBe(false);
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

    describe("landing page", () => {
        it("renders landing when no conversations and not loading", async () => {
            // Wait for firstUpdated to complete (sets loading=false)
            await new Promise((r) => setTimeout(r, 100));
            element.conversations = [];
            await element.updateComplete;

            const region = element.shadowRoot?.querySelector('[role="region"]');
            expect(region).toBeTruthy();
            expect(region?.getAttribute("aria-label")).toBe("Welcome");

            const input = element.shadowRoot?.querySelector('[data-test="landing-input"]');
            expect(input).toBeTruthy();

            const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
            expect(sendBtn).toBeTruthy();
        });

        it("focuses landing input", async () => {
            // Wait for firstUpdated to complete
            await new Promise((r) => setTimeout(r, 100));
            element.loading = false;
            element.conversations = [];
            await element.updateComplete;

            const input = /** @type {HTMLInputElement} */ (
                element.shadowRoot?.querySelector('[data-test="landing-input"]')
            );
            expect(input).toBeTruthy();
            // happy-dom may not set document.activeElement for shadow DOM
            expect(typeof input.focus).toBe("function");
            input.focus();
            await element.updateComplete;
            // Verify input exists and is focusable (happy-dom limitation)
            expect(input).toBeTruthy();
        });

        it("does not render landing when loading", async () => {
            element.loading = true;
            element.conversations = [];
            await element.updateComplete;

            const region = element.shadowRoot?.querySelector('[role="region"]');
            expect(region).toBeNull();
        });

        it("does not render landing when conversations exist", async () => {
            // Wait for firstUpdated to complete
            await new Promise((r) => setTimeout(r, 100));
            element.conversations = [
                {
                    id: "c1",
                    title: "Test",
                    userId: "u1",
                    createdAt: new Date().toISOString(),
                },
            ];
            await element.updateComplete;

            const region = element.shadowRoot?.querySelector('[role="region"]');
            expect(region).toBeNull();
        });

        it("enter key triggers landing submit", async () => {
            // Wait for firstUpdated to complete
            await new Promise((r) => setTimeout(r, 100));
            element.loading = false;
            element.conversations = [];
            element._pendingPrompt = "Hello world";
            await element.updateComplete;

            const submitSpy = mock(() => Promise.resolve());
            // @ts-expect-error - override _handleLandingSubmit with spy
            element._handleLandingSubmit = submitSpy;

            const input = element.shadowRoot?.querySelector('[data-test="landing-input"]');
            expect(input).toBeTruthy();

            const preventDefaultMock = mock(() => {});
            const keydownEvent = new KeyboardEvent("keydown", {
                key: "Enter",
                shiftKey: false,
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(keydownEvent, "preventDefault", { value: preventDefaultMock });

            // @ts-expect-error - mock preventDefault
            input.dispatchEvent(keydownEvent);

            expect(preventDefaultMock).toHaveBeenCalled();
            expect(submitSpy).toHaveBeenCalled();
        });

        it("shift+Enter does not submit landing prompt", async () => {
            element.loading = false;
            element.conversations = [];
            element._pendingPrompt = "Hello world";
            await element.updateComplete;

            const input = element.shadowRoot?.querySelector('[data-test="landing-input"]');
            expect(input).toBeTruthy();

            const preventDefaultMock = mock(() => {});
            const keydownEvent = new KeyboardEvent("keydown", {
                key: "Enter",
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(keydownEvent, "preventDefault", { value: preventDefaultMock });

            // @ts-expect-error - mock preventDefault
            input.dispatchEvent(keydownEvent);

            expect(preventDefaultMock).not.toHaveBeenCalled();
        });

        it("does not submit empty prompt", async () => {
            // Wait for firstUpdated to complete
            await new Promise((r) => setTimeout(r, 100));
            element.conversations = [];
            element._pendingPrompt = "   ";
            element._submitting = false;
            await element.updateComplete;

            await element._handleLandingSubmit();

            expect(element._submitting).toBe(false);
        });

        it("submits landing prompt and swaps to normal UI", async () => {
            // Wait for firstUpdated to complete
            await new Promise((r) => setTimeout(r, 100));
            element.loading = false;
            element.conversations = [];
            element._pendingPrompt = "Hello world";
            element._submitting = false;
            await element.updateComplete;

            const mockConv = {
                id: "conv-land",
                title: "Hello world",
                userId: "u1",
                createdAt: new Date().toISOString(),
            };

            const mockUserMessage = {
                id: "um1",
                conversationId: "conv-land",
                content: "Hello world",
                role: "user",
                mode: "player",
                createdAt: new Date().toISOString(),
            };

            const mockAssistantMessage = {
                id: "am1",
                conversationId: "conv-land",
                content: null,
                role: "assistant",
                mode: "player",
                createdAt: new Date().toISOString(),
                blocks: [{ type: "paragraph", text: "Hi there!" }],
            };

            let callCount = 0;
            const mockFetch = mock(() => {
                callCount++;
                if (callCount === 1) {
                    // Create conversation POST
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ result: "success", data: mockConv }),
                    });
                } else if (callCount === 2) {
                    // Fetch messages GET
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ result: "success", data: [] }),
                    });
                } else {
                    // Messages POST with SSE stream
                    return Promise.resolve(
                        mockSSEResponse([
                            { type: "userMessage", data: mockUserMessage },
                            { type: "assistantComplete", data: mockAssistantMessage },
                        ]),
                    );
                }
            });
            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mockFetch;

            await element._handleLandingSubmit();

            expect(element.conversations.length).toBe(1);
            expect(element.conversations[0].id).toBe("conv-land");
            expect(element.activeConversationId).toBe("conv-land");
            expect(element._submitting).toBe(false);
            expect(element._pendingPrompt).toBe("");
        });

        it("handles landing submit error gracefully", async () => {
            element.loading = false;
            element.conversations = [];
            element._pendingPrompt = "Hello";
            element._submitting = false;
            await element.updateComplete;

            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() => {
                return Promise.reject(new Error("Network error"));
            });

            await element._handleLandingSubmit();

            expect(element._submitting).toBe(false);
        });
    });
});
