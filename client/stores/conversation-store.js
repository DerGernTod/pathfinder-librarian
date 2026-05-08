import { createContext } from "@lit/context";

import { client } from "../utils/rpc-client.js";

/**
 * @typedef {{
 *   conversations: import("../../shared/types.js").Conversation[],
 *   activeConversationId: string,
 *   loading: boolean,
 *   loadingConversationId?: string
 * }} ConversationState
 */

/** @type {ReturnType<typeof import("@lit/context").createContext<ConversationState>>} */
const conversationContext = createContext("conversation");

/**
 * Creates a conversation store with methods for managing conversation state.
 * The store is stateless — all state is managed by the ContextProvider.
 * @returns {{
 *   fetchConversations: () => Promise<import("../../shared/types.js").Conversation[]>,
 *   createConversation: (title: string) => Promise<import("../../shared/types.js").Conversation>,
 * }}
 */
function createConversationStore() {
    return {
        /**
         * @returns {Promise<import("../../shared/types.js").Conversation[]>}
         */
        async fetchConversations() {
            const res = await client.api.conversations.$get();
            const result = await res.json();
            return /** @type {import("../../shared/types.js").Conversation[]} */ (result.data);
        },

        /**
         * @param {string} title
         * @returns {Promise<import("../../shared/types.js").Conversation>}
         */
        async createConversation(title) {
            const res = await client.api.conversations.$post({
                json: { title },
            });
            const conv = await res.json();
            return /** @type {import("../../shared/types.js").Conversation} */ (conv.data);
        },
    };
}

export { conversationContext, createConversationStore };
