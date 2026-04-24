import { beforeEach, describe, expect, it, mock } from "bun:test";

import "./main-page.js";

describe("main-page autoscroll", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /**
     * @param {import("../../shared/types.js").Message[]} [messages]
     */
    function createPage(messages) {
        /** @type {any} */
        const el = document.createElement("main-page");
        if (messages !== undefined) {
            el.messages = messages;
        }
        document.body.appendChild(el);
        return el;
    }

    it("scrolls to bottom on first render", async () => {
        const messages = Array.from({ length: 50 }, (_, i) => ({
            id: String(i + 1),
            role: "user",
            content: `Message ${i + 1} with enough text to create overflow`,
        }));

        /** @type {any} */
        const el = document.createElement("main-page");
        el.messages = messages;

        const scrollToBottomSpy = mock(() => {});
        el.scrollToBottom = scrollToBottomSpy;

        document.body.appendChild(el);
        await el.updateComplete;

        expect(scrollToBottomSpy).toHaveBeenCalled();
    });

    it("scrolls to bottom when new message is added", async () => {
        const el = createPage([
            { id: "1", role: "user", content: "First" },
            { id: "2", role: "user", content: "Second" },
        ]);
        await el.updateComplete;

        const container = el.shadowRoot.querySelector(".messages");
        const scrollToSpy = mock(() => {});
        container.scrollTo = scrollToSpy;

        Object.defineProperty(container, "scrollHeight", {
            value: 500,
            configurable: true,
        });

        el.messages = [...el.messages, { id: "3", role: "user", content: "New message" }];
        await el.updateComplete;

        expect(scrollToSpy).toHaveBeenCalledWith({
            top: 500,
            behavior: "smooth",
        });
    });

    it("does not re-scroll when non-message property changes", async () => {
        const messages = Array.from({ length: 50 }, (_, i) => ({
            id: String(i + 1),
            role: "user",
            content: `Message ${i + 1}`,
        }));
        const el = createPage(messages);
        await el.updateComplete;

        const container = el.shadowRoot.querySelector(".messages");
        const scrollToSpy = mock(() => {});
        container.scrollTo = scrollToSpy;

        el.mode = "gm";
        await el.updateComplete;

        expect(scrollToSpy).not.toHaveBeenCalled();
    });
});
