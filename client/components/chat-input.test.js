import "./chat-input.js";
import { beforeEach, describe, expect, it, mock } from "bun:test";

import { fireEvent, getByText } from "@testing-library/dom";

describe("chat-input", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    function createInput() {
        /** @type {any} */
        const el = document.createElement("chat-input");
        document.body.appendChild(el);
        return el;
    }

    it("renders sl-textarea with placeholder", async () => {
        const el = createInput();
        await el.updateComplete;
        const textarea = el.shadowRoot.querySelector("sl-textarea");
        expect(textarea).toBeTruthy();
        expect(textarea.getAttribute("placeholder")).toBe("Ask about rules, lore, or mechanics...");
    });

    it("renders send button", async () => {
        const el = createInput();
        await el.updateComplete;
        const button = el.shadowRoot.querySelector("button");
        expect(button).toBeTruthy();
    });

    it("dispatches send-message on button click with text", async () => {
        const el = createInput();
        await el.updateComplete;

        el.value = "Hello";
        el.requestUpdate();
        await el.updateComplete;

        /** @type {any} */
        let detail = null;
        el.addEventListener(
            "send-message",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        const button = /** @type {HTMLElement} */ (el.shadowRoot.querySelector("button"));
        fireEvent.click(button);
        expect(detail).toBeTruthy();
        if (detail) {
            expect(detail.text).toBe("Hello");
        }
    });

    it("clears value after submit", async () => {
        const el = createInput();
        await el.updateComplete;

        el.value = "Test";
        el.requestUpdate();
        await el.updateComplete;

        const button = /** @type {HTMLElement} */ (el.shadowRoot.querySelector("button"));
        fireEvent.click(button);
        await el.updateComplete;

        expect(el.value).toBe("");
    });

    it("does not dispatch send-message for empty input", async () => {
        const el = createInput();
        await el.updateComplete;

        let dispatched = false;
        el.addEventListener("send-message", () => {
            dispatched = true;
        });

        const button = /** @type {HTMLElement} */ (el.shadowRoot.querySelector("button"));
        fireEvent.click(button);
        expect(dispatched).toBe(false);
    });

    it("does not dispatch send-message when disabled (responding is true)", async () => {
        const el = createInput();
        el._msgState = { messages: [], responding: true };
        await el.updateComplete;

        el.value = "Hello";
        el.requestUpdate();
        await el.updateComplete;

        let dispatched = false;
        el.addEventListener("send-message", () => {
            dispatched = true;
        });

        const button = /** @type {HTMLElement} */ (el.shadowRoot.querySelector("button"));
        fireEvent.click(button);
        expect(dispatched).toBe(false);
    });

    it("renders stop button when responding", async () => {
        const el = createInput();
        el._msgState = { messages: [], responding: true };
        await el.updateComplete;

        const stop = Array.from(el.shadowRoot.querySelectorAll("button")).find((b) =>
            /Stop/.test(b.textContent || ""),
        );
        expect(stop).toBeTruthy();
    });

    it("renders disclaimer text", async () => {
        const el = createInput();
        await el.updateComplete;
        expect(getByText(el.shadowRoot, /Pathfinder Librarian can make mistakes/)).toBeTruthy();
    });

    it("does not render warning when API key is available", async () => {
        const el = createInput();
        el._apiKeyStatus = { available: true, reason: "ok" };
        await el.updateComplete;

        const warningIcon = el.shadowRoot.querySelector(".api-warning-icon");
        expect(warningIcon).toBeNull();
    });

    it("renders warning icon when API key is not set", async () => {
        const el = createInput();
        el._apiKeyStatus = { available: false, reason: "not_set" };
        await el.updateComplete;

        const warningIcon = el.shadowRoot.querySelector(".api-warning-icon");
        expect(warningIcon).toBeTruthy();
        const tooltip = el.shadowRoot.querySelector("sl-tooltip");
        expect(tooltip).toBeTruthy();
        expect(tooltip.getAttribute("content")).toBe("API key not configured");
    });

    it("renders warning icon when API key is empty", async () => {
        const el = createInput();
        el._apiKeyStatus = { available: false, reason: "empty" };
        await el.updateComplete;

        const warningIcon = el.shadowRoot.querySelector(".api-warning-icon");
        expect(warningIcon).toBeTruthy();
        const tooltip = el.shadowRoot.querySelector("sl-tooltip");
        expect(tooltip).toBeTruthy();
        expect(tooltip.getAttribute("content")).toBe("API key is empty");
    });

    it("warning icon has correct aria-label", async () => {
        const el = createInput();
        el._apiKeyStatus = { available: false, reason: "not_set" };
        await el.updateComplete;

        const warningIcon = el.shadowRoot.querySelector(".api-warning-icon");
        expect(warningIcon).toBeTruthy();
        expect(warningIcon.getAttribute("aria-label")).toBe("API key not configured");
    });

    it("re-focuses textarea after submit", async () => {
        const el = createInput();
        await el.updateComplete;

        el.value = "Hello";
        el.requestUpdate();
        await el.updateComplete;

        const slTextarea = el.shadowRoot.querySelector("sl-textarea");
        /** @type {import("bun:test").Mock<() => void>} */
        const focusSpy = mock(() => {});
        slTextarea.focus = focusSpy;

        const button = /** @type {HTMLElement} */ (el.shadowRoot.querySelector("button"));
        fireEvent.click(button);

        expect(focusSpy).toHaveBeenCalled();
    });

    it("focus() method delegates to sl-textarea", async () => {
        const el = createInput();
        await el.updateComplete;

        const slTextarea = el.shadowRoot.querySelector("sl-textarea");
        /** @type {import("bun:test").Mock<() => void>} */
        const focusSpy = mock(() => {});
        slTextarea.focus = focusSpy;

        el.focus();

        expect(focusSpy).toHaveBeenCalled();
    });

    it("textarea CSS includes max-height rule", async () => {
        const el = createInput();
        await el.updateComplete;

        const styles = el.constructor.styles;
        const cssTexts = styles.map(/** @param {{ cssText?: string }} s */ (s) => s.cssText);
        const hasMaxHeight = cssTexts.some(
            /** @param {string | undefined} t */ (t) => t && t.includes("max-height"),
        );
        expect(hasMaxHeight).toBe(true);
    });

    describe("offline behavior", () => {
        it("disables send button when offline", async () => {
            const el = createInput();
            el._uiState = { ...el._uiState, online: false };
            await el.updateComplete;

            const button = el.shadowRoot.querySelector("button.send-btn");
            expect(button).toBeTruthy();
            expect(button.disabled).toBe(true);
        });

        it("send button has unavailable-offline title when offline", async () => {
            const el = createInput();
            el._uiState = { ...el._uiState, online: false };
            await el.updateComplete;

            const button = el.shadowRoot.querySelector("button.send-btn");
            expect(button.getAttribute("title")).toBe("Unavailable offline");
        });

        it("does not dispatch send-message when offline + button clicked", async () => {
            const el = createInput();
            el._uiState = { ...el._uiState, online: false };
            el.value = "Hello";
            await el.updateComplete;

            let dispatched = false;
            el.addEventListener("send-message", () => {
                dispatched = true;
            });

            const button = el.shadowRoot.querySelector("button.send-btn");
            fireEvent.click(button);
            expect(dispatched).toBe(false);
        });

        it("Enter key preventDefault + no send-message when offline (no shake)", async () => {
            const el = createInput();
            el._uiState = { ...el._uiState, online: false };
            el.value = "Hello";
            await el.updateComplete;

            let dispatched = false;
            el.addEventListener("send-message", () => {
                dispatched = true;
            });

            const preventSpy = mock(() => {});
            const ev = new KeyboardEvent("keydown", {
                key: "Enter",
                shiftKey: false,
                bubbles: true,
                cancelable: true,
            });
            Object.defineProperty(ev, "preventDefault", { value: preventSpy });

            el.handleKeydown(ev);

            expect(preventSpy).toHaveBeenCalled();
            expect(dispatched).toBe(false);
            // No shake class should exist anywhere
            expect(el.shadowRoot.querySelector(".shake")).toBeNull();
        });

        it("keeps textarea editable offline (user may still draft)", async () => {
            const el = createInput();
            el._uiState = { ...el._uiState, online: false };
            await el.updateComplete;

            const textarea = el.shadowRoot.querySelector("sl-textarea");
            expect(textarea.hasAttribute("disabled")).toBe(false);
        });

        it("send button is enabled again when online", async () => {
            const el = createInput();
            el._uiState = { ...el._uiState, online: false };
            await el.updateComplete;
            const buttonOffline = el.shadowRoot.querySelector("button.send-btn");
            expect(buttonOffline.disabled).toBe(true);

            el._uiState = { ...el._uiState, online: true };
            el.value = "Hello";
            el.requestUpdate();
            await el.updateComplete;
            const buttonOnline = el.shadowRoot.querySelector("button.send-btn");
            expect(buttonOnline.disabled).toBe(false);
        });
    });
});
