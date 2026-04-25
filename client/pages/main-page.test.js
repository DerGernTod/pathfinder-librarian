import { beforeEach, describe, expect, it } from "bun:test";

import "./main-page.js";

describe("main-page sidebar", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    function createPage() {
        /** @type {any} */
        const el = document.createElement("main-page");
        document.body.appendChild(el);
        return el;
    }

    it("passes sidebarExpanded to chat-sidebar", async () => {
        const el = createPage();
        el.sidebarExpanded = false;
        await el.updateComplete;
        const sidebar = el.shadowRoot.querySelector("chat-sidebar");
        expect(sidebar.expanded).toBe(false);
    });

    it("handles toggle-sidebar event from chat-sidebar", async () => {
        const el = createPage();
        await el.updateComplete;

        const sidebar = el.shadowRoot.querySelector("chat-sidebar");
        sidebar.dispatchEvent(
            new CustomEvent("toggle-sidebar", {
                detail: { expanded: false },
                bubbles: true,
                composed: true,
            }),
        );

        await el.updateComplete;
        expect(el.sidebarExpanded).toBe(false);
    });

    it("updates sidebarExpanded state on toggle", async () => {
        const el = createPage();
        await el.updateComplete;

        const sidebar = el.shadowRoot.querySelector("chat-sidebar");
        sidebar.dispatchEvent(
            new CustomEvent("toggle-sidebar", {
                detail: { expanded: false },
                bubbles: true,
                composed: true,
            }),
        );

        await el.updateComplete;
        expect(el.sidebarExpanded).toBe(false);
    });

    it("passes messages and loading to message-list", async () => {
        const el = createPage();
        el.loading = true;
        await el.updateComplete;
        const messageList = el.shadowRoot.querySelector("message-list");
        expect(messageList).toBeTruthy();
        expect(messageList.loading).toBe(true);
        expect(messageList.messages.length).toBeGreaterThan(0);
    });
});
