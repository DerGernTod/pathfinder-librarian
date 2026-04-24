import "./sidebar-toggle.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { fireEvent } from "@testing-library/dom";

describe("sidebar-toggle", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    function createToggle(expanded = true) {
        /** @type {any} */
        const el = document.createElement("sidebar-toggle");
        el.expanded = expanded;
        document.body.appendChild(el);
        return el;
    }

    it("renders correctly when expanded", async () => {
        const el = createToggle(true);
        await el.updateComplete;
        const btn = el.shadowRoot.querySelector("button");
        expect(btn).toBeTruthy();
        expect(btn.getAttribute("aria-label")).toBe("Collapse sidebar");
        expect(btn.querySelector("svg")).toBeTruthy();
    });

    it("renders correctly when collapsed", async () => {
        const el = createToggle(false);
        await el.updateComplete;
        const btn = el.shadowRoot.querySelector("button");
        expect(btn).toBeTruthy();
        expect(btn.getAttribute("aria-label")).toBe("Expand sidebar");
    });

    it("emits toggle-sidebar event on click", async () => {
        const el = createToggle();
        await el.updateComplete;

        let dispatched = false;
        el.addEventListener("toggle-sidebar", () => {
            dispatched = true;
        });

        const btn = el.shadowRoot.querySelector("button");
        fireEvent.click(btn);
        expect(dispatched).toBe(true);
    });

    it("shows right arrow icon when expanded (→ for collapse)", async () => {
        const el = createToggle(true);
        await el.updateComplete;
        const path = el.shadowRoot.querySelector("path");
        expect(path.getAttribute("d")).toBe("M9 5l7 7-7 7");
    });

    it("shows left arrow icon when collapsed (← for expand)", async () => {
        const el = createToggle(false);
        await el.updateComplete;
        const path = el.shadowRoot.querySelector("path");
        expect(path.getAttribute("d")).toBe("M15 19l-7-7 7-7");
    });
});
