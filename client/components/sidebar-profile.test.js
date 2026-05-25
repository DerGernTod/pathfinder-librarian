import "./sidebar-profile.js";
import { beforeEach, describe, expect, it } from "bun:test";

import { getByText } from "@testing-library/dom";

describe("sidebar-profile", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    /**
     * @param {string} name
     * @param {string} subtitle
     * @param {string} initials
     */
    function createProfile(name = "", subtitle = "", initials = "") {
        /** @type {any} */
        const el = document.createElement("sidebar-profile");
        el.name = name;
        el.subtitle = subtitle;
        el.initials = initials;
        document.body.appendChild(el);
        return el;
    }

    it("renders name", async () => {
        const el = createProfile("Game Master 01");
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "Game Master 01")).toBeTruthy();
    });

    it("renders subtitle", async () => {
        const el = createProfile("", "PF2e Remaster Rules");
        await el.updateComplete;
        expect(getByText(el.shadowRoot, "PF2e Remaster Rules")).toBeTruthy();
    });

    it("renders profile menu with initials", async () => {
        const el = createProfile("", "", "GM");
        await el.updateComplete;
        const profileMenu = el.shadowRoot.querySelector("profile-menu");
        expect(profileMenu).toBeTruthy();
    });

    it("renders with profile wrapper", async () => {
        const el = createProfile();
        await el.updateComplete;
        const wrapper = el.shadowRoot.querySelector(".profile");
        expect(wrapper).toBeTruthy();
    });

    it("renders in expanded state by default", async () => {
        const el = createProfile("Game Master 01", "PF2e Remaster Rules", "GM");
        await el.updateComplete;
        expect(el.collapsed).toBe(false);
        const wrapper = el.shadowRoot.querySelector(".profile");
        expect(wrapper.classList.contains("collapsed")).toBe(false);
    });

    it("renders in collapsed state when collapsed=true", async () => {
        const el = createProfile("Game Master 01", "PF2e Remaster Rules", "GM");
        el.collapsed = true;
        await el.updateComplete;
        const wrapper = el.shadowRoot.querySelector(".profile");
        expect(wrapper.classList.contains("collapsed")).toBe(true);
    });

    it("hides text container when collapsed", async () => {
        const el = createProfile("Game Master 01", "PF2e Remaster Rules", "GM");
        el.collapsed = true;
        await el.updateComplete;
        const wrapper = el.shadowRoot.querySelector(".profile");
        expect(wrapper.classList.contains("collapsed")).toBe(true);
        const textContainer = el.shadowRoot.querySelector(".text-container");
        expect(textContainer).toBeTruthy();
    });

    it("shows text container when expanded", async () => {
        const el = createProfile("Game Master 01", "PF2e Remaster Rules", "GM");
        el.collapsed = false;
        await el.updateComplete;
        const wrapper = el.shadowRoot.querySelector(".profile");
        expect(wrapper.classList.contains("collapsed")).toBe(false);
        const textContainer = el.shadowRoot.querySelector(".text-container");
        expect(textContainer).toBeTruthy();
    });

    it("always shows profile menu when collapsed", async () => {
        const el = createProfile("Game Master 01", "PF2e Remaster Rules", "GM");
        el.collapsed = true;
        await el.updateComplete;
        const profileMenu = el.shadowRoot.querySelector("profile-menu");
        expect(profileMenu).toBeTruthy();
    });

    it("provides aria-label when collapsed", async () => {
        const el = createProfile("Game Master 01", "PF2e Remaster Rules", "GM");
        el.collapsed = true;
        await el.updateComplete;
        const wrapper = el.shadowRoot.querySelector(".profile");
        expect(wrapper.getAttribute("aria-label")).toBe("Game Master 01 - PF2e Remaster Rules");
    });

    it("does not provide aria-label when expanded", async () => {
        const el = createProfile("Game Master 01", "PF2e Remaster Rules", "GM");
        el.collapsed = false;
        await el.updateComplete;
        const wrapper = el.shadowRoot.querySelector(".profile");
        expect(wrapper.getAttribute("aria-label")).toBe("");
    });

    it("displays version when version property is set", async () => {
        const el = createProfile("GM", "Player", "GP");
        el.version = "1.2.3";
        await el.updateComplete;
        const versionEl = el.shadowRoot.querySelector(".version");
        expect(versionEl).toBeTruthy();
        expect(versionEl.textContent).toBe("v1.2.3");
    });

    it("does not display version when version property is empty", async () => {
        const el = createProfile("GM", "Player", "GP");
        el.version = "";
        await el.updateComplete;
        const versionEl = el.shadowRoot.querySelector(".version");
        expect(versionEl).toBeNull();
    });

    it("version element uses muted styling", async () => {
        const el = createProfile();
        el.version = "1.0.0";
        await el.updateComplete;
        const versionEl = el.shadowRoot.querySelector(".version");
        expect(versionEl).toBeTruthy();
        const styles = getComputedStyle(versionEl);
        expect(styles.opacity).toBe("0.55");
    });
});
