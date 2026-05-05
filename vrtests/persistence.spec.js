import { expect, test } from "@playwright/test";

import { setupTestUser } from "./helpers/test-user.js";

test.describe("persistence e2e tests", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
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
        await page.waitForSelector("assistant-message", { timeout: 10000 });
        await page.waitForLoadState("networkidle");

        // messages reversed to autoscroll to bottom
        await expect(page.locator("chat-message").nth(1)).toContainText("Persistent test message");

        // Reload — both messages must survive
        const assistantCount = await page.locator("assistant-message").count();
        await page.reload();
        await page.waitForLoadState("networkidle");
        await page.waitForSelector("chat-message", { timeout: 10000 });
        await expect(page.locator("chat-message").nth(1)).toContainText("Persistent test message");

        // Verify assistant messages still present after reload
        const newAssistantCount = await page.locator("assistant-message").count();
        expect(newAssistantCount).toBe(assistantCount);
    });

    test("new conversation persists across page reload", async ({ page }) => {
        // Click new chat button
        await page.locator("new-chat-button button").click();
        // Wait for landing view to render
        await page.waitForSelector("landing-view", { timeout: 5000 });
        await page.waitForTimeout(500);

        // Send a unique message to identify this conversation
        const input = page.locator('[data-test="landing-input"]');
        await expect(input).toBeVisible({ timeout: 5000 });
        await input.fill("Unique marker for new conv");
        await page.keyboard.press("Enter");
        await page.waitForLoadState("networkidle");

        // Verify message appears before reload
        await expect(page.locator("chat-message").last()).toContainText(
            "Unique marker for new conv",
        );

        // Reload — conversation and message must survive
        await page.reload();
        await page.waitForLoadState("networkidle");
        await page.waitForSelector("chat-message", { timeout: 10000 });

        // Verify the unique message survives reload
        const messages = page.locator("chat-message");
        await expect(messages.last()).toContainText("Unique marker for new conv");
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
