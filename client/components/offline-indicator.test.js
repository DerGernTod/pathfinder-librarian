import "./offline-indicator.js";
import { beforeEach, describe, expect, it } from "bun:test";

describe("offline-indicator", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /** @param {{ online?: boolean }} [opts] */
    function createIndicator(opts) {
        /** @type {any} */
        const el = document.createElement("offline-indicator");
        if (opts?.online !== undefined) {
            el.online = opts.online;
        }
        document.body.appendChild(el);
        return el;
    }

    it("renders nothing when online (default)", async () => {
        const el = createIndicator();
        await el.updateComplete;
        expect(el.shadowRoot.childElementCount).toBe(0);
    });

    it("renders nothing when online is true explicitly", async () => {
        const el = createIndicator({ online: true });
        await el.updateComplete;
        expect(el.shadowRoot.childElementCount).toBe(0);
    });

    it("renders offline-badge with role=status when offline", async () => {
        const el = createIndicator({ online: false });
        await el.updateComplete;
        const badge = el.shadowRoot.querySelector(".offline-badge");
        expect(badge).toBeTruthy();
        expect(badge.getAttribute("role")).toBe("status");
        expect(badge.getAttribute("aria-live")).toBe("polite");
        expect(badge.getAttribute("title")).toContain("offline");
    });

    it("renders the warning icon inside the badge", async () => {
        const el = createIndicator({ online: false });
        await el.updateComplete;
        const svg = el.shadowRoot.querySelector(".offline-badge svg.icon");
        expect(svg).toBeTruthy();
    });

    it("uses inline-flex on :host so it flows inside the header", async () => {
        const el = createIndicator({ online: false });
        await el.updateComplete;
        const styles = el.constructor.styles;
        const cssText = styles
            .map(/** @param {{ cssText?: string }} s */ (s) => s.cssText)
            .join("");
        expect(cssText).toContain(":host");
        expect(cssText).toContain("display: inline-flex");
        // Must NOT use absolute positioning (header is flex, not grid).
        expect(cssText).not.toContain("position: absolute");
    });

    it("reflects uiContext updates: online→offline shows badge", async () => {
        const el = createIndicator({ online: true });
        await el.updateComplete;
        expect(el.shadowRoot.childElementCount).toBe(0);

        el.online = false;
        el.requestUpdate();
        await el.updateComplete;

        const badge = el.shadowRoot.querySelector(".offline-badge");
        expect(badge).toBeTruthy();
    });
});
