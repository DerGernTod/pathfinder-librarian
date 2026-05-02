import { describe, test, expect, beforeEach } from "bun:test";

import "./login-page.js";

describe("login-page", () => {
    /** @type {HTMLDivElement} */
    let container;

    function createLoginPage() {
        /** @type {any} */
        const el = document.createElement("login-page");
        return el;
    }

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    test("renders name input and buttons", async () => {
        const el = createLoginPage();
        container.appendChild(el);
        await el.updateComplete;

        const nameInput = el.shadowRoot.querySelector("sl-input");
        expect(nameInput).toBeTruthy();

        // Check buttons exist by finding sl-button elements
        const buttons = el.shadowRoot.querySelectorAll("sl-button");
        expect(buttons.length).toBeGreaterThanOrEqual(2); // At least Sign In and Create Account
    });

    test("shows error message when set", async () => {
        const el = createLoginPage();
        el.error = "Test error message";
        container.appendChild(el);
        await el.updateComplete;

        const errorDiv = el.shadowRoot.querySelector(".error");
        expect(errorDiv).toBeTruthy();
        expect(errorDiv.textContent).toContain("Test error message");
    });

    test("dispatches login-success on successful quick login", async () => {
        /** @type {any} */
        let dispatchedEvent = null;
        const el = createLoginPage();
        el.testUsers = [{ id: "test-id", name: "Test User", initials: "TU", mode: "gm" }];
        el.addEventListener("login-success", (/** @type {CustomEvent<{ user: any }>} */ e) => {
            dispatchedEvent = e.detail;
        });
        container.appendChild(el);
        await el.updateComplete;

        // Try to find quick login button
        const quickLoginButton = Array.from(el.shadowRoot.querySelectorAll("sl-button")).find(
            (btn) => btn.textContent.includes("Quick Login"),
        );

        // Mock quickLogin to return a user
        const mockUser = { id: "test-id", name: "Test User", initials: "TU", mode: "gm" };

        globalThis.fetch = /** @type {any} */ (
            () =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: { user: mockUser } }),
                })
        );

        quickLoginButton.click();

        // Wait for event to be dispatched
        await new Promise((r) => setTimeout(r, 0));

        expect(dispatchedEvent).toBeTruthy();
        expect(dispatchedEvent?.user).toEqual(mockUser);
    });

    test("hides test users section when no test users available", async () => {
        const el = createLoginPage();
        container.appendChild(el);
        await el.updateComplete;
        await el.updateComplete;

        const testUsersSection = el.shadowRoot.querySelector(".test-users");
        expect(testUsersSection).toBeNull();
    });
});
