import { expect, test } from "playwright/test";

import { setupTestUser } from "./helpers/test-user.js";

test.describe("main page visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("full page matches baseline", async ({ page }) => {
        await expect(page).toHaveScreenshot("main-page.png", {
            fullPage: true,
            maxDiffPixelRatio: 0.01,
        });
    });

    test("sidebar matches baseline", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("sidebar.png");
    });

    test("chat area matches baseline", async ({ page }) => {
        const chatArea = page.locator("main.main");
        await expect(chatArea).toHaveScreenshot("chat-area.png");
    });
});

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
                traits: ["Orc", "Humanoid"],
                perception: "+7",
                languages: "Common, Orcish",
                attributes: { ac: 15, hp: 23, fortitude: "+9", reflex: "+8", will: "+6" },
                skills: { Athletics: "+12", Intimidation: "+8" },
                str: 18,
                dex: 14,
                con: 14,
                int: 8,
                wis: 8,
                cha: 10,
                actions: [
                    {
                        name: "Greataxe Strike",
                        actionType: "single",
                        description: "+9, 1d12+4 slashing",
                    },
                    {
                        name: "Ferocity",
                        actionType: "reaction",
                        description:
                            "When reduced to 0 HP, make a Strike before going unconscious.",
                    },
                ],
                spells: [
                    {
                        name: "Darkness",
                        tradition: "divine",
                        rank: 2,
                        dc: 14,
                        description: "20-ft burst of magical darkness.",
                    },
                ],
                abilities: [
                    {
                        name: "Pack Hunter",
                        description: "Deals extra 1d4 damage to flanked creatures.",
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
                perception: "+4",
                languages: "Common, Goblin",
                attributes: { ac: 12, hp: 6, fortitude: "+3", reflex: "+5", will: "+2" },
                skills: { Stealth: "+5", Acrobatics: "+5" },
                str: 10,
                dex: 14,
                con: 10,
                int: 8,
                wis: 8,
                cha: 10,
                actions: [
                    { name: "Shortsword", actionType: "single", description: "+5, 1d6 piercing" },
                    {
                        name: "Shortbow",
                        actionType: "single",
                        description: "+5, 1d6 piercing, range 60 ft.",
                    },
                ],
                abilities: [
                    {
                        name: "Sneak",
                        description: "Deals extra 1d6 damage to flat-footed targets.",
                    },
                ],
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

    test("stat block responsive layout", async ({ page }) => {
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

        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(300);

        await expect(statBlock).toHaveScreenshot("stat-block-mobile.png", {
            maxDiffPixelRatio: 0.05,
        });

        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(300);

        await expect(statBlock).toHaveScreenshot("stat-block-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(300);
    });
});

test.describe("mode toggle visual regression", () => {
    test.beforeEach(async ({ page: _page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
    });

    test("player mode header", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("header-player-mode.png");
    });

    test("gm mode header", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("header-gm-mode.png");
    });

    test("player mode sidebar profile", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-player.png");
    });

    test("gm mode sidebar profile", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-gm.png");
    });

    test("player mode chat input", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);
        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("chat-input-player.png");
    });

    test("gm mode chat input", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("chat-input-gm.png");
    });
});

test.describe("sidebar toggle visual regression", () => {
    test.beforeEach(async ({ page: _page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
    });

    test("sidebar expanded state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("sidebar-expanded.png");
    });

    test("sidebar collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("sidebar-collapsed.png");
    });

    test("toggle button expanded state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("sidebar-toggle");
        await page.waitForTimeout(1000);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("toggle-expanded.png");
    });

    test("toggle button collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("sidebar-toggle");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("toggle-collapsed.png");
    });

    test("new chat button expanded state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("new-chat-button");
        await page.waitForTimeout(1000);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("new-chat-expanded.png");
    });

    test("new chat button collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("new-chat-button");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("new-chat-collapsed.png");
    });

    test("conversation menu dropdown trigger", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("conversation-menu-trigger.png");
    });

    test("conversation menu with active conversation highlighted", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        await page.locator("conversation-menu button.menu-trigger").click();
        await page.waitForTimeout(500);
        const dropdown = page.locator("conversation-menu sl-dropdown");
        await expect(dropdown).toHaveScreenshot("conversation-menu-active.png");
    });

    test("sidebar-profile collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-collapsed.png");
    });
});
