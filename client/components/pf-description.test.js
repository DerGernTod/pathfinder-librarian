import { describe, expect, it } from "bun:test";

/**
 * @typedef {import("./pf-description.js").PfDescription} PfDescription
 */

describe("pf-description", () => {
    it("renders segments with ruleItemId as clickable anchor elements", async () => {
        const el = /** @type {PfDescription} */ (document.createElement("pf-description"));
        el.segments = [
            { text: "You can use the ", ruleItemId: undefined },
            { text: "Shield Block", ruleItemId: "test-id-123" },
            { text: " reaction to reduce damage." },
        ];

        document.body.appendChild(el);
        await el.updateComplete;

        const root = el.shadowRoot;
        expect(root).not.toBeNull();
        if (!root) {
            return;
        }

        const links = root.querySelectorAll("a.rule-ref");
        expect(links.length).toBe(1);
        expect(links[0].textContent).toContain("Shield Block");

        document.body.removeChild(el);
    });

    it("renders @Check patterns as check-badge spans", async () => {
        const el = /** @type {PfDescription} */ (document.createElement("pf-description"));
        el.description = "You must succeed at a @Check[fortitude|dc:25|name:Frost Rune] save.";

        document.body.appendChild(el);
        await el.updateComplete;

        const root = el.shadowRoot;
        expect(root).not.toBeNull();
        if (!root) {
            return;
        }

        const badge = root.querySelector(".check-badge");
        expect(badge).not.toBeNull();
        expect(badge?.textContent).toContain("Fortitude DC 25");

        document.body.removeChild(el);
    });

    it("renders @Damage patterns as damage-badge spans", async () => {
        const el = /** @type {PfDescription} */ (document.createElement("pf-description"));
        el.description = "The target takes @Damage[1d6[acid]] damage.";

        document.body.appendChild(el);
        await el.updateComplete;

        const root = el.shadowRoot;
        const badge = root?.querySelector(".damage-badge");
        expect(badge).not.toBeNull();
        expect(badge?.textContent).toContain("1d6 acid");

        document.body.removeChild(el);
    });

    it("renders plain text when no markup present", async () => {
        const el = /** @type {PfDescription} */ (document.createElement("pf-description"));
        el.description = "No special markup, just plain text.";

        document.body.appendChild(el);
        await el.updateComplete;

        const root = el.shadowRoot;
        expect(root?.textContent?.trim()).toBe("No special markup, just plain text.");

        document.body.removeChild(el);
    });

    it("prefers segments over description when both provided", async () => {
        const el = /** @type {PfDescription} */ (document.createElement("pf-description"));
        el.segments = [{ text: "This comes from segments." }];
        el.description = "This should be ignored.";

        document.body.appendChild(el);
        await el.updateComplete;

        const root = el.shadowRoot;
        expect(root?.textContent).toContain("This comes from segments.");

        document.body.removeChild(el);
    });

    it("dispatches rule-detail-request when rule-ref is clicked", async () => {
        const el = /** @type {PfDescription} */ (document.createElement("pf-description"));
        el.segments = [{ text: "Clickable ", ruleItemId: "click-me" }, { text: "text" }];

        /** @type {{ detail: unknown } | null} */
        let capturedEvent = null;
        const listener = (/** @type {Event} */ e) => {
            capturedEvent = /** @type {CustomEvent} */ (e);
        };
        document.body.addEventListener("rule-detail-request", listener);

        document.body.appendChild(el);
        await el.updateComplete;

        const root = el.shadowRoot;
        const link = root?.querySelector("a.rule-ref");
        expect(link).not.toBeNull();
        /** @type {HTMLElement} */ (link).click();

        expect(capturedEvent).not.toBeNull();
        const detail = /** @type {{ ruleItemId: string }} */ (
            /** @type {CustomEvent} */ (/** @type {unknown} */ (capturedEvent)).detail
        );
        expect(detail.ruleItemId).toBe("click-me");

        document.body.removeChild(el);
        document.body.removeEventListener("rule-detail-request", listener);
    });

    it("renders @Damage inline patterns inside HTML from @Localize", async () => {
        // Regression: HTML detection must not short-circuit inline
        // pattern parsing. When @Localize resolutions produce HTML
        // containing @Damage tags, both the HTML structure AND the
        // damage badges must render.
        const el = /** @type {PfDescription} */ (document.createElement("pf-description"));
        el.description =
            "<p>Harmed by sonic @Damage[6d6[untyped]], healed by fire @Damage[2d6[healing]].</p>";

        document.body.appendChild(el);
        await el.updateComplete;

        const root = el.shadowRoot;
        const p = root?.querySelector("p");
        expect(p).not.toBeNull();
        const badges = root?.querySelectorAll(".damage-badge");
        expect(badges?.length).toBe(2);
        expect(badges?.[0]?.textContent).toContain("6d6 untyped");
        expect(badges?.[1]?.textContent).toContain("2d6 healing");

        document.body.removeChild(el);
    });
});
