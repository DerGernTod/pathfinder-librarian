import { expect, test } from "@playwright/test";

test.describe("persistence e2e tests", () => {
    test.beforeEach(async ({ page }) => {
        // Reset DB to clean seeded state before each test
        const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
        expect(res.ok).toBe(true);

        await page.goto("/");
        await page.waitForSelector("main-page");
        // Wait for API data to load (firstUpdated completes)
        await page.waitForSelector("chat-message", { timeout: 5000 });
    });

    test("conversations loaded from API on page load", async ({ page }) => {
        const messages = page.locator("chat-message");
        const count = await messages.count();
        expect(count).toBeGreaterThan(0);
        await expect(messages.first()).toContainText(/mitflit king/i);
    });

    test("switching conversations fetches from API", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");
        await sidebar.locator("conversation-item", { hasText: "Chandelier" }).click();
        await page.waitForTimeout(500);
        await expect(page.locator("chat-message").first()).toContainText(/chandelier/i);
    });

    test("submitted prompt persists across page reload", async ({ page }) => {
        const input = page.locator("chat-input textarea");
        await input.fill("Persistent test message");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1000);
        await expect(page.locator("chat-message").last()).toContainText("Persistent test message");

        // Reload — message must survive
        await page.reload();
        await page.waitForSelector("chat-message", { timeout: 5000 });
        await expect(page.locator("chat-message").last()).toContainText("Persistent test message");
    });

    test("new conversation persists across page reload", async ({ page }) => {
        // Click new chat button
        await page.locator("new-chat-button button").click();
        await page.waitForTimeout(1000);

        // Send a unique message to identify this conversation
        const input = page.locator("chat-input textarea");
        await input.fill("Unique marker for new conv");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1000);

        // Reload — conversation and message must survive
        await page.reload();
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
        await page.waitForTimeout(1000);

        await sidebar.locator("conversation-item", { hasText: "Chandelier" }).click();
        await page.waitForTimeout(500);

        // Verify message NOT in conv 2
        const conv2Messages = page.locator("chat-message");
        for (const msg of await conv2Messages.all()) {
            await expect(msg).not.toContainText("Conv 1 isolation test");
        }

        // Switch back — message IS in conv 1
        await sidebar.locator("conversation-item", { hasText: "Mitflit" }).click();
        await page.waitForTimeout(500);
        await expect(page.locator("chat-message").last()).toContainText("Conv 1 isolation test");
    });
});
