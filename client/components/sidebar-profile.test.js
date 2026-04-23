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
        expect(getByText(el, "Game Master 01")).toBeTruthy();
    });

    it("renders subtitle", async () => {
        const el = createProfile("", "PF2e Remaster Rules");
        await el.updateComplete;
        expect(getByText(el, "PF2e Remaster Rules")).toBeTruthy();
    });

    it("renders initials in avatar", async () => {
        const el = createProfile("", "", "GM");
        await el.updateComplete;
        expect(getByText(el, "GM")).toBeTruthy();
    });

    it("renders with border-t separator", async () => {
        const el = createProfile();
        await el.updateComplete;
        const wrapper = el.querySelector(".border-t");
        expect(wrapper).toBeTruthy();
    });
});
