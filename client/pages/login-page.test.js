import { describe, test, expect, beforeEach, afterEach } from "bun:test";

import "./login-page.js";

describe("login-page", () => {
    /** @type {HTMLDivElement} */
    let container;

    /** @type {typeof globalThis.fetch} */
    let origFetch;

    function createLoginPage() {
        /** @type {any} */
        const el = document.createElement("login-page");
        return el;
    }

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);

        // Mock fetch to return a valid test-users response matching the
        // Hono RPC contract. Prevents uncontrolled requests in happy-dom/Bun
        // that can return non-array data and crash on this.testUsers.length.
        origFetch = globalThis.fetch;
        // @ts-expect-error - mock fetch for test environment
        globalThis.fetch = (url) => {
            if (typeof url === "string" && url.includes("test-users")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ result: "success", data: [] }),
                });
            }
            return origFetch ? origFetch(url) : Promise.reject(new Error("not mocked"));
        };
    });

    afterEach(() => {
        globalThis.fetch = origFetch;
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
        el.addEventListener("login-success", (/** @type {CustomEvent<{ user: any }>} */ e) => {
            dispatchedEvent = e.detail;
        });
        container.appendChild(el);
        await el.updateComplete;

        // Set test users AFTER firstUpdated completes (so it doesn't get
        // overwritten by the mocked fetch response from beforeEach).
        el.testUsers = [{ id: "test-id", name: "Test User", initials: "TU", mode: "gm" }];
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

        // Wait for async handler to complete
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
        await el.updateComplete;

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
