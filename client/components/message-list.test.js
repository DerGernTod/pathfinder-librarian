import "../components/message-list.js";
import { beforeEach, describe, expect, it } from "bun:test";

describe("message-list", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /**
     * @param {import("../../shared/types.js").Message[]} [messages]
     */
    function createList(messages) {
        /** @type {any} */
        const el = document.createElement("message-list");
        if (messages !== undefined) {
            el._msgState = { messages, responding: false };
        }
        document.body.appendChild(el);
        return el;
    }

    it("renders chat-message elements for each message", async () => {
        const el = createList([
            {
                id: "1",
                role: "user",
                content: "First",
                mode: "player",
                conversationId: "conv1",
                createdAt: "2026-05-02T12:00:00Z",
            },
            {
                id: "2",
                role: "user",
                content: "Second",
                mode: "player",
                conversationId: "conv1",
                createdAt: "2026-05-02T12:01:00Z",
            },
        ]);
        await el.updateComplete;
        const msgs = el.shadowRoot.querySelectorAll("chat-message");
        expect(msgs.length).toBe(2);
    });

    it("shows loading spinner when responding is true", async () => {
        const el = createList([]);
        el._msgState = { messages: [], responding: true };
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".loading")).toBeTruthy();
        expect(el.shadowRoot.querySelector("sl-spinner")).toBeTruthy();
    });

    it("hides loading spinner when responding is false", async () => {
        const el = createList([]);
        el._msgState = { messages: [], responding: false };
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".loading")).toBeNull();
    });
});
