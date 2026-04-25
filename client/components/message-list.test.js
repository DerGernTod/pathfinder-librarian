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

    it("scrolls to bottom on first render", async () => {
        const messages = Array.from({ length: 50 }, (_, i) => ({
            id: String(i + 1),
            role: "user",
            content: `Message ${i + 1} with enough text to create overflow`,
            mode: "player",
        }));

        /** @type {any} */
        const el = document.createElement("message-list");
        el.messages = messages;

        const scrollToBottomSpy = mock(() => {});
        el.scrollToBottom = scrollToBottomSpy;

        document.body.appendChild(el);
        await el.updateComplete;

        expect(scrollToBottomSpy).toHaveBeenCalled();
    });

    it("scrolls to bottom when new message is added", async () => {
        const el = createList([
            { id: "1", role: "user", content: "First", mode: "player" },
            { id: "2", role: "user", content: "Second", mode: "player" },
        ]);
        await el.updateComplete;

        const container = el.shadowRoot.querySelector(".messages");
        const scrollToSpy = mock(() => {});
        container.scrollTo = scrollToSpy;

        Object.defineProperty(container, "scrollHeight", {
            value: 500,
            configurable: true,
        });

        el.messages = [
            ...el.messages,
            { id: "3", role: "user", content: "New message", mode: "player" },
        ];
        await el.updateComplete;

        expect(scrollToSpy).toHaveBeenCalledWith({
            top: 500,
            behavior: "smooth",
        });
    });

    it("does not re-scroll when non-message property changes", async () => {
        const messages = Array.from({ length: 50 }, (_, i) => ({
            id: String(i + 1),
            role: /** @type {"user"} */ ("user"),
            content: `Message ${i + 1}`,
            mode: /** @type {import("../../shared/types.js").Mode} */ ("player"),
        }));
        const el = createList(messages);
        await el.updateComplete;

        const container = el.shadowRoot.querySelector(".messages");
        const scrollToSpy = mock(() => {});
        container.scrollTo = scrollToSpy;

        el.loading = true;
        await el.updateComplete;

        expect(scrollToSpy).not.toHaveBeenCalled();
    });
});
