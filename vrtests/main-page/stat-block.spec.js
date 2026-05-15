import { expect, test } from "playwright/test";

import { setupTestUser } from "../helpers/test-user.js";

test.describe("stat block visual regression", () => {
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
                                id: "conv-1",
                                title: "Stat Block Test",
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

        // Mock LLM response with deterministic stat block data to avoid flaky dimensions
        const mockOrcStatBlock = {
            type: "stat-block",
            title: "Orc Warrior",
            data: {
                name: "Orc Warrior",
                type: "Humanoid",
                level: 1,
                rarity: "common",
                traits: ["Orc", "Humanoid"],
                perception: 7,
                languages: { value: ["Common", "Orcish"] },
                attributes: {
                    ac: { value: 15 },
                    hp: { value: 23, max: 23 },
                    fortitude: { value: 9 },
                    reflex: { value: 8 },
                    will: { value: 6 },
                    speed: "20 feet",
                },
                abilities: {
                    str: { mod: 4 },
                    dex: { mod: 2 },
                    con: { mod: 2 },
                    int: { mod: -1 },
                    wis: { mod: -1 },
                    cha: { mod: 0 },
                },
                skills: { Athletics: { value: 12 }, Intimidation: { value: 8 } },
                melee: [
                    {
                        name: "Greataxe",
                        attack: "+9",
                        damage: "1d12+4 slashing",
                        damageType: "slashing",
                        traits: ["sweep"],
                    },
                ],
                actions: [
                    {
                        name: "Ferocity",
                        actionType: "reaction",
                        description: "When reduced to 0 HP, make a Strike.",
                    },
                ],
                spellcasting: [
                    {
                        name: "Orc Spells",
                        tradition: "divine",
                        type: "innate",
                        dc: 14,
                        slots: { "2nd": [{ name: "Darkness", rank: 2 }] },
                    },
                ],
            },
        };

        const mockGoblinStatBlock = {
            type: "stat-block",
            title: "Goblin Scout",
            data: {
                name: "Goblin Scout",
                type: "Humanoid",
                level: 0,
                traits: ["Goblin"],
                perception: 4,
                languages: { value: ["Common", "Goblin"] },
                attributes: {
                    ac: { value: 12 },
                    hp: { value: 6, max: 6 },
                    fortitude: { value: 3 },
                    reflex: { value: 5 },
                    will: { value: 2 },
                },
                abilities: {
                    str: { mod: 0 },
                    dex: { mod: 2 },
                    con: { mod: 0 },
                    int: { mod: -1 },
                    wis: { mod: -1 },
                    cha: { mod: 0 },
                },
                skills: { Stealth: { value: 5 }, Acrobatics: { value: 5 } },
            },
        };

        await page.route("**/api/conversations/*/messages*", async (route) => {
            if (route.request().method() === "POST") {
                const body = route.request().postDataJSON();
                const content = body.content || "";
                const now = new Date().toISOString();

                // Choose stat block based on prompt text
                const block = content.toLowerCase().includes("goblin")
                    ? mockGoblinStatBlock
                    : mockOrcStatBlock;

                const userMessage = {
                    type: "userMessage",
                    data: {
                        id: "um-1",
                        conversationId: "conv-1",
                        role: "user",
                        content,
                        mode: body.mode || "gm",
                        createdAt: now,
                    },
                };
                const assistantComplete = {
                    type: "assistantComplete",
                    data: {
                        id: "am-1",
                        conversationId: "conv-1",
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

    test("full stat block with all features", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a stat block");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await expect(statBlock).toHaveScreenshot("stat-block-full.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("minimal stat block (partial data)", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a simple goblin stat block");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await expect(statBlock).toHaveScreenshot("stat-block-minimal.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("stat block mobile layout", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a stat block");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("stat-block-mobile.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("stat block tablet layout", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a stat block");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("stat-block-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("stat block desktop layout", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me a stat block");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("stat-block-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test.describe("interactive traits", () => {
        test.beforeEach(async ({ page }) => {
            // Override the SSE mock to return a stat block with traitRefs
            await page.route("**/api/conversations/*/messages*", async (route) => {
                if (route.request().method() === "POST") {
                    const body = route.request().postDataJSON();
                    const content = body.content || "";
                    const now = new Date().toISOString();

                    const block = {
                        type: "stat-block",
                        title: "Orc Warrior",
                        data: {
                            name: "Orc Warrior",
                            type: "Humanoid",
                            level: 1,
                            rarity: "common",
                            traits: ["Orc", "Humanoid", "Unique"],
                            traitRefs: [
                                { name: "Orc", ruleItemId: "id-orc-trait" },
                                { name: "Humanoid", ruleItemId: "id-humanoid-trait" },
                                { name: "Unique" },
                            ],
                            perception: 7,
                            languages: { value: ["Common", "Orcish"] },
                            attributes: {
                                ac: { value: 15 },
                                hp: { value: 23, max: 23 },
                                fortitude: { value: 9 },
                                reflex: { value: 8 },
                                will: { value: 6 },
                                speed: "20 feet",
                            },
                            abilities: {
                                str: { mod: 4 },
                                dex: { mod: 2 },
                                con: { mod: 2 },
                                int: { mod: -1 },
                                wis: { mod: -1 },
                                cha: { mod: 0 },
                            },
                        },
                    };

                    const userMessage = {
                        type: "userMessage",
                        data: {
                            id: "um-trait1",
                            conversationId: "conv-1",
                            role: "user",
                            content,
                            mode: body.mode || "gm",
                            createdAt: now,
                        },
                    };
                    const assistantComplete = {
                        type: "assistantComplete",
                        data: {
                            id: "am-trait1",
                            conversationId: "conv-1",
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

            // Mock rule-items API for trait click
            await page.route("**/api/rule-items/*", async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        result: "success",
                        data: {
                            id: "id-orc-trait",
                            type: "trait",
                            name: "Orc",
                            data: {
                                description: "Orcs are a fierce and warlike people.",
                                category: "creature",
                            },
                        },
                    }),
                });
            });
        });

        test("stat block with clickable traits phone viewport", async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 812 });
            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);

            await page.evaluate(() => {
                const s = document.createElement("style");
                s.textContent =
                    "*, *::before, *::after { animation: none !important; transition: none !important; }";
                document.head.appendChild(s);
            });

            const input = page.locator("[data-test='landing-input']");
            await input.fill("Show me a stat block with traits");
            await input.press("Enter");
            await page.waitForSelector("stat-block", { timeout: 5000 });
            await page.waitForTimeout(500);

            const statBlock = page.locator("stat-block").first();

            await page.waitForTimeout(300);
            await expect(statBlock).toHaveScreenshot("stat-block-clickable-traits-phone.png", {
                maxDiffPixelRatio: 0.05,
            });
        });

        test("stat block with clickable traits tablet viewport", async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });
            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);

            await page.evaluate(() => {
                const s = document.createElement("style");
                s.textContent =
                    "*, *::before, *::after { animation: none !important; transition: none !important; }";
                document.head.appendChild(s);
            });

            const input = page.locator("[data-test='landing-input']");
            await input.fill("Show me a stat block with traits");
            await input.press("Enter");
            await page.waitForSelector("stat-block", { timeout: 5000 });
            await page.waitForTimeout(500);

            const statBlock = page.locator("stat-block").first();

            await page.waitForTimeout(300);
            await expect(statBlock).toHaveScreenshot("stat-block-clickable-traits-tablet.png", {
                maxDiffPixelRatio: 0.05,
            });
        });

        test("stat block with clickable traits desktop viewport", async ({ page }) => {
            await page.setViewportSize({ width: 1280, height: 800 });
            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);

            await page.evaluate(() => {
                const s = document.createElement("style");
                s.textContent =
                    "*, *::before, *::after { animation: none !important; transition: none !important; }";
                document.head.appendChild(s);
            });

            const input = page.locator("[data-test='landing-input']");
            await input.fill("Show me a stat block with traits");
            await input.press("Enter");
            await page.waitForSelector("stat-block", { timeout: 5000 });
            await page.waitForTimeout(500);

            const statBlock = page.locator("stat-block").first();

            await page.waitForTimeout(300);
            await expect(statBlock).toHaveScreenshot("stat-block-clickable-traits-desktop.png", {
                maxDiffPixelRatio: 0.05,
            });
        });
    });
});
