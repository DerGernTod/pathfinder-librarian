import "./chat-sidebar.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent } from "@testing-library/dom";

describe("chat-sidebar", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /** @param {Array<{ id: string, title: string }>} conversations */
    function createSidebar(conversations = [], activeId = "") {
        /** @type {any} */
        const el = document.createElement("chat-sidebar");
        el._convState = { conversations, activeConversationId: activeId, loading: false };
        el._modeState = { mode: "gm" };
        el._uiState = { sidebarExpanded: true, settingsOpen: false };
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
    });

    it("renders sidebar-profile component", async () => {
        const el = createSidebar();
        el.user = {
            id: "test-id",
            name: "Game Master 01",
            initials: "GM",
            subtitle: "PF2e Remaster Rules",
            mode: "gm",
            email: null,
            isTestUser: false,
            webauthnUserId: null,
        };
        await el.updateComplete;
        const profile = el.shadowRoot.querySelector("sidebar-profile");
        expect(profile).toBeTruthy();
        expect(profile.name).toBe("Game Master 01");
        expect(profile.subtitle).toBe("PF2e Remaster Rules");
        expect(profile.initials).toBe("GM");
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

    // Toggle tests
    it("renders in expanded state by default", async () => {
        const el = createSidebar();
        await el.updateComplete;
        expect(el._uiState.sidebarExpanded).toBe(true);
        const sidebar = el.shadowRoot.querySelector(".sidebar");
        expect(sidebar.classList.contains("collapsed")).toBe(false);
    });

    it("renders in collapsed state when expanded=false", async () => {
        const el = createSidebar();
        el._uiState = { sidebarExpanded: false, settingsOpen: false };
        await el.updateComplete;
        const sidebar = el.shadowRoot.querySelector(".sidebar");
        expect(sidebar.classList.contains("collapsed")).toBe(true);
    });

    it("shows full content when expanded", async () => {
        const el = createSidebar([{ id: "1", title: "Test" }]);
        await el.updateComplete;
        const content = el.shadowRoot.querySelector(".content");
        const menuWrapper = el.shadowRoot.querySelector(".conversation-menu-wrapper");
        expect(el.shadowRoot.querySelector("session-list")).toBeTruthy();
        expect(el.shadowRoot.querySelector("sidebar-profile")).toBeTruthy();
        expect(el.shadowRoot.querySelector("conversation-menu")).toBeTruthy();
        expect(content.classList.contains("collapsed")).toBe(false);
        expect(menuWrapper.classList.contains("visible")).toBe(false);
    });

    it("hides content when collapsed", async () => {
        const el = createSidebar([{ id: "1", title: "Test" }]);
        el._uiState = { sidebarExpanded: false, settingsOpen: false };
        await el.updateComplete;
        const content = el.shadowRoot.querySelector(".content");
        const menuWrapper = el.shadowRoot.querySelector(".conversation-menu-wrapper");
        expect(el.shadowRoot.querySelector("session-list")).toBeTruthy();
        expect(el.shadowRoot.querySelector("sidebar-profile")).toBeTruthy();
        expect(el.shadowRoot.querySelector("conversation-menu")).toBeTruthy();
        expect(content.classList.contains("collapsed")).toBe(true);
        expect(menuWrapper.classList.contains("visible")).toBe(true);
    });

    it("emits toggle-sidebar event on toggle click", async () => {
        const el = createSidebar();
        await el.updateComplete;

        let dispatched = false;
        el.addEventListener("toggle-sidebar", () => {
            dispatched = true;
        });

        const toggle = el.shadowRoot.querySelector("sidebar-toggle");
        fireEvent.click(toggle.shadowRoot.querySelector("button"));
        expect(dispatched).toBe(true);
    });

    it("passes collapsed prop to new-chat-button when collapsed", async () => {
        const el = createSidebar();
        el._uiState = { sidebarExpanded: false, settingsOpen: false };
        await el.updateComplete;
        const ncb = el.shadowRoot.querySelector("new-chat-button");
        expect(ncb.collapsed).toBe(true);
    });

    it("passes collapsed=false to new-chat-button when expanded", async () => {
        const el = createSidebar();
        el._uiState = { sidebarExpanded: true, settingsOpen: false };
        await el.updateComplete;
        const ncb = el.shadowRoot.querySelector("new-chat-button");
        expect(ncb.collapsed).toBe(false);
    });

    it("renders only one new-chat-button element always", async () => {
        const el = createSidebar();
        await el.updateComplete;
        const buttons = el.shadowRoot.querySelectorAll("new-chat-button");
        expect(buttons).toHaveLength(1);
    });

    it("keeps same new-chat-button element when toggling", async () => {
        const el = createSidebar();
        await el.updateComplete;
        const initialButton = el.shadowRoot.querySelector("new-chat-button");
        expect(initialButton).toBeTruthy();

        // Toggle to collapsed
        el._uiState = { sidebarExpanded: false, settingsOpen: false };
        await el.updateComplete;
        const collapsedButton = el.shadowRoot.querySelector("new-chat-button");

        // Should be the same DOM element
        expect(collapsedButton === initialButton).toBeTrue();

        // Toggle back to expanded
        el._uiState = { sidebarExpanded: true, settingsOpen: false };
        await el.updateComplete;
        const expandedButton = el.shadowRoot.querySelector("new-chat-button");

        // Should still be the same DOM element
        expect(expandedButton === initialButton).toBeTrue();
    });

    it("renders conversation-menu when collapsed", async () => {
        const el = createSidebar([{ id: "1", title: "Test" }]);
        el._uiState = { sidebarExpanded: false, settingsOpen: false };
        await el.updateComplete;
        const menu = el.shadowRoot.querySelector("conversation-menu");
        const menuWrapper = el.shadowRoot.querySelector(".conversation-menu-wrapper");
        expect(menu).toBeTruthy();
        expect(menuWrapper.classList.contains("visible")).toBe(true);
    });

    it("renders conversation-menu when expanded (hidden via CSS)", async () => {
        const el = createSidebar([{ id: "1", title: "Test" }]);
        el._uiState = { sidebarExpanded: true, settingsOpen: false };
        await el.updateComplete;
        const menu = el.shadowRoot.querySelector("conversation-menu");
        const menuWrapper = el.shadowRoot.querySelector(".conversation-menu-wrapper");
        expect(menu).toBeTruthy();
        expect(menuWrapper.classList.contains("visible")).toBe(false);
    });

    it("passes collapsed prop to sidebar-profile when collapsed", async () => {
        const el = createSidebar();
        el._uiState = { sidebarExpanded: false, settingsOpen: false };
        await el.updateComplete;
        const profile = el.shadowRoot.querySelector("sidebar-profile");
        expect(profile.collapsed).toBe(true);
    });

    it("passes collapsed=false to sidebar-profile when expanded", async () => {
        const el = createSidebar();
        el._uiState = { sidebarExpanded: true, settingsOpen: false };
        await el.updateComplete;
        const profile = el.shadowRoot.querySelector("sidebar-profile");
        expect(profile.collapsed).toBe(false);
    });

    it("both elements always present regardless of expanded state", async () => {
        const el = createSidebar([{ id: "1", title: "Test" }]);
        await el.updateComplete;

        // Test expanded state
        expect(el.shadowRoot.querySelector(".content")).toBeTruthy();
        expect(el.shadowRoot.querySelector(".conversation-menu-wrapper")).toBeTruthy();
        expect(el.shadowRoot.querySelector("session-list")).toBeTruthy();
        expect(el.shadowRoot.querySelector("conversation-menu")).toBeTruthy();

        // Test collapsed state
        el._uiState = { sidebarExpanded: false, settingsOpen: false };
        await el.updateComplete;
        expect(el.shadowRoot.querySelector(".content")).toBeTruthy();
        expect(el.shadowRoot.querySelector(".conversation-menu-wrapper")).toBeTruthy();
        expect(el.shadowRoot.querySelector("session-list")).toBeTruthy();
        expect(el.shadowRoot.querySelector("conversation-menu")).toBeTruthy();
    });

    it("content has correct CSS classes for expanded state", async () => {
        const el = createSidebar([{ id: "1", title: "Test" }]);
        await el.updateComplete;
        const content = el.shadowRoot.querySelector(".content");
        expect(content.classList.contains("collapsed")).toBe(false);
    });

    it("content has correct CSS classes for collapsed state", async () => {
        const el = createSidebar([{ id: "1", title: "Test" }]);
        el._uiState = { sidebarExpanded: false, settingsOpen: false };
        await el.updateComplete;
        const content = el.shadowRoot.querySelector(".content");
        expect(content.classList.contains("collapsed")).toBe(true);
    });

    it("conversation-menu-wrapper has correct CSS classes for expanded state", async () => {
        const el = createSidebar([{ id: "1", title: "Test" }]);
        await el.updateComplete;
        const menuWrapper = el.shadowRoot.querySelector(".conversation-menu-wrapper");
        expect(menuWrapper.classList.contains("visible")).toBe(false);
    });

    it("conversation-menu-wrapper has correct CSS classes for collapsed state", async () => {
        const el = createSidebar([{ id: "1", title: "Test" }]);
        el._uiState = { sidebarExpanded: false, settingsOpen: false };
        await el.updateComplete;
        const menuWrapper = el.shadowRoot.querySelector(".conversation-menu-wrapper");
        expect(menuWrapper.classList.contains("visible")).toBe(true);
    });
});
