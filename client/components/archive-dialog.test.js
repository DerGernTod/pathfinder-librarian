import { describe, test, expect, beforeEach, mock } from "bun:test";

import "./archive-dialog.js";

describe("archive-dialog", () => {
    /** @type {HTMLDivElement} */
    let container;

    /**
     * @returns {any}
     */
    function createDialog() {
        /** @type {any} */
        const el = document.createElement("archive-dialog");
        el._uiState = {
            sidebarExpanded: true,
            settingsOpen: false,
            archiveOpen: false,
            breakpoint: "desktop",
        };
        return el;
    }

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    test("renders empty state when no archived conversations", async () => {
        const el = createDialog();
        container.appendChild(el);
        await el.updateComplete;

        const emptyState = el.shadowRoot.querySelector(".empty-state");
        expect(emptyState).toBeTruthy();
        expect(emptyState?.textContent?.trim()).toBe("No archived conversations");
    });

    test("renders archived conversations with restore and delete buttons", async () => {
        const el = createDialog();
        el._archivedConversations = [
            {
                id: "archived-1",
                title: "Archived Chat",
                archivedAt: new Date().toISOString(),
            },
        ];
        container.appendChild(el);
        await el.updateComplete;

        const title = el.shadowRoot.querySelector(".archived-title");
        expect(title?.textContent?.trim()).toBe("Archived Chat");

        const restoreBtn = el.shadowRoot.querySelector('sl-button[variant="default"]');
        expect(restoreBtn).toBeTruthy();

        const deleteBtn = el.shadowRoot.querySelector('sl-button[variant="danger"]');
        expect(deleteBtn).toBeTruthy();
    });

    test("dispatches archive-closed when dialog hides", async () => {
        /** @type {import("bun:test").Mock<() => void>} */
        const listener = mock(() => {});
        const el = createDialog();
        el.addEventListener("archive-closed", listener);
        container.appendChild(el);
        await el.updateComplete;

        const dialog = el.shadowRoot.querySelector("sl-dialog");
        expect(dialog).toBeTruthy();
        dialog?.dispatchEvent(new CustomEvent("sl-after-hide"));

        expect(listener).toHaveBeenCalled();
    });

    test("calls restore and dispatches conversation-restored", async () => {
        /** @type {import("bun:test").Mock<() => void>} */
        const restoredListener = mock(() => {});
        const el = createDialog();
        el.addEventListener("conversation-restored", restoredListener);
        el._archivedConversations = [
            {
                id: "archived-1",
                title: "Archived Chat",
                archivedAt: new Date().toISOString(),
            },
        ];
        container.appendChild(el);
        await el.updateComplete;

        // Mock the store method
        el._convStore = {
            ...el._convStore,
            restoreConversation: mock(() => Promise.resolve({ id: "archived-1" })),
        };

        const restoreBtn = el.shadowRoot.querySelector('sl-button[variant="default"]');
        restoreBtn?.click();
        await el.updateComplete;

        expect(restoredListener).toHaveBeenCalled();
        expect(el._archivedConversations).toHaveLength(0);
    });

    test("calls delete after confirmation and refreshes list", async () => {
        const el = createDialog();
        el._archivedConversations = [
            {
                id: "archived-1",
                title: "Archived Chat",
                archivedAt: new Date().toISOString(),
            },
        ];
        container.appendChild(el);
        await el.updateComplete;

        // Mock confirm
        const origConfirm = globalThis.confirm;
        globalThis.confirm = mock(() => true);

        // Mock the store method
        const deleteMock = mock(() => Promise.resolve());
        el._convStore = {
            ...el._convStore,
            deleteConversation: deleteMock,
        };

        const deleteBtn = el.shadowRoot.querySelector('sl-button[variant="danger"]');
        deleteBtn?.click();
        await el.updateComplete;

        expect(deleteMock).toHaveBeenCalledWith("archived-1");
        expect(el._archivedConversations).toHaveLength(0);

        // Restore
        globalThis.confirm = origConfirm;
    });
});
