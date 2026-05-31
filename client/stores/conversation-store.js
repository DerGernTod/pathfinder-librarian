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
 *   fetchArchivedConversations: () => Promise<import("../../shared/types.js").Conversation[]>,
 *   archiveConversation: (id: string) => Promise<import("../../shared/types.js").Conversation>,
 *   restoreConversation: (id: string) => Promise<import("../../shared/types.js").Conversation>,
 *   deleteConversation: (id: string) => Promise<void>,
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

        /** @returns {Promise<import("../../shared/types.js").Conversation[]>} */
        async fetchArchivedConversations() {
            const res = await client.api.conversations.archived.$get();
            const result = await res.json();
            return /** @type {import("../../shared/types.js").Conversation[]} */ (result.data);
        },

        /** @param {string} id @returns {Promise<import("../../shared/types.js").Conversation>} */
        async archiveConversation(id) {
            const res = await client.api.conversations[":id"].archive.$patch({ param: { id } });
            const result = /** @type {{ data: import("../../shared/types.js").Conversation }} */ (
                await res.json()
            );
            return result.data;
        },

        /** @param {string} id @returns {Promise<import("../../shared/types.js").Conversation>} */
        async restoreConversation(id) {
            const res = await client.api.conversations[":id"].restore.$patch({ param: { id } });
            const result = /** @type {{ data: import("../../shared/types.js").Conversation }} */ (
                await res.json()
            );
            return result.data;
        },

        /** @param {string} id @returns {Promise<void>} */
        async deleteConversation(id) {
            await client.api.conversations[":id"].$delete({ param: { id } });
        },
    };
}

export { conversationContext, createConversationStore };
