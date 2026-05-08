import { expect, test } from "playwright/test";

import { setupTestUser } from "../helpers/test-user.js";

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
