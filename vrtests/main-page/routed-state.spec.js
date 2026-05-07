import { expect, test } from "playwright/test";

import { setupTestUser } from "../helpers/test-user.js";

test.describe("routed state visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("conversation URL state", async ({ page }) => {
        // Click on a conversation to navigate to its URL
        const sidebar = page.locator("chat-sidebar");
        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);

        // Verify URL contains /conversations/
        const url = page.url();
        expect(url).toContain("/conversations/");

        // Take full page snapshot
        await expect(page).toHaveScreenshot("main-page-conversation-url.png", {
            fullPage: true,
            maxDiffPixelRatio: 0.01,
        });
    });

    test("back navigation state", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");

        // Navigate to conv2, then conv1, then go back
        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForLoadState("networkidle");

        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);

        // Go back
        await page.goBack();
        await page.waitForTimeout(500);

        // Take screenshot of the back-navigated state
        await expect(page).toHaveScreenshot("main-page-back-navigation.png", {
            fullPage: true,
            maxDiffPixelRatio: 0.01,
        });
    });
});
