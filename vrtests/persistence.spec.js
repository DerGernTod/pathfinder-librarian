import { expect, test } from "@playwright/test";

test.describe("persistence e2e tests", () => {
    test.beforeEach(async ({ page, context }) => {
        // Reset DB to clean seeded state before each test
        const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
        expect(res.ok).toBe(true);

        // Quick-login as default seed user
        const loginRes = await fetch("http://localhost:3000/api/auth/quick-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001" }),
        });
        expect(loginRes.ok).toBe(true);

        // Set the session cookie on the page context
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
        // Wait for API data to load (firstUpdated completes)
        await page.waitForSelector("chat-message", { timeout: 5000 });
    });

    test("conversations loaded from API on page load", async ({ page }) => {
        const messages = page.locator("chat-message");
        const count = await messages.count();
        expect(count).toBeGreaterThan(0);
        // messages reversed to autoscroll to bottom
        await expect(messages.last()).toContainText(/mitflit king/i);
    });

    test("switching conversations fetches from API", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");
        await sidebar.locator("conversation-item", { hasText: "Chandelier" }).click();
        await page.waitForLoadState("networkidle");
        await expect(page.locator("chat-message").first()).toContainText(/chandelier/i);
    });

    test("submitted prompt and response persist across page reload", async ({ page }) => {
        const input = page.locator("chat-input textarea");
        await input.fill("Persistent test message");
        await page.keyboard.press("Enter");

        // Wait for assistant response
        await page.waitForSelector("assistant-message", { timeout: 5000 });
        await page.waitForLoadState("networkidle");

        // messages reversed to autoscroll to bottom
        await expect(page.locator("chat-message").nth(1)).toContainText("Persistent test message");

        // Reload — both messages must survive
        await page.reload();
        await page.waitForSelector("chat-message", { timeout: 5000 });
        await expect(page.locator("chat-message").nth(1)).toContainText("Persistent test message");

        // Verify assistant message also present
        const assistantMessages = page.locator("assistant-message");
        await expect(assistantMessages).toHaveCount(4); // 3 seeded + 1 new
    });

    test("new conversation persists across page reload", async ({ page }) => {
        // Click new chat button
        await page.locator("new-chat-button button").click();

        // Send a unique message to identify this conversation
        const input = page.locator('[data-test="landing-input"]');
        await input.fill("Unique marker for new conv");
        await page.keyboard.press("Enter");
        await page.waitForLoadState("networkidle");

        // Reload — conversation and message must survive
        await page.reload();
        await page.waitForLoadState("networkidle");
        await page.waitForSelector("chat-message", { timeout: 5000 });
        await expect(page.locator("chat-message").last()).toContainText(
            "Unique marker for new conv",
        );
    });

    test("messages isolated per conversation", async ({ page }) => {
        const input = page.locator("chat-input textarea");
        const sidebar = page.locator("chat-sidebar");

        await input.fill("Conv 1 isolation test");
        await page.keyboard.press("Enter");
        await page.waitForLoadState("networkidle");

        await sidebar.locator("conversation-item", { hasText: "Chandelier" }).click();
        await page.waitForLoadState("networkidle");

        // Verify message NOT in conv 2
        const conv2Messages = page.locator("chat-message");
        for (const msg of await conv2Messages.all()) {
            await expect(msg).not.toContainText("Conv 1 isolation test");
        }

        // Switch back — message IS in conv 1
        await sidebar.locator("conversation-item", { hasText: "Mitflit" }).click();
        await page.waitForLoadState("networkidle");
        // messages reversed to autoscroll to bottom, message 0 is assistant response, message 1 is user prompt
        await expect(page.locator("chat-message").nth(1)).toContainText("Conv 1 isolation test");
    });
});
