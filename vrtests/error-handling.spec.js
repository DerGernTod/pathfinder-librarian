import { expect, test } from "@playwright/test";

import { mockApiKeyStatusAvailable } from "./helpers/mock-api-key-status.js";
import { setupTestUser } from "./helpers/test-user.js";

test.describe("error handling visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);

        await page.route("**/api/conversations/*/messages", async (route) => {
            if (route.request().method() === "POST") {
                await route.fulfill({
                    status: 200,
                    contentType: "text/event-stream",
                    body:
                        JSON.stringify({
                            type: "error",
                            data: { message: "Something went wrong. Please try again." },
                        }) + "\n",
                });
            } else {
                await route.continue();
            }
        });

        await page.route("**/api/conversations/first-message", async (route) => {
            if (route.request().method() === "POST") {
                await route.fulfill({
                    status: 200,
                    contentType: "text/event-stream",
                    body:
                        JSON.stringify({
                            type: "error",
                            data: { message: "Something went wrong. Please try again." },
                        }) + "\n",
                });
            } else {
                await route.continue();
            }
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("error callout displayed when SSE error received", async ({ page }) => {
        const input = page.locator("chat-input textarea");
        await input.fill("Test error message");
        await page.keyboard.press("Enter");

        const errorCallout = page.locator('[role="alert"]');
        await expect(errorCallout).toBeVisible({ timeout: 5000 });
        await expect(errorCallout).toContainText("Something went wrong");

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        await expect(errorCallout).toHaveScreenshot("error-callout.png");

        await expect(page.locator("message-list")).toHaveScreenshot("message-list-with-error.png");
    });
});
