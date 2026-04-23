import { expect, test } from "playwright/test";

test.describe("main page visual regression", () => {
    test.beforeEach(async ({ page }) => {
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
        await expect(sidebar).toHaveScreenshot("sidebar.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("chat area matches baseline", async ({ page }) => {
        const chatArea = page.locator("main.main");
        await expect(chatArea).toHaveScreenshot("chat-area.png", {
            maxDiffPixelRatio: 0.01,
        });
    });
});

test.describe("mode toggle visual regression", () => {
    test("player mode header", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("header-player-mode.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("gm mode header", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("header-gm-mode.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("player mode sidebar profile", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-player.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("gm mode sidebar profile", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-gm.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("player mode chat input", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);
        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("chat-input-player.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("gm mode chat input", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("chat-input-gm.png", {
            maxDiffPixelRatio: 0.01,
        });
    });
});
