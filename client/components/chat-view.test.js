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
        expect(/** @type {{ text: string }} */ (/** @type {unknown} */ (detail)).text).toBe(
            "Hello",
        );
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
