import { describe, test, expect, beforeEach } from "bun:test";

import { getByText } from "@testing-library/dom";

import "./profile-menu.js";

describe("profile-menu", () => {
    /** @type {HTMLDivElement} */
    let container;

    function createMenu() {
        /** @type {any} */
        const el = document.createElement("profile-menu");
        el.mode = "gm";
        return el;
    }

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    test("renders avatar initials", async () => {
        const el = createMenu();
        container.appendChild(el);
        await el.updateComplete;

        const dropdown = el.shadowRoot.querySelector("sl-dropdown");
        expect(dropdown).toBeTruthy();
    });

    test("has dropdown trigger", async () => {
        const el = createMenu();
        container.appendChild(el);
        await el.updateComplete;

        const avatarButton = el.shadowRoot.querySelector(".avatar");
        expect(avatarButton).toBeTruthy();
    });

    test("dispatches logout on logout click", async () => {
        let dispatchedEvent = false;
        const el = createMenu();
        el.addEventListener("logout", () => {
            dispatchedEvent = true;
        });
        container.appendChild(el);
        await el.updateComplete;

        const logoutButton = getByText(el.shadowRoot, /logout/i);
        logoutButton.click();

        expect(dispatchedEvent).toBe(true);
    });

    test("dispatches open-settings on settings click", async () => {
        let dispatchedEvent = false;
        const el = createMenu();
        el.addEventListener("open-settings", () => {
            dispatchedEvent = true;
        });
        container.appendChild(el);
        await el.updateComplete;

        const settingsButton = getByText(el.shadowRoot, /settings/i);
        settingsButton.click();

        expect(dispatchedEvent).toBe(true);
    });
});
