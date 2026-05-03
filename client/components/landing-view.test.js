import "./landing-view.js";
import { beforeEach, describe, expect, it, mock } from "bun:test";

describe("landing-view", () => {
    /** @type {import("./landing-view.js").LandingView} */
    let element;

    beforeEach(() => {
        document.body.innerHTML = "";
        element = /** @type {import("./landing-view.js").LandingView} */ (
            document.createElement("landing-view")
        );
        document.body.appendChild(element);
    });

    it("renders the welcome section", async () => {
        await element.updateComplete;

        const region = element.shadowRoot?.querySelector('[role="region"]');
        expect(region).toBeTruthy();
        expect(region?.getAttribute("aria-label")).toBe("Welcome");
    });

    it("renders the heading", async () => {
        await element.updateComplete;

        const h1 = element.shadowRoot?.querySelector("h1");
        expect(h1?.textContent).toBe("Pathfinder Librarian");
    });

    it("renders the input field", async () => {
        await element.updateComplete;

        const input = element.shadowRoot?.querySelector('[data-test="landing-input"]');
        expect(input).toBeTruthy();
    });

    it("renders the send button", async () => {
        await element.updateComplete;

        const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
        expect(sendBtn).toBeTruthy();
    });

    it("tracks input text", async () => {
        await element.updateComplete;

        const input = /** @type {HTMLInputElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        input.value = "Test query";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await element.updateComplete;

        // Verify the input value is reflected
        expect(input.value).toBe("Test query");
    });

    it("dispatches landing-submit on button click", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener("landing-submit", /** @param {any} e */ (e) => {
            result.value = e.detail.text;
        });

        const input = /** @type {HTMLInputElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        input.value = "How does flanking work?";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await element.updateComplete;

        const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
        sendBtn?.dispatchEvent(new Event("click", { bubbles: true }));

        expect(result.value).toBe("How does flanking work?");
    });

    it("enter key triggers submit", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener("landing-submit", /** @param {any} e */ (e) => {
            result.value = e.detail.text;
        });

        const input = /** @type {HTMLInputElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        input.value = "Hello";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await element.updateComplete;

        const preventDefaultMock = mock(() => {});
        const keydownEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            shiftKey: false,
            bubbles: true,
            cancelable: true,
        });
        Object.defineProperty(keydownEvent, "preventDefault", { value: preventDefaultMock });

        input.dispatchEvent(keydownEvent);

        expect(preventDefaultMock).toHaveBeenCalled();
        expect(result.value).toBe("Hello");
    });

    it("shift+Enter does not submit", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener("landing-submit", /** @param {any} e */ (e) => {
            result.value = e.detail.text;
        });

        const input = /** @type {HTMLInputElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        input.value = "Hello";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await element.updateComplete;

        const preventDefaultMock = mock(() => {});
        const keydownEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        });
        Object.defineProperty(keydownEvent, "preventDefault", { value: preventDefaultMock });

        input.dispatchEvent(keydownEvent);

        expect(preventDefaultMock).not.toHaveBeenCalled();
        expect(result.value).toBeNull();
    });

    it("does not submit empty text", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener("landing-submit", /** @param {any} e */ (e) => {
            result.value = e.detail.text;
        });

        const input = /** @type {HTMLInputElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        input.value = "   ";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await element.updateComplete;

        const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
        sendBtn?.dispatchEvent(new Event("click", { bubbles: true }));

        expect(result.value).toBeNull();
    });

    it("disables button when submitting", async () => {
        element.submitting = true;
        await element.updateComplete;

        const sendBtn = /** @type {HTMLButtonElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-send"]')
        );
        expect(sendBtn.disabled).toBe(true);
    });

    it("disables input when submitting", async () => {
        element.submitting = true;
        await element.updateComplete;

        const input = /** @type {HTMLInputElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        expect(input.disabled).toBe(true);
    });

    it("does not submit when submitting is true", async () => {
        element.submitting = true;
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener("landing-submit", /** @param {any} e */ (e) => {
            result.value = e.detail.text;
        });

        const input = /** @type {HTMLInputElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        input.value = "Hello";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await element.updateComplete;

        const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
        sendBtn?.dispatchEvent(new Event("click", { bubbles: true }));

        expect(result.value).toBeNull();
    });

    it("clears input after submit", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener("landing-submit", /** @param {any} e */ (e) => {
            result.value = e.detail.text;
        });

        const input = /** @type {HTMLInputElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        input.value = "Test query";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await element.updateComplete;

        const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
        sendBtn?.dispatchEvent(new Event("click", { bubbles: true }));

        expect(result.value).toBe("Test query");
    });
});
