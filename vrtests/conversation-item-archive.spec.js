import { expect, test } from "playwright/test";

import { setupTestUser } from "./helpers/test-user.js";

test.describe("conversation item archive menu visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("conversation item with kebab menu visible on hover", async ({ page }) => {
        // Hover over the first conversation item
        const firstItem = page.locator("conversation-item").first();
        await firstItem.hover();
        await page.waitForTimeout(300);

        const item = firstItem.locator(".item");
        await expect(item).toHaveScreenshot("conversation-item-hover.png");
    });

    test("conversation item with archive option visible", async ({ page }) => {
        // The first conversation is active (auto-selected on load), so the kebab
        // is hidden for it. Use the second (non-active) item instead.
        const secondItem = page.locator("conversation-item").nth(1);

        // Hover to make the kebab button visible (opacity transitions from 0 to 1)
        await secondItem.hover();
        await page.waitForTimeout(300);

        // Click the kebab button to open the dropdown
        const kebab = secondItem.locator(".kebab");
        await kebab.click();
        await page.waitForTimeout(300);

        // Take screenshot of the item with dropdown open
        await expect(secondItem).toHaveScreenshot("conversation-item-archive-option.png");
    });
});
