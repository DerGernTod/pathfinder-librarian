import { expect, test } from "@playwright/test";

test.describe("mock LLM response visual regression", () => {
    test.beforeEach(async ({ page, context }) => {
        // Reset DB and login
        const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
        expect(res.ok).toBe(true);

        const loginRes = await fetch("http://localhost:3000/api/auth/quick-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001" }),
        });
        expect(loginRes.ok).toBe(true);

        const setCookieHeader = loginRes.headers.get("set-cookie");
        if (setCookieHeader) {
            const cookieMatch = setCookieHeader.match(/session_token=([^;]+)/);
            if (cookieMatch) {
                await context.addCookies([
                    {
                        name: "session_token",
                        value: cookieMatch[1],
                        domain: "localhost",
                        path: "/",
                    },
                ]);
            }
        }

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("loading spinner while assistant responds", async ({ page }) => {
        const input = page.locator("chat-input textarea");
        await input.fill("What are the rules for grappling?");
        await page.keyboard.press("Enter");

        // Wait for spinner to be visible
        await expect(page.locator("message-list")).toBeVisible();
        const spinner = page.locator("sl-spinner");
        await expect(spinner).toBeVisible();

        // Snapshot loading state immediately
        const messageList = page.locator("message-list");
        await expect(messageList).toHaveScreenshot("message-list-responding.png");
    });

    test("assistant response rendered after submission", async ({ page }) => {
        const input = page.locator("chat-input textarea");
        await input.fill("How does flanking work?");
        await page.keyboard.press("Enter");

        // Wait for response
        await page.waitForSelector("assistant-message", { timeout: 5000 });
        await page.waitForTimeout(500);

        const chatArea = page.locator("main.main");
        await expect(chatArea).toHaveScreenshot("chat-area-with-response.png");
    });

    test("chat input disabled during response", async ({ page }) => {
        const input = page.locator("chat-input textarea");
        await input.fill("Test message");
        await page.keyboard.press("Enter");

        // Wait for spinner to indicate response started
        await expect(page.locator("sl-spinner")).toBeVisible();

        const chatInput = page.locator("chat-input");
        await expect(chatInput).toHaveScreenshot("chat-input-disabled.png");
    });

    test("chat input enabled after response", async ({ page }) => {
        const input = page.locator("chat-input textarea");
        await input.fill("Test message");
        await page.keyboard.press("Enter");

        // Wait for assistant response to complete
        await page.waitForSelector("assistant-message", { timeout: 5000 });
        await page.waitForTimeout(500);

        const chatInput = page.locator("chat-input");
        await expect(chatInput).toHaveScreenshot("chat-input-enabled.png");
    });
});
