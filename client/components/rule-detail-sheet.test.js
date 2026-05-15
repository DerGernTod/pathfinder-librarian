import "./rule-detail-sheet.js";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

describe("rule-detail-sheet", () => {
    /** @type {any} */
    let el;

    beforeEach(() => {
        document.body.innerHTML = "";
    });

    afterEach(() => {
        if (el && el.parentNode) {
            document.body.removeChild(el);
        }
    });

    /**
     * @returns {any}
     */
    function createElement() {
        el = document.createElement("rule-detail-sheet");
        document.body.appendChild(el);
        return el;
    }

    /**
     * Stub sl-dialog's show/hide so Shoelace animation promises
     * don't fail in happy-dom (getAnimations is not available).
     * @param {any} element
     */
    function stubDialog(element) {
        const dialog = element.shadowRoot?.querySelector("sl-dialog");
        if (dialog) {
            dialog.show = () => Promise.resolve();
            dialog.hide = () => Promise.resolve();
        }
    }

    it("renders sl-dialog element", async () => {
        const element = createElement();
        await element.updateComplete;
        const dialog = element.shadowRoot.querySelector("sl-dialog");
        expect(dialog).toBeTruthy();
    });

    it("renders detail content when show() is called", async () => {
        const element = createElement();
        await element.updateComplete;
        stubDialog(element);

        element.show({
            title: "Enfeebled",
            category: "condition",
            description: "You take a status penalty to Strength-based rolls.",
        });

        await element.updateComplete;
        await new Promise((r) => setTimeout(r, 50));

        const description = element.shadowRoot.querySelector(".rule-detail-description");
        expect(description).toBeTruthy();
        expect(description.textContent).toContain(
            "You take a status penalty to Strength-based rolls.",
        );
    });

    it("renders category tag when show() is called", async () => {
        const element = createElement();
        await element.updateComplete;
        stubDialog(element);

        element.show({
            title: "Enfeebled",
            category: "condition",
            description: "Test.",
        });

        await element.updateComplete;
        await new Promise((r) => setTimeout(r, 50));

        const tag = element.shadowRoot.querySelector(".rule-detail-header sl-tag");
        expect(tag).toBeTruthy();
        expect(tag.textContent?.trim()).toBe("condition");
    });

    it("renders traits when detail has traits", async () => {
        const element = createElement();
        await element.updateComplete;
        stubDialog(element);

        element.show({
            title: "Humanoid",
            category: "trait",
            description: "Humanoid creatures are human-shaped.",
            traits: ["Human", "Shapechanger"],
        });

        await element.updateComplete;
        await new Promise((r) => setTimeout(r, 50));

        const traitsContainer = element.shadowRoot.querySelector(".rule-detail-traits");
        expect(traitsContainer).toBeTruthy();
        const tags = traitsContainer.querySelectorAll("sl-tag");
        expect(tags.length).toBe(2);
    });

    it("renders loading state", async () => {
        const element = createElement();
        await element.updateComplete;

        element.loading = true;
        element.detail = { title: "Loading…", category: "" };
        await element.updateComplete;

        const loadingEl = element.shadowRoot.querySelector(".rule-detail-loading");
        expect(loadingEl).toBeTruthy();
        expect(loadingEl.textContent).toContain("Loading");
    });

    it("renders error state", async () => {
        const element = createElement();
        await element.updateComplete;

        element.error = "Failed to load rule item";
        element.loading = false;
        await element.updateComplete;

        const errorEl = element.shadowRoot.querySelector(".rule-detail-error");
        expect(errorEl).toBeTruthy();
        expect(errorEl.textContent).toContain("Failed to load rule item");
    });

    it("clears content on dialog hide", async () => {
        const element = createElement();
        await element.updateComplete;

        element.detail = {
            title: "Enfeebled",
            category: "condition",
            description: "Test description.",
        };
        await element.updateComplete;

        expect(element.detail).not.toBeNull();

        const dialog = element.shadowRoot.querySelector("sl-dialog");
        dialog.dispatchEvent(new CustomEvent("sl-after-hide"));

        expect(element.detail).toBeNull();
        expect(element.loading).toBe(false);
        expect(element.error).toBe("");
    });

    it("ignores rule-detail-request without ruleItemId", async () => {
        const element = createElement();
        await element.updateComplete;
        stubDialog(element);

        element.dispatchEvent(
            new CustomEvent("rule-detail-request", {
                detail: { name: "Unknown" },
                bubbles: true,
                composed: true,
            }),
        );

        await element.updateComplete;
        expect(element.detail).toBeNull();
        expect(element.loading).toBe(false);
    });

    it("removes event listener on disconnect", async () => {
        const element = createElement();
        await element.updateComplete;

        document.body.removeChild(element);
        await new Promise((r) => setTimeout(r, 50));

        expect(() => {
            element.dispatchEvent(
                new CustomEvent("rule-detail-request", {
                    detail: { ruleItemId: "test", name: "Test" },
                    bubbles: true,
                    composed: true,
                }),
            );
        }).not.toThrow();
    });
});
