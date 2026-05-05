import { expect, test } from "playwright/test";

import { setupTestUser } from "./helpers/test-user.js";

test.describe("settings dialog visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("settings dialog opens from profile menu", async ({ page }) => {
        // Click the avatar button in sidebar-profile to open the dropdown menu
        await page.locator("sidebar-profile button.avatar").click();
        await page.waitForTimeout(300);

        // Click the Settings menu item
        await page.locator('sl-menu-item:has-text("Settings")').click();
        await page.waitForTimeout(500);

        // Verify the settings dialog is visible
        const dialog = page.locator("sl-dialog[open]");
        await expect(dialog).toBeVisible();

        const panel = dialog.locator('[part="panel"]');
        await expect(panel).toHaveScreenshot("settings-dialog-open.png");
    });

    test("settings dialog closes on esc key", async ({ page }) => {
        // Open the settings dialog via profile menu
        await page.locator("sidebar-profile button.avatar").click();
        await page.waitForTimeout(300);
        await page.locator('sl-menu-item:has-text("Settings")').click();
        await page.waitForTimeout(500);

        const dialog = page.locator("sl-dialog[open]");
        await expect(dialog).toBeVisible();

        // Close with Escape key
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);

        // Verify dialog is no longer open
        await expect(page.locator("sl-dialog[open]")).not.toBeAttached();
    });

    test("settings dialog opens and closes via profile menu repeatedly", async ({ page }) => {
        // Open settings
        await page.locator("sidebar-profile button.avatar").click();
        await page.waitForTimeout(300);
        await page.locator('sl-menu-item:has-text("Settings")').click();
        await page.waitForTimeout(500);
        await expect(page.locator("sl-dialog[open]")).toBeVisible();

        // Close with Escape
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        await expect(page.locator("sl-dialog[open]")).not.toBeAttached();

        // Open again — verifies the context state resets correctly
        await page.locator("sidebar-profile button.avatar").click();
        await page.waitForTimeout(300);
        await page.locator('sl-menu-item:has-text("Settings")').click();
        await page.waitForTimeout(500);
        await expect(page.locator("sl-dialog[open]")).toBeVisible();
    });
});
