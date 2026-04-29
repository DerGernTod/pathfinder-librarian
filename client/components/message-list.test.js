import "../components/message-list.js";
import { beforeEach, describe, expect, it, mock } from "bun:test";

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
            el.messages = messages;
        }
        document.body.appendChild(el);
        return el;
    }

    it("renders chat-message elements for each message", async () => {
        const el = createList([
            { id: "1", role: "user", content: "First", mode: "player" },
            { id: "2", role: "user", content: "Second", mode: "player" },
        ]);
        await el.updateComplete;
        const msgs = el.shadowRoot.querySelectorAll("chat-message");
        expect(msgs.length).toBe(2);
    });

    it("shows loading spinner when loading is true", async () => {
        const el = createList([]);
        el.loading = true;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".loading")).toBeTruthy();
        expect(el.shadowRoot.querySelector("sl-spinner")).toBeTruthy();
    });

    it("hides loading spinner when loading is false", async () => {
        const el = createList([]);
        el.loading = false;
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".loading")).toBeNull();
    });

});
