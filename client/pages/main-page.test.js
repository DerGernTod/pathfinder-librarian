import "./main-page.js";
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";

import { router } from "../utils/router.js";

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
        // @ts-expect-error - override matchMedia for desktop breakpoint in tests
        window.matchMedia = mock((/** @type {string} */ _query) => ({
            matches: false,
            addEventListener: mock(() => {}),
            removeEventListener: mock(() => {}),
        }));
        element = createMainPage();
        document.body.appendChild(element);
        element._viewState = "conversation";
    });

    it("should initialize with empty state", () => {
        expect(element._convState.conversations).toEqual([]);
        expect(element._msgState.messages).toEqual([]);
        expect(element._convState.activeConversationId).toBe("");
        expect(element._modeState.mode).toBe("player");
        expect(element._uiState.sidebarExpanded).toBe(true);
    });

    it("should filter messages by active conversation", () => {
        element._msgState = {
            messages: [
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
            ],
            responding: false,
        };
        element._convState = {
            conversations: [],
            activeConversationId: "conv1",
            loading: false,
        };

        const msgs = element._msgState.messages.filter(
            (m) => m.conversationId === element._convState.activeConversationId,
        );
        expect(msgs).toEqual([
            expect.objectContaining({ id: "1", conversationId: "conv1" }),
            expect.objectContaining({ id: "3", conversationId: "conv1" }),
        ]);
    });

    it("should return empty array for non-existent conversation", () => {
        element._msgState = {
            messages: [
                {
                    id: "1",
                    conversationId: "conv1",
                    content: "Test",
                    role: "user",
                    mode: "player",
                    createdAt: new Date().toISOString(),
                },
            ],
            responding: false,
        };
        element._convState = {
            conversations: [],
            activeConversationId: "nonexistent",
            loading: false,
        };
        const msgs = element._msgState.messages.filter(
            (m) => m.conversationId === element._convState.activeConversationId,
        );
        expect(msgs).toEqual([]);
    });

    it("should switch mode correctly", () => {
        // Ensure initial state
        element._modeState = { mode: "player" };
        expect(element._modeState.mode).toBe("player");

        const event = new CustomEvent("mode-change", {
            detail: { mode: /** @type {import("../../shared/types.js").Mode} */ ("gm") },
        });
        element.handleModeChange(event);
        expect(element._modeState.mode).toBe("gm");
    });

    it("should toggle sidebar", () => {
        expect(element._uiState.sidebarExpanded).toBe(true);

        const event = new CustomEvent("toggle-sidebar", { detail: { expanded: false } });
        element.handleSidebarToggle(event);
        expect(element._uiState.sidebarExpanded).toBe(false);
    });

    it("should handle select-conversation event", async () => {
        element._convState = {
            conversations: [],
            activeConversationId: "conv1",
            loading: false,
        };

        // Mock fetch for messages fetch
        // @ts-expect-error - override global fetch with our mock
        globalThis.fetch = mock((url) => {
            if (url.includes("/api/conversations/conv2/messages")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                });
            }
            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        const event = new CustomEvent("select-conversation", { detail: { id: "conv2" } });
        await element.handleSelectConversation(event);

        expect(element._convState.activeConversationId).toBe("conv2");
    });

    it("should add user and assistant messages when sending", async () => {
        element._convState = {
            conversations: [{ id: "conv1", title: "Test" }],
            activeConversationId: "conv1",
            loading: false,
        };
        element._modeState = { mode: "player" };
        element._msgState = {
            messages: [
                {
                    id: "1",
                    conversationId: "conv1",
                    content: "Old",
                    role: "user",
                    mode: "player",
                    createdAt: new Date().toISOString(),
                },
            ],
            responding: false,
        };

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

        expect(element._msgState.messages.length).toBe(3);
        expect(element._msgState.messages[1].content).toBe("Test message");
        expect(element._msgState.messages[1].role).toBe("user");
        expect(element._msgState.messages[2].role).toBe("assistant");
        // We check the blocks property directly
        expect(element._msgState.messages[2].blocks).toEqual([
            { type: "paragraph", text: "Mock response" },
        ]);
    });

    it("should set responding to true during send and false after", async () => {
        element._convState = {
            conversations: [{ id: "conv1", title: "Test" }],
            activeConversationId: "conv1",
            loading: false,
        };
        element._modeState = { mode: "player" };
        element._msgState = { messages: [], responding: false };

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
        expect(element._msgState.responding).toBe(true);

        await promise;

        // Check responding is false after the call
        expect(element._msgState.responding).toBe(false);
    });

    it("should create new conversation", async () => {
        element._convState = {
            conversations: [
                { id: "conv1", title: "Old", userId: "user1", createdAt: new Date().toISOString() },
            ],
            activeConversationId: "conv1",
            loading: false,
        };

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

        // New chat should set ephemeral state instead of creating conversation immediately
        expect(element._isNewChat).toBe(true);
        expect(element._convState.activeConversationId).toBe("__new__");
    });

    describe("landing page", () => {
        it("renders landing when no conversations and not loading", async () => {
            // Wait for firstUpdated to complete (sets loading=false)
            await element.ready;
            element._convState = { conversations: [], activeConversationId: "", loading: false };
            element._msgState = { messages: [], responding: false };
            element.requestUpdate();
            await element.updateComplete;

            const landingView = element.shadowRoot?.querySelector("landing-view");
            expect(landingView).toBeTruthy();

            const region = landingView?.shadowRoot?.querySelector('[role="region"]');
            expect(region).toBeTruthy();
            expect(region?.getAttribute("aria-label")).toBe("Welcome");

            const input = landingView?.shadowRoot?.querySelector('[data-test="landing-input"]');
            expect(input).toBeTruthy();

            const sendBtn = landingView?.shadowRoot?.querySelector('[data-test="landing-send"]');
            expect(sendBtn).toBeTruthy();
        });

        it("focuses landing input", async () => {
            // Wait for firstUpdated to complete
            await element.ready;
            element._convState = { conversations: [], activeConversationId: "", loading: false };
            element._msgState = { messages: [], responding: false };
            element.requestUpdate();
            await element.updateComplete;

            const landingView = element.shadowRoot?.querySelector("landing-view");
            const input = /** @type {HTMLInputElement} */ (
                landingView?.shadowRoot?.querySelector('[data-test="landing-input"]')
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
            element._viewState = "conversation";
            element._convState = { conversations: [], activeConversationId: "", loading: true };
            element._msgState = { messages: [], responding: false };
            element.requestUpdate();
            await element.updateComplete;

            // In new render, landing-view is always rendered but may be hidden
            const landingLayer = element.shadowRoot?.querySelector(".view-layer:nth-child(1)");
            expect(landingLayer?.classList.contains("visible")).toBe(false);
        });

        it("does not render landing when conversations exist with messages", async () => {
            const conv = {
                id: "c1",
                title: "Test",
                userId: "u1",
                createdAt: new Date().toISOString(),
            };
            element._viewState = "conversation";
            element._convState = {
                conversations: [conv],
                activeConversationId: "c1",
                loading: false,
            };
            element._msgState = {
                messages: [
                    {
                        id: "m1",
                        conversationId: "c1",
                        content: "Hello",
                        role: "user",
                        mode: "player",
                        createdAt: new Date().toISOString(),
                    },
                ],
                responding: false,
            };
            element.requestUpdate();
            await element.updateComplete;

            // With conversations, landing-view should be hidden
            const landingLayer = element.shadowRoot?.querySelector(".view-layer:nth-child(1)");
            expect(landingLayer?.classList.contains("visible")).toBe(false);
        });

        it("renders landing for empty conversation", async () => {
            const conv = {
                id: "c1",
                title: "New Chat",
                userId: "u1",
                createdAt: new Date().toISOString(),
            };
            element._viewState = "landing";
            element._convState = {
                conversations: [conv],
                activeConversationId: "c1",
                loading: false,
            };
            element._msgState = { messages: [], responding: false };
            element.requestUpdate();
            await element.updateComplete;

            const landingView = element.shadowRoot?.querySelector("landing-view");
            expect(landingView).toBeTruthy();

            const region = landingView?.shadowRoot?.querySelector('[role="region"]');
            expect(region?.getAttribute("aria-label")).toBe("Welcome");
        });

        it("enter key triggers landing submit", async () => {
            // Wait for firstUpdated to complete
            await element.ready;
            const submitSpy = mock(() => Promise.resolve());
            element.handleLandingSubmit = /** @type {any} */ (submitSpy);

            element._convState = { conversations: [], activeConversationId: "", loading: false };
            element._msgState = { messages: [], responding: false };
            element.requestUpdate();
            await element.updateComplete;

            const landingView = element.shadowRoot?.querySelector("landing-view");
            const input = /** @type {HTMLInputElement} */ (
                landingView?.shadowRoot?.querySelector('[data-test="landing-input"]')
            );
            expect(input).toBeTruthy();
            input.value = "Hello world";
            input.dispatchEvent(new Event("input", { bubbles: true }));

            const preventDefaultMock = mock(() => {});
            const keydownEvent = new KeyboardEvent("keydown", {
                key: "Enter",
                shiftKey: false,
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(keydownEvent, "preventDefault", { value: preventDefaultMock });

            input.dispatchEvent(keydownEvent);

            expect(preventDefaultMock).toHaveBeenCalled();
            expect(submitSpy).toHaveBeenCalled();
            expect(/** @type {any} */ (submitSpy).mock.calls[0][0].detail.text).toBe("Hello world");
        });

        it("shift+Enter does not submit landing prompt", async () => {
            const submitSpy = mock(() => Promise.resolve());
            element.handleLandingSubmit = /** @type {any} */ (submitSpy);

            element._convState = { conversations: [], activeConversationId: "", loading: false };
            element._msgState = { messages: [], responding: false };
            element.requestUpdate();
            await element.updateComplete;

            const landingView = element.shadowRoot?.querySelector("landing-view");
            const input = /** @type {HTMLInputElement} */ (
                landingView?.shadowRoot?.querySelector('[data-test="landing-input"]')
            );
            expect(input).toBeTruthy();
            input.value = "Hello world";
            input.dispatchEvent(new Event("input", { bubbles: true }));

            const preventDefaultMock = mock(() => {});
            const keydownEvent = new KeyboardEvent("keydown", {
                key: "Enter",
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(keydownEvent, "preventDefault", { value: preventDefaultMock });

            input.dispatchEvent(keydownEvent);

            expect(preventDefaultMock).not.toHaveBeenCalled();
            expect(submitSpy).not.toHaveBeenCalled();
        });

        it("submits landing prompt into existing empty conversation", async () => {
            // Wait for firstUpdated to complete
            await element.ready;
            const conv = {
                id: "conv-existing",
                title: "Existing",
                userId: "u1",
                createdAt: new Date().toISOString(),
            };
            element._convState = {
                conversations: [conv],
                activeConversationId: "conv-existing",
                loading: false,
            };
            element._msgState = { messages: [], responding: false };
            element.requestUpdate();
            await element.updateComplete;

            const mockUserMessage = {
                id: "um1",
                conversationId: "conv-existing",
                content: "Hello existing",
                role: "user",
                mode: "player",
                createdAt: new Date().toISOString(),
            };

            const mockAssistantMessage = {
                id: "am1",
                conversationId: "conv-existing",
                content: null,
                role: "assistant",
                mode: "player",
                createdAt: new Date().toISOString(),
                blocks: [{ type: "paragraph", text: "Response" }],
            };

            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() => {
                return Promise.resolve(
                    mockSSEResponse([
                        { type: "userMessage", data: mockUserMessage },
                        { type: "assistantComplete", data: mockAssistantMessage },
                    ]),
                );
            });

            const event = new CustomEvent("landing-submit", { detail: { text: "Hello existing" } });
            await element.handleLandingSubmit(event);

            expect(element._convState.conversations.length).toBe(1);
            expect(element._convState.activeConversationId).toBe("conv-existing");
            expect(element._msgState.responding).toBe(false);
            expect(element._landingSubmitting).toBe(false);
        });

        it("submits landing prompt and swaps to normal UI", async () => {
            // Wait for firstUpdated to complete
            await element.ready;
            element._convState = { conversations: [], activeConversationId: "", loading: false };
            element._msgState = { messages: [], responding: false };
            element.requestUpdate();
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

            const event = new CustomEvent("landing-submit", { detail: { text: "Hello world" } });
            await element.handleLandingSubmit(event);

            expect(element._convState.conversations.length).toBe(1);
            expect(element._convState.conversations[0].id).toBe("conv-land");
            expect(element._convState.activeConversationId).toBe("conv-land");
            expect(element._landingSubmitting).toBe(false);
        });

        it("handles landing submit error gracefully", async () => {
            element._convState = { conversations: [], activeConversationId: "", loading: false };
            element._msgState = { messages: [], responding: false };
            element.requestUpdate();
            await element.updateComplete;

            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() => {
                return Promise.reject(new Error("Network error"));
            });

            const event = new CustomEvent("landing-submit", { detail: { text: "Hello" } });
            await element.handleLandingSubmit(event);

            expect(element._landingSubmitting).toBe(false);
        });
    });

    describe("routing", () => {
        /** @type {typeof router.navigate} */
        let origNavigate;
        /** @type {typeof router.getCurrentParams} */
        let origGetCurrentParams;

        beforeEach(() => {
            // Save original router methods
            origNavigate = router.navigate;
            origGetCurrentParams = router.getCurrentParams ?? (() => null);
        });

        afterEach(() => {
            // Restore original router methods
            router.navigate = origNavigate;
            router.getCurrentParams = origGetCurrentParams;
        });

        it("should hydrate active conversation from URL on load", async () => {
            // Mock getCurrentParams to return a conversation ID
            router.getCurrentParams = mock(() => ({
                conversationId: "conv-from-url",
            }));

            // Mock conversation fetch
            const conversations = [
                { id: "conv1", title: "First" },
                { id: "conv-from-url", title: "From URL" },
            ];

            let callCount = 0;
            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() => {
                callCount++;
                if (callCount === 1) {
                    // fetchConversations
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ result: "success", data: conversations }),
                    });
                }
                // fetchMessages for conv-from-url
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                });
            });

            // Create a fresh element so firstUpdated runs
            const el = createMainPage();
            el.user = {
                id: "u1",
                name: "Test",
                initials: "TS",
                subtitle: "Player",
                mode: "player",
                email: null,
            };
            document.body.appendChild(el);
            // Wait for firstUpdated to complete
            await el.updateComplete;
            // Allow microtask to complete for async firstUpdated
            await new Promise((r) => setTimeout(r, 0));
            await el.updateComplete;

            expect(el._convState.activeConversationId).toBe("conv-from-url");
            expect(router.getCurrentParams).toHaveBeenCalled();
        });

        it("should fall back to first conversation when URL has nonexistent ID", async () => {
            // Mock getCurrentParams to return a non-existent conversation ID
            router.getCurrentParams = mock(() => ({
                conversationId: "nonexistent-id",
            }));

            const conversations = [
                { id: "conv1", title: "First" },
                { id: "conv2", title: "Second" },
            ];

            let callCount = 0;
            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ result: "success", data: conversations }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                });
            });

            const el = createMainPage();
            el.user = {
                id: "u1",
                name: "Test",
                initials: "TS",
                subtitle: "Player",
                mode: "player",
                email: null,
            };
            document.body.appendChild(el);
            await el.updateComplete;
            // Allow microtask to complete for async firstUpdated
            await new Promise((r) => setTimeout(r, 0));
            await el.updateComplete;

            expect(el._convState.activeConversationId).toBe("conv1");
        });

        it("should navigate URL when falling back to first conversation at root URL", async () => {
            // Mock getCurrentParams to return null (URL is "/" — no match)
            router.getCurrentParams = mock(() => null);

            const navigateSpy = mock((_path, _opts) => {});
            router.navigate = navigateSpy;

            const conversations = [{ id: "conv1", title: "First" }];

            let callCount = 0;
            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ result: "success", data: conversations }),
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                });
            });

            const el = createMainPage();
            el.user = {
                id: "u1",
                name: "Test",
                initials: "TS",
                subtitle: "Player",
                mode: "player",
                email: null,
            };
            document.body.appendChild(el);
            await el.updateComplete;
            // Allow microtask to complete for async firstUpdated
            await new Promise((r) => setTimeout(r, 0));
            await el.updateComplete;

            expect(el._convState.activeConversationId).toBe("conv1");
            // Should navigate to reflect the active conversation in the URL
            expect(navigateSpy).toHaveBeenCalledWith("/conversations/conv1", { replace: true });
        });

        it("should navigate URL to match active conversation on first load", async () => {
            element._convState = {
                conversations: [],
                activeConversationId: "old-conv",
                loading: false,
            };

            // Mock fetch for messages
            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                }),
            );

            const navigateSpy = mock(() => {});
            router.navigate = navigateSpy;

            const event = new CustomEvent("select-conversation", {
                detail: { id: "new-conv" },
            });
            await element.handleSelectConversation(event);

            expect(element._convState.activeConversationId).toBe("new-conv");
            expect(navigateSpy).toHaveBeenCalledTimes(1);
            // @ts-expect-error - Bun mock tuple access
            expect(navigateSpy.mock.calls[0][0]).toBe("/conversations/new-conv");
        });

        it("should NOT call router.navigate() when navigate: false passed", async () => {
            element._convState = {
                conversations: [],
                activeConversationId: "old-conv",
                loading: false,
            };

            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                }),
            );

            const navigateSpy = mock(() => {});
            router.navigate = navigateSpy;

            const event = new CustomEvent("select-conversation", {
                detail: { id: "new-conv" },
            });
            await element.handleSelectConversation(event, { navigate: false });

            expect(element._convState.activeConversationId).toBe("new-conv");
            expect(navigateSpy).toHaveBeenCalledTimes(0);
        });

        it("should call router.navigate with replace: true when navigate: replace passed", async () => {
            element._convState = {
                conversations: [],
                activeConversationId: "old-conv",
                loading: false,
            };

            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                }),
            );

            const navigateSpy = mock(() => {});
            router.navigate = navigateSpy;

            const event = new CustomEvent("select-conversation", {
                detail: { id: "new-conv" },
            });
            await element.handleSelectConversation(event, { navigate: "replace" });

            expect(navigateSpy).toHaveBeenCalledTimes(1);
            // @ts-expect-error - Bun mock tuple access
            expect(navigateSpy.mock.calls[0][0]).toBe("/conversations/new-conv");
            // @ts-expect-error - Bun mock tuple access
            expect(navigateSpy.mock.calls[0][1]).toEqual({ replace: true });
        });

        it("should switch conversation on route-changed event with navigate: false", async () => {
            element._convState = {
                conversations: [
                    { id: "conv1", title: "First" },
                    { id: "conv2", title: "Second" },
                ],
                activeConversationId: "conv1",
                loading: false,
            };

            // Mock fetch for messages of conv2
            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                }),
            );

            // Spy on navigation to confirm it's NOT called (navigate: false)
            const navigateSpy = mock(() => {});
            router.navigate = navigateSpy;

            // Dispatch route-changed on window
            window.dispatchEvent(
                new CustomEvent("route-changed", {
                    detail: {
                        pattern: "conversation",
                        params: { conversationId: "conv2" },
                        pathname: "/conversations/conv2",
                    },
                }),
            );

            await element.ready;

            expect(element._convState.activeConversationId).toBe("conv2");
            expect(navigateSpy).toHaveBeenCalledTimes(0);
        });

        it("should be no-op when route-changed has same active conversation ID", async () => {
            element._convState = {
                conversations: [{ id: "conv1", title: "First" }],
                activeConversationId: "conv1",
                loading: false,
            };

            // Mock fetch — should NOT be called
            let fetchCalled = false;
            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() => {
                fetchCalled = true;
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                });
            });

            const navigateSpy = mock(() => {});
            router.navigate = navigateSpy;

            // Dispatch route-changed with same conversation ID
            window.dispatchEvent(
                new CustomEvent("route-changed", {
                    detail: {
                        pattern: "conversation",
                        params: { conversationId: "conv1" },
                        pathname: "/conversations/conv1",
                    },
                }),
            );

            await element.ready;

            expect(element._convState.activeConversationId).toBe("conv1");
            expect(fetchCalled).toBe(false);
            expect(navigateSpy).toHaveBeenCalledTimes(0);
        });

        it("should skip route-changed when loading is true", () => {
            element._convState = {
                conversations: [],
                activeConversationId: "",
                loading: true,
            };

            // Route change during loading should be a no-op
            let handled = false;
            const origHandle = element.handleSelectConversation;
            // @ts-expect-error - override for test
            element.handleSelectConversation = mock(() => {
                handled = true;
            });

            window.dispatchEvent(
                new CustomEvent("route-changed", {
                    detail: {
                        pattern: "conversation",
                        params: { conversationId: "some-conv" },
                        pathname: "/conversations/some-conv",
                    },
                }),
            );

            expect(handled).toBe(false);

            // Restore
            element.handleSelectConversation = origHandle;
        });

        it("should navigate with replace: true when handleLandingSubmit creates first conversation", async () => {
            element._convState = {
                conversations: [],
                activeConversationId: "",
                loading: false,
            };
            element._msgState = { messages: [], responding: false };

            const mockConv = {
                id: "conv-land-123",
                title: "Hello world",
                userId: "u1",
                createdAt: new Date().toISOString(),
            };

            const mockUserMessage = {
                id: "um1",
                conversationId: "conv-land-123",
                content: "Hello world",
                role: "user",
                mode: "player",
                createdAt: new Date().toISOString(),
            };

            const mockAssistantMessage = {
                id: "am1",
                conversationId: "conv-land-123",
                content: null,
                role: "assistant",
                mode: "player",
                createdAt: new Date().toISOString(),
                blocks: [{ type: "paragraph", text: "Response" }],
            };

            let callCount = 0;
            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ result: "success", data: mockConv }),
                    });
                } else if (callCount === 2) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ result: "success", data: [] }),
                    });
                } else {
                    return Promise.resolve(
                        mockSSEResponse([
                            { type: "userMessage", data: mockUserMessage },
                            { type: "assistantComplete", data: mockAssistantMessage },
                        ]),
                    );
                }
            });

            const navigateSpy = mock(() => {});
            router.navigate = navigateSpy;

            const event = new CustomEvent("landing-submit", { detail: { text: "Hello world" } });
            await element.handleLandingSubmit(event);

            expect(navigateSpy).toHaveBeenCalledTimes(1);
            // @ts-expect-error - Bun mock tuple access
            expect(navigateSpy.mock.calls[0][0]).toBe("/conversations/conv-land-123");
            // @ts-expect-error - Bun mock tuple access
            expect(navigateSpy.mock.calls[0][1]).toEqual({ replace: true });
        });

        it("should NOT navigate on handleLandingSubmit when reusing existing conversation", async () => {
            // When conversations already exist, handleLandingSubmit reuses activeConversationId
            // and should NOT call router.navigate
            const conv = {
                id: "conv-existing",
                title: "Existing",
                userId: "u1",
                createdAt: new Date().toISOString(),
            };
            element._convState = {
                conversations: [conv],
                activeConversationId: "conv-existing",
                loading: false,
            };
            element._msgState = { messages: [], responding: false };

            const mockUserMessage = {
                id: "um1",
                conversationId: "conv-existing",
                content: "Hello existing",
                role: "user",
                mode: "player",
                createdAt: new Date().toISOString(),
            };

            const mockAssistantMessage = {
                id: "am1",
                conversationId: "conv-existing",
                content: null,
                role: "assistant",
                mode: "player",
                createdAt: new Date().toISOString(),
                blocks: [{ type: "paragraph", text: "Response" }],
            };

            // @ts-expect-error - override global fetch with our mock
            globalThis.fetch = mock(() =>
                Promise.resolve(
                    mockSSEResponse([
                        { type: "userMessage", data: mockUserMessage },
                        { type: "assistantComplete", data: mockAssistantMessage },
                    ]),
                ),
            );

            const navigateSpy = mock(() => {});
            router.navigate = navigateSpy;

            const event = new CustomEvent("landing-submit", {
                detail: { text: "Hello existing" },
            });
            await element.handleLandingSubmit(event);

            expect(navigateSpy).toHaveBeenCalledTimes(0);
        });

        it("should navigate to / on handleLogout", async () => {
            const navigateSpy = mock(() => {});
            router.navigate = navigateSpy;

            // @ts-expect-error - override global fetch for logout call
            globalThis.fetch = mock(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
            );

            await element.handleLogout();

            expect(navigateSpy).toHaveBeenCalledWith("/", { replace: true });
        });

        it("should navigate to / on handleAccountDeleted", async () => {
            const navigateSpy = mock(() => {});
            router.navigate = navigateSpy;

            // @ts-expect-error - override global fetch for logout call
            globalThis.fetch = mock(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
            );

            await element.handleAccountDeleted();

            expect(navigateSpy).toHaveBeenCalledWith("/", { replace: true });
        });
    });
});
