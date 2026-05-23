import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "../helpers/mock-api-key-status.js";
import { setupTestUser } from "../helpers/test-user.js";

test.describe("main page visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);
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
