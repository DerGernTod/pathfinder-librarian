import { expect, test } from "playwright/test";

test.describe("login page visual regression - desktop (1280x800)", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await page.route("**/api/auth/test-users", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ result: "success", data: [] }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("login-page");
        await page.waitForTimeout(300);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });
    });

    test("login page desktop", async ({ page }) => {
        await expect(page).toHaveScreenshot("login-page-desktop.png", {
            maxDiffPixelRatio: 0.01,
        });
    });
});

test.describe("login page visual regression - tablet (768x1024)", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        await page.route("**/api/auth/test-users", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ result: "success", data: [] }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("login-page");
        await page.waitForTimeout(300);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });
    });

    test("login page tablet", async ({ page }) => {
        await expect(page).toHaveScreenshot("login-page-tablet.png", {
            maxDiffPixelRatio: 0.01,
        });
    });
});

test.describe("login page visual regression - phone (375x812)", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.route("**/api/auth/test-users", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ result: "success", data: [] }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("login-page");
        await page.waitForTimeout(300);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });
    });

    test("login page phone", async ({ page }) => {
        await expect(page).toHaveScreenshot("login-page-phone.png", {
            maxDiffPixelRatio: 0.01,
        });
    });
});
