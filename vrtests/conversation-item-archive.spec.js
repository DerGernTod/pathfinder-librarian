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
        const firstItem = page.locator("conversation-item").first();
        await firstItem.hover();
        await page.waitForTimeout(300);

        const item = firstItem.locator(".item");
        await expect(item).toHaveScreenshot("conversation-item-hover.png");
    });

    test("kebab menu opens on click for active conversation", async ({ page }) => {
        const firstItem = page.locator("conversation-item").first();

        await firstItem.hover();
        await page.waitForTimeout(300);

        const kebab = firstItem.locator(".kebab");
        await kebab.click();
        await page.waitForTimeout(300);

        const menu = firstItem.locator(".menu");
        await expect(menu).toBeVisible();
        await expect(menu).toHaveScreenshot("conversation-item-active-dropdown-open.png");
    });

    test("archive option visible in dropdown", async ({ page }) => {
        const firstItem = page.locator("conversation-item").first();

        await firstItem.hover();
        await page.waitForTimeout(300);

        const kebab = firstItem.locator(".kebab");
        await kebab.click();
        await page.waitForTimeout(300);

        await expect(firstItem).toHaveScreenshot("conversation-item-archive-option.png");
    });
});
