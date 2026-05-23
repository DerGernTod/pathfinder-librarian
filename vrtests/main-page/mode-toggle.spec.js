import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "../helpers/mock-api-key-status.js";
import { setupTestUser } from "../helpers/test-user.js";

test.describe("mode toggle visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);
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
