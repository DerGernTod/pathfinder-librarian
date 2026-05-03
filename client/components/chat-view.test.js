import "./chat-view.js";
import { beforeEach, describe, expect, it } from "bun:test";

describe("chat-view", () => {
    /** @type {import("./chat-view.js").ChatView} */
    let element;

    beforeEach(() => {
        document.body.innerHTML = "";
        element = /** @type {import("./chat-view.js").ChatView} */ (
            document.createElement("chat-view")
        );
        document.body.appendChild(element);
    });

    it("renders chat-header child", async () => {
        await element.updateComplete;

        const header = element.shadowRoot?.querySelector("chat-header");
        expect(header).toBeTruthy();
    });

    it("renders message-list child", async () => {
        await element.updateComplete;

        const list = element.shadowRoot?.querySelector("message-list");
        expect(list).toBeTruthy();
    });

    it("renders chat-input child", async () => {
        await element.updateComplete;

        const input = element.shadowRoot?.querySelector("chat-input");
        expect(input).toBeTruthy();
    });

    it("passes mode to chat-header", async () => {
        element.mode = "gm";
        await element.updateComplete;

        const header = /** @type {HTMLElement & { mode: string }} */ (
            element.shadowRoot?.querySelector("chat-header")
        );
        expect(header.mode).toBe("gm");
    });

    it("passes mode to chat-input", async () => {
        element.mode = "gm";
        await element.updateComplete;

        const input = /** @type {HTMLElement & { mode: string }} */ (
            element.shadowRoot?.querySelector("chat-input")
        );
        expect(input.mode).toBe("gm");
    });

    it("passes messages to message-list", async () => {
        const msg = /** @type {import("../../shared/types.js").Message} */ ({
            id: "m1",
            conversationId: "c1",
            content: "Hello",
            role: "user",
            mode: "player",
            createdAt: new Date().toISOString(),
        });
        element.messages = [msg];
        await element.updateComplete;

        const list = /** @type {HTMLElement & { messages: unknown[] }} */ (
            element.shadowRoot?.querySelector("message-list")
        );
        expect(list.messages).toEqual([msg]);
    });

    it("passes loading to message-list", async () => {
        element.loading = true;
        await element.updateComplete;

        const list = /** @type {HTMLElement & { loading: boolean }} */ (
            element.shadowRoot?.querySelector("message-list")
        );
        expect(list.loading).toBe(true);
    });

    it("passes responding to chat-input", async () => {
        element.responding = true;
        await element.updateComplete;

        const input = /** @type {HTMLElement & { responding: boolean }} */ (
            element.shadowRoot?.querySelector("chat-input")
        );
        expect(input.responding).toBe(true);
    });

    it("bubbles mode-change from chat-header", async () => {
        await element.updateComplete;

        /** @type {{ mode: string } | null} */
        let detail = null;
        element.addEventListener(
            "mode-change",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        const header = element.shadowRoot?.querySelector("chat-header");
        header?.dispatchEvent(
            new CustomEvent("mode-change", {
                detail: { mode: "gm" },
                bubbles: true,
                composed: true,
            }),
        );

        expect(detail).toBeTruthy();
        expect(/** @type {{ mode: string }} */ (/** @type {unknown} */ (detail)).mode).toBe("gm");
    });

    it("bubbles send-message from chat-input", async () => {
        await element.updateComplete;

        /** @type {{ text: string } | null} */
        let detail = null;
        element.addEventListener(
            "send-message",
            /** @param {any} e */ (e) => {
                detail = e.detail;
            },
        );

        const input = element.shadowRoot?.querySelector("chat-input");
        input?.dispatchEvent(
            new CustomEvent("send-message", {
                detail: { text: "Hello" },
                bubbles: true,
                composed: true,
            }),
        );

        expect(detail).toBeTruthy();
        expect(/** @type {{ text: string }} */ (/** @type {unknown} */ (detail)).text).toBe("Hello");
    });

    it("bubbles stop-message from chat-input", async () => {
        await element.updateComplete;

        let fired = false;
        element.addEventListener("stop-message", () => {
            fired = true;
        });

        const input = element.shadowRoot?.querySelector("chat-input");
        input?.dispatchEvent(
            new CustomEvent("stop-message", {
                bubbles: true,
                composed: true,
            }),
        );

        expect(fired).toBe(true);
    });
});
