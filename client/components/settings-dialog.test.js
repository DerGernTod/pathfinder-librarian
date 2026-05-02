import { describe, test, expect, beforeEach } from "bun:test";

import { getByText } from "@testing-library/dom";

import "./settings-dialog.js";

describe("settings-dialog", () => {
    /** @type {HTMLDivElement} */
    let container;

    function createDialog() {
        /** @type {any} */
        const el = document.createElement("settings-dialog");
        el.open = true;
        return el;
    }

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    test("renders when open is true", async () => {
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

        const deleteButton = getByText(el.shadowRoot, /delete account/i);
        expect(deleteButton).toBeTruthy();
    });
});
