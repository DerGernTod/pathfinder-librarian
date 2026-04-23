import "./stat-block.js";
import { beforeEach, describe, expect, it } from "bun:test";

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

    it("renders sl-details with title in summary attribute", async () => {
        const el = createStatBlock("Mitflit King", { name: "Mitflit King" });
        await el.updateComplete;
        const details = el.shadowRoot.querySelector("sl-details");
        expect(details).toBeTruthy();
        expect(details.getAttribute("summary")).toBe("View Mitflit King Stat Block");
    });

    it("renders formatted JSON data in sl-card pre element", async () => {
        const data = { name: "Test", level: 4 };
        const el = createStatBlock("Test", data);
        await el.updateComplete;
        const pre = el.shadowRoot.querySelector("pre");
        expect(pre.textContent.trim()).toBe(JSON.stringify(data, null, 2));
    });

    it("renders sl-details element collapsed by default", async () => {
        const el = createStatBlock("Test", { foo: "bar" });
        await el.updateComplete;
        const details = /** @type {any} */ (el.shadowRoot.querySelector("sl-details"));
        expect(details).toBeTruthy();
        expect(details.open).toBeFalsy();
    });

    it("sl-details contains sl-card with content", async () => {
        const el = createStatBlock("Test", {});
        await el.updateComplete;
        const card = el.shadowRoot.querySelector("sl-details > sl-card");
        expect(card).toBeTruthy();
    });
});
