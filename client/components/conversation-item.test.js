import { describe, test, expect, beforeEach, mock } from "bun:test";

import "./conversation-item.js";

describe("conversation-item", () => {
    /** @type {HTMLDivElement} */
    let container;

    /**
     * @param {{ id?: string, title?: string }} [opts]
     * @returns {any}
     */
    function createItem(opts) {
        /** @type {any} */
        const el = document.createElement("conversation-item");
        el.conversation = {
            id: opts?.id ?? "test-conv-1",
            title: opts?.title ?? "Test Conversation",
        };
        // Override context consumer to provide default state
        el._convState = {
            conversations: [],
            activeConversationId: "",
            loading: false,
        };
        return el;
    }

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    test("renders conversation title", async () => {
        const el = createItem({ title: "My Conversation" });
        container.appendChild(el);
        await el.updateComplete;

        const titleEl = el.shadowRoot.querySelector(".item-title");
        expect(titleEl).toBeTruthy();
        expect(titleEl?.textContent?.trim()).toBe("My Conversation");
    });

    test("dispatches select event on click", async () => {
        /** @type {import("bun:test").Mock<(arg: CustomEvent<{ id: string }>) => void>} */
        const listener = mock(() => {});
        const el = createItem();
        el.addEventListener("select", listener);
        container.appendChild(el);
        await el.updateComplete;

        const item = el.shadowRoot.querySelector(".item");
        item?.click();

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0].detail.id).toBe("test-conv-1");
    });

    test("dispatches archive-conversation event with conversation id when archive is clicked", async () => {
        /** @type {import("bun:test").Mock<(arg: CustomEvent<{ id: string }>) => void>} */
        const listener = mock(() => {});
        const el = createItem({ id: "conv-to-archive" });
        el.addEventListener("archive-conversation", listener);
        container.appendChild(el);
        await el.updateComplete;

        const archiveItem = el.shadowRoot.querySelector("sl-menu-item");
        expect(archiveItem).toBeTruthy();
        archiveItem?.click();

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0].detail.id).toBe("conv-to-archive");
    });

    test("does not show kebab button on active conversation", async () => {
        const el = createItem({ id: "active-conv" });
        el._convState = {
            conversations: [],
            activeConversationId: "active-conv",
            loading: false,
        };
        container.appendChild(el);
        await el.updateComplete;

        const item = el.shadowRoot.querySelector(".item");
        expect(item?.classList.contains("active")).toBe(true);

        // Kebab dropdown should not be rendered for active item
        const kebab = el.shadowRoot.querySelector(".kebab");
        expect(kebab).toBeNull();
    });

    test("shows kebab button on non-active conversation", async () => {
        const el = createItem({ id: "non-active-conv" });
        el._convState = {
            conversations: [],
            activeConversationId: "some-other-conv",
            loading: false,
        };
        container.appendChild(el);
        await el.updateComplete;

        const kebab = el.shadowRoot.querySelector(".kebab");
        expect(kebab).toBeTruthy();
    });
});
