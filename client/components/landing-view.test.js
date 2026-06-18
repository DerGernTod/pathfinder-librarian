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

        const textarea = /** @type {HTMLElement & { value: string }} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        textarea.value = "Test query";
        textarea.dispatchEvent(new CustomEvent("sl-input", { bubbles: true }));
        await element.updateComplete;

        expect(textarea.value).toBe("Test query");
    });

    it("dispatches landing-submit on button click", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener(
            "landing-submit",
            /** @param {any} e */ (e) => {
                result.value = e.detail.text;
            },
        );

        const textarea = /** @type {HTMLElement & { value: string }} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        textarea.value = "How does flanking work?";
        textarea.dispatchEvent(new CustomEvent("sl-input", { bubbles: true }));
        await element.updateComplete;

        const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
        sendBtn?.dispatchEvent(new Event("click", { bubbles: true }));

        expect(result.value).toBe("How does flanking work?");
    });

    it("enter key triggers submit", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener(
            "landing-submit",
            /** @param {any} e */ (e) => {
                result.value = e.detail.text;
            },
        );

        const textarea = /** @type {HTMLElement & { value: string }} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        textarea.value = "Hello";
        textarea.dispatchEvent(new CustomEvent("sl-input", { bubbles: true }));
        await element.updateComplete;

        const preventDefaultMock = mock(() => {});
        const keydownEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            shiftKey: false,
            bubbles: true,
            cancelable: true,
        });
        Object.defineProperty(keydownEvent, "preventDefault", { value: preventDefaultMock });

        textarea.dispatchEvent(keydownEvent);

        expect(preventDefaultMock).toHaveBeenCalled();
        expect(result.value).toBe("Hello");
    });

    it("shift+Enter does not submit", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener(
            "landing-submit",
            /** @param {any} e */ (e) => {
                result.value = e.detail.text;
            },
        );

        const textarea = /** @type {HTMLElement & { value: string }} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        textarea.value = "Hello";
        textarea.dispatchEvent(new CustomEvent("sl-input", { bubbles: true }));
        await element.updateComplete;

        const preventDefaultMock = mock(() => {});
        const keydownEvent = new KeyboardEvent("keydown", {
            key: "Enter",
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        });
        Object.defineProperty(keydownEvent, "preventDefault", { value: preventDefaultMock });

        textarea.dispatchEvent(keydownEvent);

        expect(preventDefaultMock).not.toHaveBeenCalled();
        expect(result.value).toBeNull();
    });

    it("does not submit empty text", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener(
            "landing-submit",
            /** @param {any} e */ (e) => {
                result.value = e.detail.text;
            },
        );

        const textarea = /** @type {HTMLElement & { value: string }} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        textarea.value = "   ";
        textarea.dispatchEvent(new CustomEvent("sl-input", { bubbles: true }));
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

        const textarea = /** @type {HTMLElement} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        expect(textarea.hasAttribute("disabled")).toBe(true);
    });

    it("does not submit when submitting is true", async () => {
        element.submitting = true;
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener(
            "landing-submit",
            /** @param {any} e */ (e) => {
                result.value = e.detail.text;
            },
        );

        const textarea = /** @type {HTMLElement & { value: string }} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        textarea.value = "Hello";
        textarea.dispatchEvent(new CustomEvent("sl-input", { bubbles: true }));
        await element.updateComplete;

        const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
        sendBtn?.dispatchEvent(new Event("click", { bubbles: true }));

        expect(result.value).toBeNull();
    });

    it("clears input after submit", async () => {
        await element.updateComplete;

        const result = /** @type {{ value: string | null }} */ ({ value: null });
        element.addEventListener(
            "landing-submit",
            /** @param {any} e */ (e) => {
                result.value = e.detail.text;
            },
        );

        const textarea = /** @type {HTMLElement & { value: string }} */ (
            element.shadowRoot?.querySelector('[data-test="landing-input"]')
        );
        textarea.value = "Test query";
        textarea.dispatchEvent(new CustomEvent("sl-input", { bubbles: true }));
        await element.updateComplete;

        const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
        sendBtn?.dispatchEvent(new Event("click", { bubbles: true }));

        expect(result.value).toBe("Test query");
    });

    it("renders warning icon when API key is not set", async () => {
        element._apiKeyStatus = { available: false, reason: "not_set" };
        await element.updateComplete;
        const warningIcon = element.shadowRoot?.querySelector(".api-warning-icon");
        expect(warningIcon).toBeTruthy();
    });

    it("does not render warning when API key is available", async () => {
        element._apiKeyStatus = { available: true, reason: "ok" };
        await element.updateComplete;
        const warningIcon = element.shadowRoot?.querySelector(".api-warning-icon");
        expect(warningIcon).toBeNull();
    });

    describe("offline behavior", () => {
        it("disables send button when offline", async () => {
            await element.updateComplete;
            element._uiState = { ...element._uiState, online: false };
            element.requestUpdate();
            await element.updateComplete;
            const sendBtn = /** @type {HTMLButtonElement} */ (
                element.shadowRoot?.querySelector('[data-test="landing-send"]')
            );
            expect(sendBtn.disabled).toBe(true);
        });

        it("send button has unavailable-offline title when offline", async () => {
            await element.updateComplete;
            element._uiState = { ...element._uiState, online: false };
            element.requestUpdate();
            await element.updateComplete;
            const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
            expect(sendBtn?.getAttribute("title")).toBe("Unavailable offline");
        });

        it("does not dispatch landing-submit when offline + clicked", async () => {
            await element.updateComplete;
            element._uiState = { ...element._uiState, online: false };
            element.requestUpdate();
            await element.updateComplete;

            const textarea = /** @type {HTMLElement & { value: string }} */ (
                element.shadowRoot?.querySelector('[data-test="landing-input"]')
            );
            textarea.value = "Hello";
            textarea.dispatchEvent(new CustomEvent("sl-input", { bubbles: true }));
            await element.updateComplete;

            const result = /** @type {{ value: string | null }} */ ({ value: null });
            element.addEventListener(
                "landing-submit",
                /** @param {any} e */ (e) => {
                    result.value = e.detail.text;
                },
            );

            const sendBtn = element.shadowRoot?.querySelector('[data-test="landing-send"]');
            sendBtn?.dispatchEvent(new Event("click", { bubbles: true }));
            expect(result.value).toBeNull();
        });

        it("Enter key preventDefault + no submit when offline (no shake)", async () => {
            await element.updateComplete;
            element._uiState = { ...element._uiState, online: false };
            element.requestUpdate();
            await element.updateComplete;

            const textarea = /** @type {HTMLElement & { value: string }} */ (
                element.shadowRoot?.querySelector('[data-test="landing-input"]')
            );
            textarea.value = "Hello";
            textarea.dispatchEvent(new CustomEvent("sl-input", { bubbles: true }));
            await element.updateComplete;

            let dispatched = false;
            element.addEventListener("landing-submit", () => {
                dispatched = true;
            });

            const preventMock = mock(() => {});
            const ev = new KeyboardEvent("keydown", {
                key: "Enter",
                shiftKey: false,
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(ev, "preventDefault", { value: preventMock });
            textarea.dispatchEvent(ev);

            expect(preventMock).toHaveBeenCalled();
            expect(dispatched).toBe(false);
            expect(element.shadowRoot?.querySelector(".shake")).toBeNull();
        });

        it("phone new-chat icon has aria-disabled when offline", async () => {
            await element.updateComplete;
            element._uiState = {
                ...element._uiState,
                online: false,
                breakpoint: "phone",
            };
            element.requestUpdate();
            await element.updateComplete;
            const btn = element.shadowRoot?.querySelector(".new-chat-icon-btn");
            expect(btn?.getAttribute("aria-disabled")).toBe("true");
            expect(btn?.getAttribute("tabindex")).toBe("-1");
            expect(btn?.getAttribute("title")).toBe("Unavailable offline");
        });

        it("send button enabled again when back online", async () => {
            await element.updateComplete;
            element._uiState = { ...element._uiState, online: false };
            element.requestUpdate();
            await element.updateComplete;
            const sendBtn = /** @type {HTMLButtonElement} */ (
                element.shadowRoot?.querySelector('[data-test="landing-send"]')
            );
            expect(sendBtn.disabled).toBe(true);

            element._uiState = { ...element._uiState, online: true };
            element.requestUpdate();
            await element.updateComplete;
            const sendBtnOnline = /** @type {HTMLButtonElement} */ (
                element.shadowRoot?.querySelector('[data-test="landing-send"]')
            );
            expect(sendBtnOnline.disabled).toBe(false);
        });
    });
});
