import { expect, test } from "playwright/test";

import { SEED_IDS } from "../../shared/constants.js";
import { setupTestUser } from "../helpers/test-user.js";

test.describe("rule-detail-sheet visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);

        await page.route("**/api/conversations*", async (route) => {
            if (route.request().method() === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        result: "success",
                        data: [
                            {
                                id: "conv-rds1",
                                title: "Rule Detail Sheet Test",
                                userId: "00000000-0000-4000-8000-000000000001",
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                messageCount: 0,
                            },
                        ],
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // Stat block with traitRefs containing ruleItemId
        const statBlockWithTraitRefs = {
            type: "stat-block",
            title: "Goblin Warrior",
            data: {
                name: "Goblin Warrior",
                type: "Humanoid",
                level: 1,
                rarity: "common",
                traits: ["Goblinoid", "Humanoid"],
                traitRefs: [
                    {
                        name: "Goblinoid",
                        ruleItemId: SEED_IDS.RULE_TRAIT_GOBLINOID,
                    },
                    {
                        name: "Humanoid",
                        ruleItemId: SEED_IDS.RULE_TRAIT_HUMANOID,
                    },
                ],
                perception: 5,
                languages: { value: ["Common", "Goblin"] },
                attributes: {
                    ac: { value: 14 },
                    hp: { value: 18, max: 18 },
                    fortitude: { value: 5 },
                    reflex: { value: 7 },
                    will: { value: 3 },
                },
                abilities: {
                    str: { mod: 1 },
                    dex: { mod: 3 },
                    con: { mod: 1 },
                    int: { mod: 0 },
                    wis: { mod: 1 },
                    cha: { mod: 0 },
                },
            },
        };

        await page.route("**/api/conversations/*/messages*", async (route) => {
            if (route.request().method() === "POST") {
                const now = new Date().toISOString();
                const body = route.request().postDataJSON();
                const userMessage = {
                    type: "userMessage",
                    data: {
                        id: "um-rds1",
                        conversationId: "conv-rds1",
                        role: "user",
                        content: body.content || "",
                        mode: body.mode || "gm",
                        createdAt: now,
                    },
                };
                const assistantComplete = {
                    type: "assistantComplete",
                    data: {
                        id: "am-rds1",
                        conversationId: "conv-rds1",
                        role: "assistant",
                        content: null,
                        mode: body.mode || "gm",
                        createdAt: now,
                        blocks: [statBlockWithTraitRefs],
                    },
                };

                await route.fulfill({
                    status: 200,
                    contentType: "text/event-stream",
                    body:
                        JSON.stringify(userMessage) +
                        "\n" +
                        JSON.stringify(assistantComplete) +
                        "\n",
                });
            } else if (route.request().method() === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ result: "success", data: [] }),
                });
            } else {
                await route.continue();
            }
        });

        // Mock the rule-items API for dialog fetch
        await page.route("**/api/rule-items/*", async (route) => {
            const url = route.request().url();
            if (url.includes(SEED_IDS.RULE_CONDITION_ENFEEBLED)) {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        result: "success",
                        data: {
                            id: SEED_IDS.RULE_CONDITION_ENFEEBLED,
                            type: "condition",
                            name: "Enfeebled",
                            compendiumSource: "Compendium.pf2e.conditionitems.Item.Enfeebled",
                            data: {
                                description:
                                    "You take a status penalty to your Strength-based attack and damage rolls.",
                                category: "condition",
                            },
                        },
                    }),
                });
            } else if (url.includes(SEED_IDS.RULE_TRAIT_HUMANOID)) {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        result: "success",
                        data: {
                            id: SEED_IDS.RULE_TRAIT_HUMANOID,
                            type: "trait",
                            name: "Humanoid",
                            compendiumSource: "Compendium.pf2e.trait.Item.Humanoid",
                            data: {
                                description:
                                    "Humanoid creatures are any creatures that are vaguely human-shaped.",
                                category: "creature",
                                traits: ["Human"],
                            },
                        },
                    }),
                });
            } else if (url.includes(SEED_IDS.RULE_TRAIT_GOBLINOID)) {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        result: "success",
                        data: {
                            id: SEED_IDS.RULE_TRAIT_GOBLINOID,
                            type: "trait",
                            name: "Goblinoid",
                            compendiumSource: "Compendium.pf2e.trait.Item.Goblinoid",
                            data: {
                                description:
                                    "Goblinoids are a family of creatures including goblins, hobgoblins, and bugbears.",
                                category: "creature",
                                traits: ["Goblin"],
                            },
                        },
                    }),
                });
            } else {
                await route.fulfill({
                    status: 404,
                    contentType: "application/json",
                    body: JSON.stringify({ result: "error", error: "Not found" }),
                });
            }
        });
    });

    /**
     * Takes a screenshot of the visible Shoelace dialog panel.
     * The sl-dialog host element renders its visible content in shadow DOM,
     * so we clip the page screenshot to the panel's actual bounding box.
     * @param {import("playwright/test").Page} page
     * @param {string} name
     * @param {{ maxDiffPixelRatio?: number }} [options]
     */
    async function screenshotDialogPanel(page, name, options = {}) {
        const box = await page.locator("rule-detail-sheet sl-dialog").evaluate((el) => {
            const panel = /** @type {HTMLElement|null} */ (
                el.shadowRoot?.querySelector('[part="panel"]')
            );
            if (!panel) {
                return null;
            }
            const r = panel.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
        if (!box) {
            throw new Error("Dialog panel not found in shadow DOM");
        }
        await expect(page).toHaveScreenshot(name, {
            clip: box,
            maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.05,
        });
    }
    /**
     * @param {import("playwright/test").Page} page
     */
    async function navigateToStatBlock(page) {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a goblin warrior");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const detailsEl = page.locator("stat-block sl-details").first();
        await detailsEl.click();
        await page.waitForTimeout(500);
    }

    test("open dialog from trait click shows condition detail", async ({ page }) => {
        await navigateToStatBlock(page);

        // Disable animations for deterministic snapshot
        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        // Click the "Goblinoid" trait tag (first clickable trait)
        const clickableTag = page.locator("stat-block .traits sl-tag.clickable").first();
        await clickableTag.click();
        await page.waitForTimeout(500);

        await page.waitForTimeout(300);
        await screenshotDialogPanel(page, "rule-detail-sheet-condition-open.png");
    });

    test("open dialog from trait click shows trait detail with sub-traits", async ({ page }) => {
        await navigateToStatBlock(page);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        // Click the "Humanoid" trait tag (second clickable trait)
        const tags = page.locator("stat-block .traits sl-tag.clickable");
        await tags.nth(1).click();
        await page.waitForTimeout(500);

        await page.waitForTimeout(300);
        await screenshotDialogPanel(page, "rule-detail-sheet-trait-with-traits.png");
    });

    test("rule-detail-sheet phone viewport", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await navigateToStatBlock(page);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const clickableTag = page.locator("stat-block .traits sl-tag.clickable").first();
        await clickableTag.click();
        await page.waitForTimeout(500);

        await page.waitForTimeout(300);
        await screenshotDialogPanel(page, "rule-detail-sheet-phone.png");
    });

    test("rule-detail-sheet tablet viewport", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await navigateToStatBlock(page);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const clickableTag = page.locator("stat-block .traits sl-tag.clickable").first();
        await clickableTag.click();
        await page.waitForTimeout(500);

        await page.waitForTimeout(300);
        await screenshotDialogPanel(page, "rule-detail-sheet-tablet.png");
    });

    test("rule-detail-sheet desktop viewport", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await navigateToStatBlock(page);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const clickableTag = page.locator("stat-block .traits sl-tag.clickable").first();
        await clickableTag.click();
        await page.waitForTimeout(500);

        await page.waitForTimeout(300);
        await screenshotDialogPanel(page, "rule-detail-sheet-desktop.png");
    });
});
