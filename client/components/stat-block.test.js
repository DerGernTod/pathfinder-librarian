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

    const fullMonsterData = {
        name: "Mitflit King",
        type: "Humanoid",
        level: 4,
        traits: ["Goblin", "Humanoid"],
        perception: "+8",
        languages: "Common, Goblin",
        attributes: {
            ac: 18,
            hp: 52,
            fortitude: "+8",
            reflex: "+6",
            will: "+10",
        },
        skills: {
            Stealth: "+10",
            Acrobatics: "+8",
            Athletics: "+7",
        },
        str: 2,
        dex: 3,
        con: 3,
        int: 0,
        wis: 4,
        cha: -1,
        actions: [
            {
                name: "Pick",
                actionType: "single",
                description: "The Mitflit makes a pick Strike.",
            },
        ],
        spells: [
            {
                name: "Detect Magic",
                dc: 19,
                tradition: "Arcane",
                rank: 1,
                description: "The Mitflit can detect magic.",
            },
        ],
        abilities: [
            {
                name: "Underworld Guide",
                description: "The Mitflit can navigate tunnels with ease.",
            },
        ],
    };

    it("renders sl-details with title in summary attribute", async () => {
        const el = createStatBlock("Mitflit King", fullMonsterData);
        await el.updateComplete;
        const details = el.shadowRoot.querySelector("sl-details");
        expect(details).toBeTruthy();
        expect(details.getAttribute("summary")).toBe("View Mitflit King Stat Block");
    });

    it("renders sl-details element collapsed by default", async () => {
        const el = createStatBlock("Test", fullMonsterData);
        await el.updateComplete;
        const details = /** @type {any} */ (el.shadowRoot.querySelector("sl-details"));
        expect(details).toBeTruthy();
        expect(details.open).toBeFalsy();
    });

    it("sl-details contains sl-card with content", async () => {
        const el = createStatBlock("Test", fullMonsterData);
        await el.updateComplete;
        const card = el.shadowRoot.querySelector("sl-details > sl-card");
        expect(card).toBeTruthy();
    });

    describe("header rendering", () => {
        it("renders creature name prominently in h3", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const h3 = el.shadowRoot.querySelector("h3");
            expect(h3).toBeTruthy();
            expect(h3.textContent).toBe("Mitflit King");
        });

        it("renders type and level on same line", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const typeLevel = el.shadowRoot.querySelector(".type-level");
            expect(typeLevel).toBeTruthy();
            expect(typeLevel.textContent).toBe("Humanoid 4");
        });

        it("renders traits as sl-tag elements", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const traitsContainer = el.shadowRoot.querySelector(".traits");
            expect(traitsContainer).toBeTruthy();
            const tags = traitsContainer.querySelectorAll("sl-tag");
            expect(tags.length).toBe(2);
            expect(tags[0].textContent).toBe("Goblin");
            expect(tags[1].textContent).toBe("Humanoid");
        });
    });

    describe("primary stats rendering", () => {
        it("renders AC value", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const acValue = el.shadowRoot.querySelector(".ac-value");
            expect(acValue).toBeTruthy();
            expect(acValue.textContent).toBe("18");
        });

        it("renders HP value", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const hpValue = el.shadowRoot.querySelector(".hp-value");
            expect(hpValue).toBeTruthy();
            expect(hpValue.textContent).toBe("52");
        });

        it("renders saves in grid format", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const fort = el.shadowRoot.querySelector(".save-fort");
            const ref = el.shadowRoot.querySelector(".save-ref");
            const will = el.shadowRoot.querySelector(".save-will");
            expect(fort).toBeTruthy();
            expect(fort.textContent.trim()).toBe("Fort +8");
            expect(ref).toBeTruthy();
            expect(ref.textContent.trim()).toBe("Ref +6");
            expect(will).toBeTruthy();
            expect(will.textContent.trim()).toBe("Will +10");
        });

        it("renders perception and languages", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const perception = el.shadowRoot.querySelector(".perception");
            const languages = el.shadowRoot.querySelector(".languages");
            expect(perception).toBeTruthy();
            expect(perception.textContent).toBe("Perception +8");
            expect(languages).toBeTruthy();
            expect(languages.textContent).toBe("Languages: Common, Goblin");
        });
    });

    describe("ability scores rendering", () => {
        it("renders all 6 ability scores in grid", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const scores = el.shadowRoot.querySelectorAll(".ability-score");
            expect(scores.length).toBe(6);
            expect(scores[0].textContent.trim()).toBe("STR +2");
            expect(scores[1].textContent.trim()).toBe("DEX +3");
            expect(scores[2].textContent.trim()).toBe("CON +3");
            expect(scores[3].textContent.trim()).toBe("INT +0");
            expect(scores[4].textContent.trim()).toBe("WIS +4");
            expect(scores[5].textContent.trim()).toBe("CHA -1");
        });
    });

    describe("skills rendering", () => {
        it("renders skills list with bonuses", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const skills = el.shadowRoot.querySelectorAll(".skill-entry");
            expect(skills.length).toBeGreaterThanOrEqual(3);
            expect(Array.from(skills).some((s) => s.textContent.includes("Stealth"))).toBe(true);
        });
    });

    describe("drill-down sections", () => {
        it("renders actions section when data exists", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const actionsSection = el.shadowRoot.querySelector("sl-details[summary='Actions']");
            expect(actionsSection).toBeTruthy();
        });

        it("does not render actions section when data missing", async () => {
            const data = { ...fullMonsterData, actions: undefined };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const actionsSection = el.shadowRoot.querySelector("sl-details[summary='Actions']");
            expect(actionsSection).toBeFalsy();
        });

        it("renders spells section with tradition/rank when data exists", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const spellsSection = el.shadowRoot.querySelector("sl-details[summary='Spells']");
            expect(spellsSection).toBeTruthy();
            const traditionTag = el.shadowRoot.querySelector(".spell-tradition");
            expect(traditionTag).toBeTruthy();
            expect(traditionTag.textContent).toBe("Arcane");
        });

        it("does not render spells section when data missing", async () => {
            const data = { ...fullMonsterData, spells: undefined };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const spellsSection = el.shadowRoot.querySelector("sl-details[summary='Spells']");
            expect(spellsSection).toBeFalsy();
        });

        it("renders abilities section when data exists", async () => {
            const el = createStatBlock("Test", fullMonsterData);
            await el.updateComplete;
            const abilitiesSection = el.shadowRoot.querySelector("sl-details[summary='Abilities']");
            expect(abilitiesSection).toBeTruthy();
        });

        it("does not render abilities section when data missing", async () => {
            const data = { ...fullMonsterData, abilities: undefined };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const abilitiesSection = el.shadowRoot.querySelector("sl-details[summary='Abilities']");
            expect(abilitiesSection).toBeFalsy();
        });
    });

    describe("edge cases", () => {
        it("renders with minimal monster data (no actions/spells/abilities)", async () => {
            const minimalData = {
                name: "Simple Goblin",
                type: "Humanoid",
                level: 1,
                traits: ["Goblin"],
                perception: "+4",
                languages: "Goblin",
                attributes: {
                    ac: 15,
                    hp: 20,
                    fortitude: "+5",
                    reflex: "+4",
                    will: "+2",
                },
                skills: {},
                str: 2,
                dex: 1,
                con: 2,
                int: 0,
                wis: 0,
                cha: 0,
            };
            const el = createStatBlock("Test", minimalData);
            await el.updateComplete;
            expect(el.shadowRoot.querySelector("h3")).toBeTruthy();
            expect(el.shadowRoot.querySelector(".ac-value")).toBeTruthy();
        });

        it("handles negative ability scores", async () => {
            const data = { ...fullMonsterData, cha: -3 };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const chaScore = el.shadowRoot.querySelectorAll(".ability-score")[5];
            expect(chaScore.textContent.trim()).toBe("CHA -3");
        });

        it("handles empty skills object", async () => {
            const data = { ...fullMonsterData, skills: {} };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            expect(el.shadowRoot.querySelector("h3")).toBeTruthy();
        });
    });
});
