import "./session-list.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent, getByText } from "@testing-library/dom";

describe("session-list", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /** @param {Array<{ id: string, title: string }>} conversations */
    function createList(conversations = [], activeId = "") {
        /** @type {any} */
        const el = document.createElement("session-list");
        el._convState = { conversations, activeConversationId: activeId, loading: false };
        document.body.appendChild(el);
        return el;
    }

    it("renders Recent label", async () => {
        const el = createList();
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Recent")).toBeTruthy();
    });

    it("renders sl-input search with placeholder", async () => {
        const el = createList();
        await el.updateComplete;
        const input = el.shadowRoot.querySelector("sl-input");
        expect(input).toBeTruthy();
        expect(input.getAttribute("placeholder")).toBe("Search conversations...");
    });

    it("renders all conversation titles", async () => {
        const el = createList([
            { id: "1", title: "Chat One" },
            { id: "2", title: "Chat Two" },
        ]);
        await el.updateComplete;
        const items = el.shadowRoot.querySelectorAll("conversation-item");
        expect(items.length).toBe(2);
        expect(items[0].shadowRoot?.querySelector(".item")?.textContent).toContain("Chat One");
        expect(items[1].shadowRoot?.querySelector(".item")?.textContent).toContain("Chat Two");
    });

    it("highlights active conversation", async () => {
        const el = createList([{ id: "1", title: "Active Chat" }], "1");
        await el.updateComplete;
        const item = /** @type {any} */ (el.shadowRoot.querySelector("conversation-item"));
        // conversation-item consumes from context; set its internal state directly
        if (item) {
            item._convState = {
                conversations: [{ id: "1", title: "Active Chat" }],
                activeConversationId: "1",
                loading: false,
            };
            item.requestUpdate();
            await item.updateComplete;
        }
        const itemDiv = item?.shadowRoot?.querySelector(".item");
        expect(itemDiv?.classList.contains("active")).toBe(true);
    });

    it("non-active conversation does not have active class", async () => {
        const el = createList(
            [
                { id: "1", title: "Active" },
                { id: "2", title: "Inactive" },
            ],
            "1",
        );
        await el.updateComplete;
        const items = el.shadowRoot.querySelectorAll("conversation-item");
        // Set context state on each conversation-item child
        for (const item of items) {
            /** @type {any} */ (item)._convState = {
                conversations: [
                    { id: "1", title: "Active" },
                    { id: "2", title: "Inactive" },
                ],
                activeConversationId: "1",
                loading: false,
            };
            /** @type {any} */ (item).requestUpdate();
        }
        await Promise.all(Array.from(items).map((i) => /** @type {any} */ (i).updateComplete));
        const inactiveItem = Array.from(items).find((item) =>
            item.shadowRoot?.querySelector(".item")?.textContent?.includes("Inactive"),
        );
        const inactiveDiv = inactiveItem?.shadowRoot?.querySelector(".item");
        expect(inactiveDiv?.classList.contains("active")).toBe(false);
    });

    it("dispatches select-conversation with id on click", async () => {
        const el = createList([{ id: "42", title: "Pick me" }]);
        await el.updateComplete;

        /** @type {any} */
        let detail = null;
        el.addEventListener(
            "select-conversation",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        const item = el.shadowRoot.querySelector("conversation-item");
        const itemDiv = item?.shadowRoot?.querySelector(".item");
        if (itemDiv) {
            fireEvent.click(itemDiv);
        }
        expect(detail).toBeTruthy();
        if (detail) {
            expect(detail.id).toBe("42");
        }
    });

    it("filters conversations by search query", async () => {
        const el = createList([
            { id: "1", title: "Mitflit King" },
            { id: "2", title: "Chandelier Plot" },
        ]);
        await el.updateComplete;

        el.query = "mitflit";
        el.requestUpdate();
        await el.updateComplete;

        const items = el.shadowRoot.querySelectorAll("conversation-item");
        expect(items.length).toBe(1);
        expect(items[0].shadowRoot?.querySelector(".item")?.textContent).toContain("Mitflit King");
        expect(el.shadowRoot.textContent).not.toContain("Chandelier Plot");
    });

    it("shows all conversations when query is cleared", async () => {
        const el = createList([
            { id: "1", title: "Mitflit King" },
            { id: "2", title: "Chandelier Plot" },
        ]);
        await el.updateComplete;

        el.query = "xyz";
        el.requestUpdate();
        await el.updateComplete;

        expect(el.shadowRoot.querySelectorAll("conversation-item").length).toBe(0);

        el.query = "";
        el.requestUpdate();
        await el.updateComplete;

        const items = el.shadowRoot.querySelectorAll("conversation-item");
        expect(items.length).toBe(2);
        expect(items[0].shadowRoot?.querySelector(".item")?.textContent).toContain("Mitflit King");
        expect(items[1].shadowRoot?.querySelector(".item")?.textContent).toContain(
            "Chandelier Plot",
        );
    });

    it("shows all conversations when query is cleared (second test)", async () => {
        const el = createList([
            { id: "1", title: "Mitflit King" },
            { id: "2", title: "Chandelier Plot" },
        ]);
        await el.updateComplete;

        el.query = "xyz";
        el.requestUpdate();
        await el.updateComplete;

        expect(el.shadowRoot.textContent).not.toContain("Mitflit King");

        el.query = "";
        el.requestUpdate();
        await el.updateComplete;

        const items = el.shadowRoot.querySelectorAll("conversation-item");
        expect(items.length).toBe(2);
        expect(items[0].shadowRoot?.querySelector(".item")?.textContent).toContain("Mitflit King");
        expect(items[1].shadowRoot?.querySelector(".item")?.textContent).toContain(
            "Chandelier Plot",
        );
    });
});
