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
        expect(getByText(el, "Recent")).toBeTruthy();
    });

    it("renders search input with placeholder", async () => {
        const el = createList();
        await el.updateComplete;
        const input = el.querySelector("input[type='text']");
        expect(input).toBeTruthy();
        expect(input.placeholder).toBe("Search conversations...");
    });

    it("renders all conversation titles", async () => {
        const el = createList([
            { id: "1", title: "Chat One" },
            { id: "2", title: "Chat Two" },
        ]);
        await el.updateComplete;
        expect(getByText(el, "Chat One")).toBeTruthy();
        expect(getByText(el, "Chat Two")).toBeTruthy();
    });

    it("highlights active conversation", async () => {
        const el = createList([{ id: "1", title: "Active Chat" }], "1");
        await el.updateComplete;
        const activeEl = getByText(el, "Active Chat");
        expect(activeEl.classList.contains("bg-accent")).toBe(true);
    });

    it("non-active conversation has muted style", async () => {
        const el = createList(
            [
                { id: "1", title: "Active" },
                { id: "2", title: "Inactive" },
            ],
            "1",
        );
        await el.updateComplete;
        const inactiveEl = getByText(el, "Inactive");
        expect(inactiveEl.classList.contains("text-muted-foreground")).toBe(true);
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

        fireEvent.click(getByText(el, "Pick me"));
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

        expect(getByText(el, "Mitflit King")).toBeTruthy();
        expect(el.textContent).not.toContain("Chandelier Plot");
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

        expect(el.textContent).not.toContain("Mitflit King");

        el.query = "";
        el.requestUpdate();
        await el.updateComplete;

        expect(getByText(el, "Mitflit King")).toBeTruthy();
        expect(getByText(el, "Chandelier Plot")).toBeTruthy();
    });
});
