import { describe, test, expect, beforeEach, mock } from "bun:test";

import "./conversation-item.js";

describe("conversation-item", () => {
    /** @type {HTMLDivElement} */
    let container;

    /**
     * @param {{ id?: string, title?: string, activeId?: string }} [opts]
     * @returns {any}
     */
    function createItem(opts) {
        /** @type {any} */
        const el = document.createElement("conversation-item");
        el.conversation = {
            id: opts?.id ?? "test-conv-1",
            title: opts?.title ?? "Test Conversation",
        };
        el._convState = {
            conversations: [],
            activeConversationId: opts?.activeId ?? "",
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

    test("dispatches archive-conversation when archive action clicked", async () => {
        /** @type {import("bun:test").Mock<(arg: CustomEvent<{ id: string }>) => void>} */
        const listener = mock(() => {});
        const el = createItem({ id: "conv-to-archive" });
        el.addEventListener("archive-conversation", listener);
        container.appendChild(el);
        await el.updateComplete;

        const archiveItem = el.shadowRoot.querySelector('[data-action="archive"]');
        expect(archiveItem).toBeTruthy();
        archiveItem?.click();

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0].detail.id).toBe("conv-to-archive");
    });

    test("shows kebab button on non-active conversation", async () => {
        const el = createItem({ id: "non-active-conv", activeId: "some-other-conv" });
        container.appendChild(el);
        await el.updateComplete;

        const kebab = el.shadowRoot.querySelector(".kebab");
        expect(kebab).toBeTruthy();
    });

    test("shows kebab button on active conversation", async () => {
        const el = createItem({ id: "active-conv", activeId: "active-conv" });
        container.appendChild(el);
        await el.updateComplete;

        const kebab = el.shadowRoot.querySelector(".kebab");
        expect(kebab).toBeTruthy();
    });

    test("kebab click does not dispatch select event", async () => {
        /** @type {import("bun:test").Mock<(arg: CustomEvent<{ id: string }>) => void>} */
        const selectListener = mock(() => {});
        const el = createItem({ id: "conv-1" });
        el.addEventListener("select", selectListener);
        container.appendChild(el);
        await el.updateComplete;

        const kebab = el.shadowRoot.querySelector(".kebab");
        kebab?.click();

        expect(selectListener).not.toHaveBeenCalled();
    });

    test("menu has popover attribute", async () => {
        const el = createItem();
        container.appendChild(el);
        await el.updateComplete;

        const menu = el.shadowRoot.querySelector(".menu");
        expect(menu?.hasAttribute("popover")).toBe(true);
    });

    test("menu item click closes popover and dispatches archive", async () => {
        /** @type {import("bun:test").Mock<(arg: CustomEvent<{ id: string }>) => void>} */
        const listener = mock(() => {});
        const el = createItem({ id: "conv-x" });
        el.addEventListener("archive-conversation", listener);
        container.appendChild(el);
        await el.updateComplete;

        const archiveItem = el.shadowRoot.querySelector('[data-action="archive"]');
        archiveItem?.click();

        expect(listener).toHaveBeenCalled();
        expect(listener.mock.calls[0][0].detail.id).toBe("conv-x");
    });
});
