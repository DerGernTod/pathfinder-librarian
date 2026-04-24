import "./conversation-menu.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent } from "@testing-library/dom";

describe("conversation-menu", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    function createMenu(conversations = [], activeId = "") {
        /** @type {any} */
        const el = document.createElement("conversation-menu");
        el.conversations = conversations;
        el.activeId = activeId;
        document.body.appendChild(el);
        return el;
    }

    it("renders dropdown trigger button", async () => {
        const el = createMenu();
        await el.updateComplete;
        const trigger = el.shadowRoot.querySelector("sl-icon-button");
        expect(trigger).toBeTruthy();
        expect(trigger.getAttribute("name")).toBe("list");
        expect(trigger.getAttribute("label")).toBe("Recent conversations");
    });

    it("renders menu with conversations", async () => {
        const el = createMenu([
            { id: "1", title: "First Chat" },
            { id: "2", title: "Second Chat" },
        ]);
        await el.updateComplete;
        const menu = el.shadowRoot.querySelector("sl-menu");
        expect(menu).toBeTruthy();
        const items = menu.querySelectorAll("sl-menu-item");
        expect(items.length).toBe(2);
    });

    it("shows only first 5 conversations", async () => {
        const conversations = Array.from({ length: 10 }, (_, i) => ({
            id: String(i + 1),
            title: `Chat ${i + 1}`,
        }));
        const el = createMenu(conversations);
        await el.updateComplete;
        const items = el.shadowRoot.querySelectorAll("sl-menu-item");
        expect(items.length).toBe(5);
    });

    it("emits select-conversation on menu item click", async () => {
        const el = createMenu([{ id: "42", title: "Pick me" }]);
        await el.updateComplete;

        let dispatched = false;
        /** @type {any} */
        let detail = null;
        el.addEventListener("select-conversation", (e) => {
            dispatched = true;
            detail = e.detail;
        });

        const item = el.shadowRoot.querySelector('sl-menu-item[value="42"]');
        fireEvent.click(item);
        expect(dispatched).toBe(true);
        expect(detail?.id).toBe("42");
    });

    it("marks active conversation with correct value attribute", async () => {
        const el = createMenu(
            [
                { id: "1", title: "First" },
                { id: "2", title: "Second" },
            ],
            "2",
        );
        await el.updateComplete;
        const item = el.shadowRoot.querySelector('sl-menu-item[value="2"]');
        expect(item).toBeTruthy();
        expect(item.getAttribute("value")).toBe("2");
    });
});
