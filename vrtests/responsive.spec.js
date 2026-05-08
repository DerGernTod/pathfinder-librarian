import { expect, test } from "playwright/test";

import { setupTestUser } from "./helpers/test-user.js";

test.describe("responsive design", () => {
    test.describe("phone viewport (375x812)", () => {
        test.beforeEach(async ({ page, context }, testInfo) => {
            await setupTestUser(context, testInfo);
            await page.setViewportSize({ width: 375, height: 812 });
            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);
        });

        test("full page layout", async ({ page }) => {
            await expect(page).toHaveScreenshot("responsive-phone-full-page.png", {
                fullPage: true,
                maxDiffPixelRatio: 0.05,
            });
        });

        test("sidebar opens as overlay", async ({ page }) => {
            await page.locator("chat-header .hamburger-btn").click();
            await page.waitForTimeout(500);
            await expect(page).toHaveScreenshot("responsive-phone-sidebar-open.png", {
                maxDiffPixelRatio: 0.05,
            });
        });

        test("chat area fills width", async ({ page }) => {
            const chatArea = page.locator("main.main");
            await expect(chatArea).toHaveScreenshot("responsive-phone-chat-area.png");
        });
    });

    test.describe("tablet viewport (768x1024)", () => {
        test.beforeEach(async ({ page, context }, testInfo) => {
            await setupTestUser(context, testInfo);
            await page.setViewportSize({ width: 768, height: 1024 });
            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);
        });

        test("full page layout", async ({ page }) => {
            await expect(page).toHaveScreenshot("responsive-tablet-full-page.png", {
                fullPage: true,
                maxDiffPixelRatio: 0.05,
            });
        });

        test("sidebar auto-collapsed to icons", async ({ page }) => {
            const sidebar = page.locator("chat-sidebar");
            await expect(sidebar).toHaveScreenshot("responsive-tablet-sidebar-collapsed.png");
        });

        test("chat area", async ({ page }) => {
            const chatArea = page.locator("main.main");
            await expect(chatArea).toHaveScreenshot("responsive-tablet-chat-area.png");
        });
    });

    test.describe("desktop viewport (1280x800)", () => {
        test.beforeEach(async ({ page, context }, testInfo) => {
            await setupTestUser(context, testInfo);
            await page.setViewportSize({ width: 1280, height: 800 });
            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);
        });

        test("full page layout", async ({ page }) => {
            await expect(page).toHaveScreenshot("responsive-desktop-full-page.png", {
                fullPage: true,
                maxDiffPixelRatio: 0.01,
            });
        });

        test("sidebar expanded by default", async ({ page }) => {
            const sidebar = page.locator("chat-sidebar");
            await expect(sidebar).toHaveScreenshot("responsive-desktop-sidebar-expanded.png");
        });

        test("chat area", async ({ page }) => {
            const chatArea = page.locator("main.main");
            await expect(chatArea).toHaveScreenshot("responsive-desktop-chat-area.png");
        });
    });
});
