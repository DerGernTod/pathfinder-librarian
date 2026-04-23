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
        el.conversations = conversations;
        el.activeId = activeId;
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
        expect(getByText(el.shadowRoot, "Chat One")).toBeTruthy();
        expect(getByText(el.shadowRoot, "Chat Two")).toBeTruthy();
    });

    it("highlights active conversation", async () => {
        const el = createList([{ id: "1", title: "Active Chat" }], "1");
        await el.updateComplete;
        const activeEl = getByText(el.shadowRoot, "Active Chat");
        expect(activeEl.classList.contains("active")).toBe(true);
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
        const inactiveEl = getByText(el.shadowRoot, "Inactive");
        expect(inactiveEl.classList.contains("active")).toBe(false);
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

        fireEvent.click(getByText(el.shadowRoot, "Pick me"));
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

        expect(getByText(el.shadowRoot, "Mitflit King")).toBeTruthy();
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

        expect(el.shadowRoot.textContent).not.toContain("Mitflit King");

        el.query = "";
        el.requestUpdate();
        await el.updateComplete;

        expect(getByText(el.shadowRoot, "Mitflit King")).toBeTruthy();
        expect(getByText(el.shadowRoot, "Chandelier Plot")).toBeTruthy();
    });
});
