import "./chat-sidebar.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent, getByText } from "@testing-library/dom";

describe("chat-sidebar", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /** @param {Array<{ id: string, title: string }>} conversations */
    function createSidebar(conversations = [], activeId = "") {
        /** @type {any} */
        const el = document.createElement("chat-sidebar");
        el.conversations = conversations;
        el.activeId = activeId;
        document.body.appendChild(el);
        return el;
    }

    it("renders new-chat-button component", async () => {
        const el = createSidebar();
        await el.updateComplete;
        const btn = el.shadowRoot.querySelector("new-chat-button");
        expect(btn).toBeTruthy();
    });

    it("renders session-list component", async () => {
        const el = createSidebar([{ id: "1", title: "Test Chat" }]);
        await el.updateComplete;
        const list = el.shadowRoot.querySelector("session-list");
        expect(list).toBeTruthy();
        expect(list.conversations).toHaveLength(1);
    });

    it("renders sidebar-profile component", async () => {
        const el = createSidebar();
        await el.updateComplete;
        const profile = el.shadowRoot.querySelector("sidebar-profile");
        expect(profile).toBeTruthy();
        expect(profile.name).toBe("Game Master 01");
        expect(profile.subtitle).toBe("PF2e Remaster Rules");
        expect(profile.initials).toBe("GM");
    });

    it("passes conversations and activeId to session-list", async () => {
        const el = createSidebar([{ id: "1", title: "Active Chat" }], "1");
        await el.updateComplete;
        const list = el.shadowRoot.querySelector("session-list");
        expect(list).toBeTruthy();
        expect(list.conversations).toHaveLength(1);
        expect(list.activeId).toBe("1");
    });

    it("dispatches new-chat on button click", async () => {
        const el = createSidebar();
        await el.updateComplete;

        let dispatched = false;
        el.addEventListener("new-chat", () => {
            dispatched = true;
        });

        const ncb = el.shadowRoot.querySelector("new-chat-button");
        await ncb.updateComplete;
        fireEvent.click(ncb.shadowRoot.querySelector("button"));
        expect(dispatched).toBe(true);
    });

    it("relays select-conversation from session-list", async () => {
        const el = createSidebar([{ id: "42", title: "Pick me" }]);
        await el.updateComplete;

        /** @type {any} */
        let detail = null;
        el.addEventListener(
            "select-conversation",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        const list = el.shadowRoot.querySelector("session-list");
        list.dispatchEvent(
            new CustomEvent("select-conversation", {
                detail: { id: "42" },
                bubbles: true,
                composed: true,
            }),
        );
        expect(detail).toBeTruthy();
        if (detail) {
            expect(detail.id).toBe("42");
        }
    });

    it("updates activeId when session-list selects a conversation", async () => {
        const el = createSidebar(
            [
                { id: "1", title: "First" },
                { id: "2", title: "Second" },
            ],
            "1",
        );
        await el.updateComplete;

        const list = el.shadowRoot.querySelector("session-list");
        list.dispatchEvent(
            new CustomEvent("select-conversation", {
                detail: { id: "2" },
                bubbles: true,
                composed: true,
            }),
        );
        await el.updateComplete;

        expect(el.activeId).toBe("2");
    });
});
