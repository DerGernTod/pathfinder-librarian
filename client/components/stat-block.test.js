import "./stat-block.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { getByText } from "@testing-library/dom";

describe("stat-block", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /**
     * @param {string} title
     * @param {Record<string, unknown>} data
     */
    function createStatBlock(title, data) {
        /** @type {any} */
        const el = document.createElement("stat-block");
        el.title = title;
        el.data = data;
        document.body.appendChild(el);
        return el;
    }

    it("renders title in summary", async () => {
        const el = createStatBlock("Mitflit King", { name: "Mitflit King" });
        await el.updateComplete;
        expect(getByText(el, /View Mitflit King Stat Block/)).toBeTruthy();
    });

    it("renders formatted JSON data in pre element", async () => {
        const data = { name: "Test", level: 4 };
        const el = createStatBlock("Test", data);
        await el.updateComplete;
        const pre = el.querySelector("pre");
        expect(pre.textContent).toBe(JSON.stringify(data, null, 2));
    });

    it("renders details element (collapsed by default)", async () => {
        const el = createStatBlock("Test", { foo: "bar" });
        await el.updateComplete;
        const details = el.querySelector("details");
        expect(details).toBeTruthy();
        expect(details.open).toBe(false);
    });

    it("contains chevron svg in summary", async () => {
        const el = createStatBlock("Test", {});
        await el.updateComplete;
        const svg = el.querySelector("summary svg");
        expect(svg).toBeTruthy();
    });
});
