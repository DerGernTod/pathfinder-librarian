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

    const fullCreatureData = {
        name: "Mitflit King",
        type: "NPC",
        level: 4,
        rarity: "unique",
        traits: ["Goblinoid", "Humanoid", "Mitflit"],
        perception: 9,
        languages: { value: ["Common", "Goblin"], details: "" },
        attributes: {
            ac: { value: 21 },
            hp: { value: 55, max: 55 },
            fortitude: { value: 10 },
            reflex: { value: 9 },
            will: { value: 7 },
            speed: "25 feet",
        },
        abilities: {
            str: { mod: 2 },
            dex: { mod: 4 },
            con: { mod: 3 },
            int: { mod: 0 },
            wis: { mod: 1 },
            cha: { mod: 4 },
        },
        skills: {
            Acrobatics: { value: 9 },
            Athletics: { value: 7 },
            Deception: { value: 9 },
            Intimidation: { value: 11 },
            Stealth: { value: 9 },
        },
        melee: [
            {
                name: "dagger",
                attack: "+9 (agile, finesse, versatile S)",
                damage: "1d4+4 piercing",
                damageType: "piercing",
                traits: ["agile", "finesse"],
            },
        ],
        spellcasting: [
            {
                name: "Mitflit Innate Spells",
                tradition: "occult",
                type: "innate",
                dc: 17,
                attackModifier: 7,
                cantrips: [{ name: "Daze", rank: 1 }],
                slots: { "1st": [{ name: "Illusory Disguise", rank: 1 }] },
            },
        ],
        actions: [
            {
                name: "Sneak",
                actionType: 1,
                traits: ["move"],
                description: "The mitflit Strides...",
            },
            {
                name: "Cowardly Snare",
                actionType: "reaction",
                traits: ["manipulate"],
                description: "Trigger...",
            },
        ],
    };

    it("renders sl-details with title in summary attribute", async () => {
        const el = createStatBlock("Mitflit King", fullCreatureData);
        await el.updateComplete;
        const details = el.shadowRoot.querySelector("sl-details");
        expect(details).toBeTruthy();
        expect(details.getAttribute("summary")).toBe("View Mitflit King Stat Block");
    });

    it("renders sl-details element collapsed by default", async () => {
        const el = createStatBlock("Test", fullCreatureData);
        await el.updateComplete;
        const details = /** @type {any} */ (el.shadowRoot.querySelector("sl-details"));
        expect(details).toBeTruthy();
        expect(details.open).toBeFalsy();
    });

    it("sl-details contains sl-card with content", async () => {
        const el = createStatBlock("Test", fullCreatureData);
        await el.updateComplete;
        const card = el.shadowRoot.querySelector("sl-details > sl-card");
        expect(card).toBeTruthy();
    });

    describe("header rendering", () => {
        it("renders creature name prominently in h3", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const h3 = el.shadowRoot.querySelector("h3");
            expect(h3).toBeTruthy();
            expect(h3.textContent).toBe("Mitflit King");
        });

        it("renders type and level on same line", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const typeLevel = el.shadowRoot.querySelector(".type-level");
            expect(typeLevel).toBeTruthy();
            expect(typeLevel.textContent).toContain("NPC");
            expect(typeLevel.textContent).toContain("4");
        });

        it("renders rarity badge", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const typeLevel = el.shadowRoot.querySelector(".type-level");
            expect(typeLevel).toBeTruthy();
            const rarityTag = typeLevel.querySelector("sl-tag");
            expect(rarityTag).toBeTruthy();
            expect(rarityTag.textContent).toBe("unique");
        });

        it("renders traits as sl-tag elements", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const traitsContainer = el.shadowRoot.querySelector(".traits");
            expect(traitsContainer).toBeTruthy();
            const tags = traitsContainer.querySelectorAll("sl-tag");
            expect(tags.length).toBe(3);
            expect(tags[0].textContent).toBe("Goblinoid");
            expect(tags[1].textContent).toBe("Humanoid");
            expect(tags[2].textContent).toBe("Mitflit");
        });
    });

    describe("primary stats rendering", () => {
        it("renders AC value from object", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const acValue = el.shadowRoot.querySelector(".ac-value");
            expect(acValue).toBeTruthy();
            expect(acValue.textContent.trim()).toBe("21");
        });

        it("renders HP value/max from object", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const hpValue = el.shadowRoot.querySelector(".hp-value");
            expect(hpValue).toBeTruthy();
            expect(hpValue.textContent.trim()).toBe("55/55");
        });

        it("renders saves from object values", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const fort = el.shadowRoot.querySelector(".save-fort");
            const ref = el.shadowRoot.querySelector(".save-ref");
            const will = el.shadowRoot.querySelector(".save-will");
            expect(fort).toBeTruthy();
            expect(fort.textContent.trim()).toBe("Fort +10");
            expect(ref).toBeTruthy();
            expect(ref.textContent.trim()).toBe("Ref +9");
            expect(will).toBeTruthy();
            expect(will.textContent.trim()).toBe("Will +7");
        });

        it("renders perception as numeric modifier", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const perception = el.shadowRoot.querySelector(".perception");
            expect(perception).toBeTruthy();
            expect(perception.textContent).toBe("Perception +9");
        });

        it("renders speed", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const speed = el.shadowRoot.querySelector(".speed");
            expect(speed).toBeTruthy();
            expect(speed.textContent).toBe("Speed 25 feet");
        });

        it("renders languages from structured object", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const languages = el.shadowRoot.querySelector(".languages");
            expect(languages).toBeTruthy();
            expect(languages.textContent.trim()).toBe("Languages: Common, Goblin");
        });
    });

    describe("ability scores rendering", () => {
        it("renders all 6 ability scores from mod objects", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const scores = el.shadowRoot.querySelectorAll(".ability-score");
            expect(scores.length).toBe(6);
            expect(scores[0].textContent.trim()).toBe("STR +2");
            expect(scores[1].textContent.trim()).toBe("DEX +4");
            expect(scores[2].textContent.trim()).toBe("CON +3");
            expect(scores[3].textContent.trim()).toBe("INT +0");
            expect(scores[4].textContent.trim()).toBe("WIS +1");
            expect(scores[5].textContent.trim()).toBe("CHA +4");
        });
    });

    describe("skills rendering", () => {
        it("renders skills list with bonuses from objects", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const skills = el.shadowRoot.querySelectorAll(".skill-entry");
            expect(skills.length).toBeGreaterThanOrEqual(5);
            expect(Array.from(skills).some((s) => s.textContent.includes("Acrobatics +9"))).toBe(
                true,
            );
            expect(Array.from(skills).some((s) => s.textContent.includes("Intimidation +11"))).toBe(
                true,
            );
        });
    });

    describe("melee section", () => {
        it("renders melee section with strikes", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const meleeSection = el.shadowRoot.querySelector("sl-details[summary='Melee Strikes']");
            expect(meleeSection).toBeTruthy();
        });

        it("renders melee attack and damage", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const meleeSection = el.shadowRoot.querySelector("sl-details[summary='Melee Strikes']");
            expect(meleeSection).toBeTruthy();
            const actionName = meleeSection.querySelector(".action-name");
            expect(actionName).toBeTruthy();
            expect(actionName.textContent).toBe("dagger");
            const actionType = meleeSection.querySelector(".action-type");
            expect(actionType).toBeTruthy();
            expect(actionType.textContent).toContain("+9");
        });

        it("does not render melee section when missing", async () => {
            const data = { ...fullCreatureData, melee: undefined };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const meleeSection = el.shadowRoot.querySelector("sl-details[summary='Melee Strikes']");
            expect(meleeSection).toBeFalsy();
        });
    });

    describe("spellcasting section", () => {
        it("renders spellcasting section with entries", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const spellSection = el.shadowRoot.querySelector("sl-details[summary='Spellcasting']");
            expect(spellSection).toBeTruthy();
        });

        it("renders spellcasting tradition and DC", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const spellSection = el.shadowRoot.querySelector("sl-details[summary='Spellcasting']");
            expect(spellSection).toBeTruthy();
            const traditionTag = spellSection.querySelector(".spell-tradition");
            expect(traditionTag).toBeTruthy();
            expect(traditionTag.textContent).toBe("occult");
            const details = spellSection.querySelector(".spell-details");
            expect(details.textContent).toContain("DC 17");
        });

        it("does not render spellcasting section when missing", async () => {
            const data = { ...fullCreatureData, spellcasting: undefined };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const spellSection = el.shadowRoot.querySelector("sl-details[summary='Spellcasting']");
            expect(spellSection).toBeFalsy();
        });
    });

    describe("drill-down sections", () => {
        it("renders actions section when data exists", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const actionsSection = el.shadowRoot.querySelector("sl-details[summary='Actions']");
            expect(actionsSection).toBeTruthy();
        });

        it("does not render actions section when data missing", async () => {
            const data = { ...fullCreatureData, actions: undefined };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const actionsSection = el.shadowRoot.querySelector("sl-details[summary='Actions']");
            expect(actionsSection).toBeFalsy();
        });

        it("renders actions with numeric action-type symbols", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const actionsSection = el.shadowRoot.querySelector("sl-details[summary='Actions']");
            expect(actionsSection).toBeTruthy();
            const actionNames = actionsSection.querySelectorAll(".action-name");
            // First action has actionType: 1 → ⬤
            expect(actionNames[0].textContent).toContain("⬤");
            expect(actionNames[0].textContent).toContain("Sneak");
            // Second action has actionType: "reaction" → ⬢
            expect(actionNames[1].textContent).toContain("⬢");
            expect(actionNames[1].textContent).toContain("Cowardly Snare");
        });

        it("renders action traits as tags", async () => {
            const el = createStatBlock("Test", fullCreatureData);
            await el.updateComplete;
            const actionsSection = el.shadowRoot.querySelector("sl-details[summary='Actions']");
            const tags = actionsSection.querySelectorAll("sl-tag");
            expect(tags.length).toBeGreaterThanOrEqual(2);
            expect(Array.from(tags).some((t) => t.textContent === "move")).toBe(true);
            expect(Array.from(tags).some((t) => t.textContent === "manipulate")).toBe(true);
        });
    });

    describe("backward compatibility with old MonsterStatBlock shape", () => {
        const oldMonsterData = {
            name: "Old Monster",
            type: "Humanoid",
            level: 2,
            traits: ["Goblin"],
            perception: "+5",
            languages: "Common, Goblin",
            attributes: { ac: 15, hp: 20, fortitude: "+6", reflex: "+5", will: "+3" },
            skills: { Stealth: "+7" },
            str: 2,
            dex: 3,
            con: 1,
            int: 0,
            wis: 1,
            cha: 0,
            actions: [
                { name: "Strike", actionType: "single", description: "A melee Strike." },
                { name: "Retaliate", actionType: "reaction", description: "Trigger..." },
            ],
        };

        it("renders old shape without errors", async () => {
            const el = createStatBlock("Test", oldMonsterData);
            await el.updateComplete;
            expect(el.shadowRoot.querySelector("h3")).toBeTruthy();
            expect(el.shadowRoot.querySelector("h3").textContent).toBe("Old Monster");
        });

        it("converts old flat AC to object", async () => {
            const el = createStatBlock("Test", oldMonsterData);
            await el.updateComplete;
            const acValue = el.shadowRoot.querySelector(".ac-value");
            expect(acValue).toBeTruthy();
            expect(acValue.textContent.trim()).toBe("15");
        });

        it("converts old flat HP to value/max", async () => {
            const el = createStatBlock("Test", oldMonsterData);
            await el.updateComplete;
            const hpValue = el.shadowRoot.querySelector(".hp-value");
            expect(hpValue).toBeTruthy();
            expect(hpValue.textContent.trim()).toBe("20/20");
        });

        it("converts old string saves to numeric", async () => {
            const el = createStatBlock("Test", oldMonsterData);
            await el.updateComplete;
            const fort = el.shadowRoot.querySelector(".save-fort");
            expect(fort).toBeTruthy();
            expect(fort.textContent.trim()).toBe("Fort +6");
        });

        it("converts old string perception to numeric", async () => {
            const el = createStatBlock("Test", oldMonsterData);
            await el.updateComplete;
            const perception = el.shadowRoot.querySelector(".perception");
            expect(perception).toBeTruthy();
            expect(perception.textContent).toBe("Perception +5");
        });

        it("converts old string languages to structured", async () => {
            const el = createStatBlock("Test", oldMonsterData);
            await el.updateComplete;
            const languages = el.shadowRoot.querySelector(".languages");
            expect(languages).toBeTruthy();
            expect(languages.textContent.trim()).toBe("Languages: Common, Goblin");
        });

        it("converts old bare ability scores to mod objects", async () => {
            const el = createStatBlock("Test", oldMonsterData);
            await el.updateComplete;
            const scores = el.shadowRoot.querySelectorAll(".ability-score");
            expect(scores.length).toBe(6);
            expect(scores[0].textContent.trim()).toBe("STR +2");
            expect(scores[1].textContent.trim()).toBe("DEX +3");
            expect(scores[5].textContent.trim()).toBe("CHA +0");
        });

        it("converts old string skills to numeric objects", async () => {
            const el = createStatBlock("Test", oldMonsterData);
            await el.updateComplete;
            const skills = el.shadowRoot.querySelectorAll(".skill-entry");
            expect(skills.length).toBe(1);
            expect(skills[0].textContent).toContain("Stealth +7");
        });

        it("converts old action types: single→⬤, reaction→⬢", async () => {
            const el = createStatBlock("Test", oldMonsterData);
            await el.updateComplete;
            const actionsSection = el.shadowRoot.querySelector("sl-details[summary='Actions']");
            expect(actionsSection).toBeTruthy();
            const actionNames = actionsSection.querySelectorAll(".action-name");
            expect(actionNames[0].textContent).toContain("⬤");
            expect(actionNames[0].textContent).toContain("Strike");
            expect(actionNames[1].textContent).toContain("⬢");
            expect(actionNames[1].textContent).toContain("Retaliate");
        });
    });

    describe("action type formatting", () => {
        it("formats numeric action types correctly", async () => {
            const data = {
                ...fullCreatureData,
                actions: [
                    { name: "Free", actionType: 0, description: "free action" },
                    { name: "One", actionType: 1, description: "one action" },
                    { name: "Two", actionType: 2, description: "two actions" },
                    { name: "Three", actionType: 3, description: "three actions" },
                    { name: "React", actionType: "reaction", description: "reaction" },
                    { name: "FreeAct", actionType: "free", description: "free" },
                ],
            };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const actionsSection = el.shadowRoot.querySelector("sl-details[summary='Actions']");
            const actionNames = actionsSection.querySelectorAll(".action-name");
            expect(actionNames[0].textContent).toContain("◯");
            expect(actionNames[1].textContent).toContain("⬤");
            expect(actionNames[2].textContent).toContain("⬤⬤");
            expect(actionNames[3].textContent).toContain("⬤⬤⬤");
            expect(actionNames[4].textContent).toContain("⬢");
            expect(actionNames[5].textContent).toContain("◯");
        });

        it("formats old string action types: single→⬤, two→⬤⬤, three→⬤⬤⬤", async () => {
            const data = {
                name: "Test",
                traits: [],
                attributes: { ac: { value: 10 }, hp: { value: 5, max: 5 } },
                actions: [
                    { name: "A", actionType: "single", description: "a" },
                    { name: "B", actionType: "two", description: "b" },
                    { name: "C", actionType: "three", description: "c" },
                ],
            };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const actionsSection = el.shadowRoot.querySelector("sl-details[summary='Actions']");
            const actionNames = actionsSection.querySelectorAll(".action-name");
            expect(actionNames[0].textContent).toContain("⬤");
            expect(actionNames[1].textContent).toContain("⬤⬤");
            expect(actionNames[2].textContent).toContain("⬤⬤⬤");
        });
    });

    describe("edge cases", () => {
        it("renders with minimal creature data (no melee/spellcasting/actions)", async () => {
            const minimalData = {
                name: "Simple Goblin",
                type: "Humanoid",
                level: 1,
                traits: ["Goblin"],
                perception: 4,
                languages: { value: ["Goblin"] },
                attributes: {
                    ac: { value: 15 },
                    hp: { value: 20, max: 20 },
                    fortitude: { value: 5 },
                    reflex: { value: 4 },
                    will: { value: 2 },
                },
                abilities: {
                    str: { mod: 2 },
                    dex: { mod: 1 },
                    con: { mod: 2 },
                    int: { mod: 0 },
                    wis: { mod: 0 },
                    cha: { mod: 0 },
                },
            };
            const el = createStatBlock("Test", minimalData);
            await el.updateComplete;
            expect(el.shadowRoot.querySelector("h3")).toBeTruthy();
            expect(el.shadowRoot.querySelector(".ac-value")).toBeTruthy();
        });

        it("handles negative ability modifiers", async () => {
            const data = {
                ...fullCreatureData,
                abilities: { ...fullCreatureData.abilities, cha: { mod: -3 } },
            };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            const chaScore = el.shadowRoot.querySelectorAll(".ability-score")[5];
            expect(chaScore.textContent.trim()).toBe("CHA -3");
        });

        it("handles empty skills object", async () => {
            const data = { ...fullCreatureData, skills: {} };
            const el = createStatBlock("Test", data);
            await el.updateComplete;
            expect(el.shadowRoot.querySelector("h3")).toBeTruthy();
        });

        it("handles empty data object", async () => {
            const el = createStatBlock("Test", {});
            await el.updateComplete;
            expect(el.shadowRoot.querySelector("h3")).toBeTruthy();
            expect(el.shadowRoot.querySelector("h3").textContent).toBe("Unknown");
        });
    });
});
