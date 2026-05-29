import { expect, test } from "playwright/test";

import { setupTestUser } from "../helpers/test-user.js";

test.describe("api key indicator visual regression", () => {
    test.beforeEach(async ({ page: _page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
    });

    test("warning visible — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await page.route("**/api/auth/api-key-status", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    result: "success",
                    data: { available: false, reason: "not_set" },
                }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);

        const warningIcon = page.locator("chat-input .api-warning-icon");
        await expect(warningIcon).toBeVisible({ timeout: 5000 });

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("api-key-warning-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("warning visible — tablet", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        await page.route("**/api/auth/api-key-status", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    result: "success",
                    data: { available: false, reason: "not_set" },
                }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);

        const warningIcon = page.locator("chat-input .api-warning-icon");
        await expect(warningIcon).toBeVisible({ timeout: 5000 });

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("api-key-warning-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("warning visible — phone", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.route("**/api/auth/api-key-status", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    result: "success",
                    data: { available: false, reason: "not_set" },
                }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);

        const warningIcon = page.locator("chat-input .api-warning-icon");
        await expect(warningIcon).toBeVisible({ timeout: 5000 });

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("api-key-warning-phone.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("no warning when available — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

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
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);

        const warningIcon = page.locator("chat-input .api-warning-icon");
        await expect(warningIcon).toHaveCount(0);
    });

    test("empty key warning — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await page.route("**/api/auth/api-key-status", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    result: "success",
                    data: { available: false, reason: "empty" },
                }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);

        const warningIcon = page.locator("chat-input .api-warning-icon");
        await expect(warningIcon).toBeVisible({ timeout: 5000 });

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("api-key-empty-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("tooltip has correct content — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await page.route("**/api/auth/api-key-status", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    result: "success",
                    data: { available: false, reason: "not_set" },
                }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);

        const warningIcon = page.locator("chat-input .api-warning-icon");
        await expect(warningIcon).toBeVisible({ timeout: 5000 });

        const tooltip = page.locator("chat-input sl-tooltip[placement='top']");
        await expect(tooltip).toHaveAttribute("content", "API key not configured");
    });
});
