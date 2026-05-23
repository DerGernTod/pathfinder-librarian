import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "../helpers/mock-api-key-status.js";
import { setupTestUser } from "../helpers/test-user.js";

test.describe("player redacted stat block visual regression", () => {
    test.beforeEach(async ({ page }) => {
        await mockApiKeyStatusAvailable(page);

        // Mock conversations list with one conversation
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
                                title: "Player Redacted Test",
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

        // Mock stat block data for player mode (redacted) and gm mode (full)
        const playerRedactedBlock = {
            type: "stat-block",
            title: "Orc Warrior",
            redacted: true,
            data: {
                name: "Orc Warrior",
                type: "Humanoid",
                rarity: "common",
                traits: ["Orc", "Humanoid"],
                size: "med",
                blurb: "A fierce tribal warrior",
                traitRefs: [
                    { name: "Orc", ruleItemId: "id-orc" },
                    { name: "Humanoid", ruleItemId: "id-humanoid" },
                ],
                redacted: true,
            },
        };

        const gmFullBlock = {
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
                size: "med",
                blurb: "A fierce tribal warrior",
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
            },
        };

        await page.route("**/api/conversations/*/messages*", async (route) => {
            if (route.request().method() === "POST") {
                const body = route.request().postDataJSON();
                const content = body.content || "";
                const now = new Date().toISOString();
                const mode = body.mode || "gm";

                const block = mode === "player" ? playerRedactedBlock : gmFullBlock;

                const userMessage = {
                    type: "userMessage",
                    data: {
                        id: "um-1",
                        conversationId: "conv-1",
                        role: "user",
                        content,
                        mode,
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
                        mode,
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

    test("player mode redacted stat block phone viewport", async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo, "player");
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        // Disable animations for stable screenshots
        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Tell me about the orc");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("player-redacted-stat-block-phone.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("player mode redacted stat block tablet viewport", async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo, "player");
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
        await input.fill("Tell me about the orc");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("player-redacted-stat-block-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("player mode redacted stat block desktop viewport", async ({
        page,
        context,
    }, testInfo) => {
        await setupTestUser(context, testInfo, "player");
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
        await input.fill("Tell me about the orc");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        await expect(statBlock).toHaveScreenshot("player-redacted-stat-block-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("GM mode full stat block (regression)", async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Show me the full orc stats");
        await input.press("Enter");
        await page.waitForSelector("stat-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        const statBlock = page.locator("stat-block").first();
        const details = statBlock.locator("sl-details");
        await details.first().click();
        await expect(details.first()).toHaveAttribute("open", "");

        await page.waitForTimeout(300);
        // Verify the full stat block still renders with primary stats
        const primaryStats = statBlock.locator(".primary-stats");
        expect(await primaryStats.count()).toBe(1);

        await expect(statBlock).toHaveScreenshot("gm-full-stat-block-regression.png", {
            maxDiffPixelRatio: 0.05,
        });
    });
});
