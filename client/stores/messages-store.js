import { createContext } from "@lit/context";

import { client } from "../utils/rpc-client.js";

/**
 * @typedef {{ delay: number, attempt: number, maxAttempts: number }} RetryInfo
 * @typedef {{
 *   messages: import("../../shared/types.js").Message[],
 *   responding: boolean,
 *   retryInfo?: RetryInfo | null,
 *   error?: string | null
 * }} MessagesState
 */

/**
 * @typedef {{ type: "conversation", data: import("../../shared/types.js").Conversation }} SSEConversationEvent
 * @typedef {{ type: "userMessage", data: import("../../shared/types.js").Message }} SSEUserMessageEvent
 * @typedef {{ type: "assistantChunk", data: import("../../shared/types.js").MessageBlock }} SSEChunkEvent
 * @typedef {{ type: "assistantComplete", data: import("../../shared/types.js").AssistantMessage }} SSECompleteEvent
 * @typedef {{ type: "retryScheduled", data: { delay: number, attempt: number, maxAttempts: number } }} SSERetryScheduledEvent
 * @typedef {{ type: "retryFailed", data: { message: string } }} SSERetryFailedEvent
 * @typedef {{ type: "error", data: { message: string } }} SSEErrorEvent
 * @typedef {SSEConversationEvent | SSEUserMessageEvent | SSEChunkEvent | SSECompleteEvent | SSERetryScheduledEvent | SSERetryFailedEvent | SSEErrorEvent} SSEEvent
 */

/** @type {ReturnType<typeof import("@lit/context").createContext<MessagesState>>} */
const messagesContext = createContext("messages");

/**
 * Creates a messages store with methods for managing message state.
 * The store is stateless — all state is managed by the ContextProvider.
 * @returns {{
 *   fetchMessages: (convId: string) => Promise<import("../../shared/types.js").Message[]>,
 *   parseSSEStream: (body: ReadableStream<Uint8Array>) => AsyncGenerator<SSEEvent>,
 * }}
 */
function createMessagesStore() {
    return {
        /**
         * @param {string} convId
         * @returns {Promise<import("../../shared/types.js").Message[]>}
         */
        async fetchMessages(convId) {
            const res = await client.api.conversations[":id"].messages.$get({
                param: { id: convId },
            });
            const result = await res.json();
            return /** @type {import("../../shared/types.js").Message[]} */ (result.data);
        },

        /**
         * Parses an SSE ReadableStream into typed events.
         * @param {ReadableStream<Uint8Array>} body
         * @returns {AsyncGenerator<SSEEvent>}
         */
        async *parseSSEStream(body) {
            const reader = body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const result = await reader.read();
                    if (result.done) {
                        break;
                    }
                    const value = result.value;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n").filter(Boolean);
                    for (const line of lines) {
                        /** @type {unknown} */
                        const data = JSON.parse(line);
                        if (
                            typeof data === "object" &&
                            data !== null &&
                            "type" in data &&
                            typeof data.type === "string" &&
                            "data" in data
                        ) {
                            /** @type {SSEEvent} */
                            const typedData = /** @type {SSEEvent} */ (data);
                            yield typedData;
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
        },
    };
}

/**
 * Filters messages by conversation ID.
 * @param {import("../../shared/types.js").Message[]} messages
 * @param {string} activeConversationId
 * @returns {import("../../shared/types.js").Message[]}
 */
function filteredMessages(messages, activeConversationId) {
    return messages.filter((message) => message.conversationId === activeConversationId);
}

export { messagesContext, createMessagesStore, filteredMessages };
