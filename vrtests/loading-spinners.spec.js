import { expect, test } from "playwright/test";

import { setupTestUser } from "./helpers/test-user.js";

test.describe("loading spinner visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);

        await page.route("**/api/auth/api-key-status", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    result: "success",
                    data: { available: true, reason: "ok" },
                }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("conversation item with loading spinner", async ({ page }) => {
        // Verify conversation items exist and have proper structure
        const items = page.locator("conversation-item");
        await expect(items).toHaveCount(2);
        const firstItem = items.first();
        await expect(firstItem).toHaveScreenshot("conversation-item-default.png");
    });

    test("collapsed sidebar with loading spinner", async ({ page }) => {
        // Collapse the sidebar
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("sidebar-collapsed.png");
    });

    test("chat view fading during load", async ({ page }) => {
        // First, ensure a conversation is loaded
        await page.locator("conversation-item").first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);

        // The fading class should NOT be applied after load completes
        const chatView = page.locator("chat-view");
        await expect(chatView).toHaveScreenshot("chat-view-loaded.png");
    });
});
