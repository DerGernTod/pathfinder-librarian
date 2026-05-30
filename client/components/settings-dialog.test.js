import { describe, test, expect, beforeEach, afterEach } from "bun:test";

import { getByText } from "@testing-library/dom";

import "./settings-dialog.js";

describe("settings-dialog", () => {
    /** @type {HTMLDivElement} */
    let container;

    /** @type {typeof globalThis.fetch} */
    let origFetch;

    /**
     * Create a settings-dialog element with settingsOpen=false initially.
     * Call openDialog(el) after first render to safely open it.
     */
    function createDialog() {
        /** @type {any} */
        const el = document.createElement("settings-dialog");
        el._uiState = {
            sidebarExpanded: true,
            settingsOpen: false,
            archiveOpen: false,
            breakpoint: "desktop",
        };
        return el;
    }

    /**
     * Stub sl-dialog's show/hide so Shoelace animation promises
     * don't hang in happy-dom, then flip settingsOpen to true.
     * @param {any} el
     */
    async function openDialog(el) {
        const dialog = el.shadowRoot?.querySelector("sl-dialog");
        if (dialog) {
            dialog.show = () => Promise.resolve();
            dialog.hide = () => Promise.resolve();
        }
        el._uiState = { ...el._uiState, settingsOpen: true };
        await el.updateComplete;
    }

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);

        // Mock fetch to prevent hanging requests from fetchDevices()
        origFetch = globalThis.fetch;
        globalThis.fetch = /** @type {any} */ (
            () =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                })
        );
    });

    afterEach(() => {
        document.body.innerHTML = "";
        globalThis.fetch = origFetch;
    });

    test("renders when settingsOpen is true", async () => {
        const mockUser = {
            id: "test-id",
            name: "Test User",
            initials: "TU",
            mode: "gm",
            email: "test@example.com",
            isTestUser: false,
            webauthnUserId: "webauthn-id",
        };

        const el = createDialog();
        el.user = mockUser;
        container.appendChild(el);
        await el.updateComplete;
        await openDialog(el);

        const dialog = el.shadowRoot.querySelector("sl-dialog");
        expect(dialog).toBeTruthy();
    });

    test("shows user name and mode", async () => {
        const mockUser = {
            id: "test-id",
            name: "Test User",
            initials: "TU",
            mode: "gm",
            email: "test@example.com",
            isTestUser: false,
            webauthnUserId: "webauthn-id",
        };

        const el = createDialog();
        container.appendChild(el);
        await el.updateComplete;
        await openDialog(el);
        el.user = mockUser;
        await el.updateComplete;

        const nameInput = el.shadowRoot.querySelector("sl-input");
        expect(nameInput).toBeTruthy();
        expect(el.nameInput).toBe("Test User");
        expect(el.modeInput).toBe("gm");
    });

    test("dispatches settings-closed when dialog closes", async () => {
        let dispatchedEvent = false;
        const mockUser = {
            id: "test-id",
            name: "Test User",
            initials: "TU",
            mode: "gm",
            email: "test@example.com",
            isTestUser: false,
            webauthnUserId: "webauthn-id",
        };

        const el = createDialog();
        el.user = mockUser;
        el.addEventListener("settings-closed", () => {
            dispatchedEvent = true;
        });
        container.appendChild(el);
        await el.updateComplete;
        await openDialog(el);

        const dialog = el.shadowRoot.querySelector("sl-dialog");
        dialog.dispatchEvent(new CustomEvent("sl-after-hide"));

        expect(dispatchedEvent).toBe(true);
    });

    test("shows devices list", async () => {
        const mockUser = {
            id: "test-id",
            name: "Test User",
            initials: "TU",
            mode: "gm",
            email: "test@example.com",
            isTestUser: false,
            webauthnUserId: "webauthn-id",
        };

        const el = createDialog();
        el.user = mockUser;
        el.devices = [
            { id: "device-1", deviceType: "singleDevice", createdAt: "2025-01-01T00:00:00Z" },
        ];
        container.appendChild(el);
        await el.updateComplete;
        await openDialog(el);

        const passkeysSection = getByText(el.shadowRoot, /passkeys/i);
        expect(passkeysSection).toBeTruthy();
    });

    test("shows delete account button", async () => {
        const mockUser = {
            id: "test-id",
            name: "Test User",
            initials: "TU",
            mode: "gm",
            email: "test@example.com",
            isTestUser: false,
            webauthnUserId: "webauthn-id",
        };

        const el = createDialog();
        el.user = mockUser;
        container.appendChild(el);
        await el.updateComplete;
        await openDialog(el);

        const deleteButton = getByText(el.shadowRoot, /delete account/i);
        expect(deleteButton).toBeTruthy();
    });
});
