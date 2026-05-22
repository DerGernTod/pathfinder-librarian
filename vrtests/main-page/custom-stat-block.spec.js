import { expect, test } from "playwright/test";

import { setupTestUser } from "../helpers/test-user.js";

test.describe("custom stat block visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);

        // Mock conversations list with one conversation so chat-view renders instead of landing-view
        await page.route("**/api/conversations*", async (route) => {
            if (route.request().method() === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        result: "success",
                        data: [
                            {
                                id: "conv-custom-1",
                                title: "Custom Stat Block Test",
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

        // Mock SSE with a custom-stat-block (already resolved to stat-block by server in production,
        // but for VR tests we mock the final stat-block with inline data directly)
        const mockCustomStatBlock = {
            type: "stat-block",
            title: "Sylvaris",
            data: {
                name: "Sylvaris",
                type: "Humanoid",
                level: 5,
                rarity: "uncommon",
                traits: ["Elf", "Ranger"],
                perception: 10,
                languages: { value: ["Common", "Elven", "Sylvan"] },
                size: "med",
                blurb: "A graceful elven ranger who patrols the ancient forest",
                attributes: {
                    ac: { value: 22 },
                    hp: { value: 75, max: 75 },
                    fortitude: { value: 9, saveDetail: "+2 status from Ring of Fortitude" },
                    reflex: { value: 14 },
                    will: { value: 11 },
                    speed: "30 feet",
                },
                abilities: {
                    str: { mod: 2 },
                    dex: { mod: 4 },
                    con: { mod: 1 },
                    int: { mod: 2 },
                    wis: { mod: 3 },
                    cha: { mod: 1 },
                },
                skills: {
                    Nature: { value: 12 },
                    Stealth: { value: 14 },
                    Survival: { value: 12 },
                },
                melee: [
                    {
                        name: "Longbow",
                        attack: "+14",
                        damage: "1d8+4 piercing",
                        damageType: "piercing",
                        traits: ["propulsive", "volley 30 ft."],
                    },
                    {
                        name: "Short Sword",
                        attack: "+13",
                        damage: "1d6+4 piercing",
                        damageType: "piercing",
                        traits: ["agile", "finesse", "versatile slashing"],
                    },
                ],
                actions: [
                    {
                        name: "Hunt Prey",
                        actionType: 1,
                        traits: ["concentrate", "ranger"],
                        description:
                            "You designate a single creature as your prey and focus your attacks on it. You gain a +2 circumstance bonus to Perception checks to Seek your prey and to Survival checks to Track your prey.",
                    },
                    {
                        name: "Double Shot",
                        actionType: 2,
                        traits: ["ranger", "press"],
                        description:
                            "You fire two shots. Make two Strikes, each against a separate target. The penalty for multiple attacks does not increase until after both Strikes.",
                    },
                    {
                        name: "Elven Instincts",
                        actionType: "reaction",
                        traits: ["elf"],
                        description:
                            "Trigger: You attempt a saving throw against a magical effect. You gain a +1 circumstance bonus to the triggering save.",
                    },
                ],
                spellcasting: [
                    {
                        name: "Ranger Spells",
                        tradition: "primal",
                        type: "prepared",
                        dc: 20,
                        attackModifier: 12,
                        slots: {
                            "1st": [
                                { name: "Heal Animal", rank: 1 },
                                { name: "Longstrider", rank: 1 },
                            ],
                        },
                    },
                ],
                description: "Sylvaris is a dedicated guardian of the Verdant Expanse.",
            },
        };

        const mockMinimalStatBlock = {
            type: "stat-block",
            title: "Shadow Sprite",
            data: {
                name: "Shadow Sprite",
                type: "Fey",
                level: 1,
                traits: ["Fey", "Shadow"],
                attributes: {
                    ac: { value: 14 },
                    hp: { value: 15, max: 15 },
                },
                abilities: {
                    str: { mod: -2 },
                    dex: { mod: 3 },
                    con: { mod: 0 },
                    int: { mod: 1 },
                    wis: { mod: 2 },
                    cha: { mod: 1 },
                },
            },
        };

        const mockRedactedStatBlock = {
            type: "stat-block",
            title: "Sylvaris",
            redacted: true,
            data: {
                name: "Sylvaris",
                type: "Humanoid",
                rarity: "uncommon",
                traits: ["Elf", "Ranger"],
                size: "med",
                blurb: "A graceful elven ranger who patrols the ancient forest",
                redacted: true,
            },
        };

        await page.route("**/api/conversations/*/messages*", async (route) => {
            if (route.request().method() === "POST") {
                const body = route.request().postDataJSON();
                const content = (body.content || "").toLowerCase();
                const now = new Date().toISOString();

                let block;
                if (content.includes("minimal")) {
                    block = mockMinimalStatBlock;
                } else if (content.includes("player") || body.mode === "player") {
                    block = mockRedactedStatBlock;
                } else {
                    block = mockCustomStatBlock;
                }

                const userMessage = {
                    type: "userMessage",
                    data: {
                        id: "um-custom-1",
                        conversationId: "conv-custom-1",
                        role: "user",
                        content: body.content,
                        mode: body.mode || "gm",
                        createdAt: now,
                    },
                };
                const assistantComplete = {
                    type: "assistantComplete",
                    data: {
                        id: "am-custom-1",
                        conversationId: "conv-custom-1",
                        role: "assistant",
                        content: null,
                        mode: body.mode || "gm",
                        createdAt: now,
                        blocks: [block],
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
    });

    test("custom stat block full desktop layout", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a custom creature");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("custom-stat-block-full-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("custom stat block full tablet layout", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a custom creature");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("custom-stat-block-full-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("custom stat block full phone layout", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a custom creature");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("custom-stat-block-full-phone.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("custom stat block minimal desktop layout", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a minimal custom creature");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("custom-stat-block-minimal-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("custom stat block redacted player mode desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Tell me about this player creature");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("custom-stat-block-redacted-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });
});
