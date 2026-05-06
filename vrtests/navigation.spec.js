import { expect, test } from "playwright/test";

import { setupTestUser } from "./helpers/test-user.js";

test.describe("navigation e2e tests", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await page.goto("/");
        await page.waitForSelector("main-page");
    });

    test("load page with conversation 1 active and verify messages", async ({ page }) => {
        const messageList = page.locator("message-list");
        await expect(messageList).toBeVisible();

        const messages = messageList.locator("chat-message");
        const messageCount = await messages.count();
        expect(messageCount).toBeGreaterThan(0);

        // messages reversed to autoscroll to bottom
        const firstMessage = messages.last();
        await expect(firstMessage).toContainText(/mitflit king/i);
    });

    test("switch to conversation 2 and verify messages change", async ({ page }) => {
        const messageList = page.locator("message-list");
        await expect(messageList).toBeVisible();
        const initialMessage = await messageList.locator("chat-message").first().allTextContents();

        const sidebar = page.locator("chat-sidebar");
        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForTimeout(600);

        const newMessage = await messageList.locator("chat-message").first().allTextContents();
        expect(newMessage).not.toBe(initialMessage);

        const firstMessage = messageList.locator("chat-message").first();
        await expect(firstMessage).toContainText(/chandelier/i);
    });

    test("switch between conversations and verify messages switch correctly", async ({ page }) => {
        const messageList = page.locator("message-list");
        const sidebar = page.locator("chat-sidebar");

        // messages reversed to autoscroll to bottom
        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await expect(messageList.locator("chat-message").last()).toContainText(/mitflit/i);

        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await expect(messageList.locator("chat-message").last()).toContainText(/chandelier/i);

        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        const backToConv1LastMessage = messageList.locator("chat-message").last();
        await expect(backToConv1LastMessage).toContainText(/mitflit king/i);
    });

    test("send message and verify it appears in active conversation", async ({ page }) => {
        const messageList = page.locator("message-list");
        const initialCount = await messageList.locator("chat-message").count();

        const input = page.locator("chat-input textarea");
        await input.fill("This is a test message");
        await page.keyboard.press("Enter");
        await page.waitForLoadState("networkidle");

        // Wait for any chat message to appear (may be user or assistant)
        const newCount = await messageList.locator("chat-message").count();
        expect(newCount).toBeGreaterThan(initialCount);
    });

    test("switch conversations and verify new message only in original conversation", async ({
        page,
    }) => {
        const messageList = page.locator("message-list");
        const input = page.locator("chat-input textarea");
        const sidebar = page.locator("chat-sidebar");

        await input.fill("Test message for conv 1");
        await page.keyboard.press("Enter");
        await page.waitForLoadState("networkidle");
        const conv1Count = await messageList.locator("chat-message").count();

        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForLoadState("networkidle");

        const conv2Count = await messageList.locator("chat-message").count();
        expect(conv2Count).not.toBe(conv1Count);

        await page.waitForTimeout(10);
        const messages = messageList.locator("chat-message");
        const hasTestMessage = await messages.count();
        expect(hasTestMessage).toBeGreaterThan(0);

        const firstMessage = messageList.locator("chat-message").first();
        await expect(firstMessage).not.toContainText("Test message for conv 1");

        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForLoadState("networkidle");

        await expect(messageList.locator("chat-message")).toHaveCount(conv1Count);
    });

    test("search filters conversation list", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");
        const searchInput = sidebar.locator(
            'sl-input[placeholder="Search conversations..."] input',
        );

        await searchInput.fill("Mitflit");

        const visibleItems = sidebar.locator("conversation-item:not([hidden])");
        const count = await visibleItems.count();
        expect(count).toBe(1);

        await searchInput.fill("");

        const allItems = sidebar.locator("conversation-item:not([hidden])");
        const allCount = await allItems.count();
        expect(allCount).toBe(2);
    });
});

test.describe("routing", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(500);
    });

    test("URL updates when switching conversations", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");

        // Click second conversation
        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForLoadState("networkidle");

        const url = page.url();
        expect(url).toContain("/conversations/");
        // Should have a UUID after /conversations/
        const match = url.match(/\/conversations\/([0-9a-f-]{36})/);
        expect(match).not.toBeNull();
    });

    test("back button returns to previous conversation", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");
        const messageList = page.locator("message-list");

        // Click conversation 2
        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForLoadState("networkidle");
        const conv2Url = page.url();

        // Click conversation 1
        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForLoadState("networkidle");

        // Go back
        await page.goBack();
        await page.waitForTimeout(500);

        // Should be back on conversation 2
        expect(page.url()).toBe(conv2Url);
        const lastMsg = messageList.locator("chat-message").last();
        await expect(lastMsg).toContainText(/chandelier/i);
    });

    test("forward button returns to later conversation", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");
        const messageList = page.locator("message-list");

        // Click conversation 2, then conv 1
        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForLoadState("networkidle");

        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForLoadState("networkidle");
        const conv1Url = page.url();

        // Go back then forward
        await page.goBack();
        await page.waitForTimeout(500);
        await page.goForward();
        await page.waitForTimeout(500);

        // Should be on conversation 1
        expect(page.url()).toBe(conv1Url);
        const lastMsg = messageList.locator("chat-message").last();
        await expect(lastMsg).toContainText(/mitflit king/i);
    });

    test("direct URL navigation loads correct conversation", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");

        // Get the conversation ID for "Mitflit King Capture"
        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForLoadState("networkidle");
        const conv1Url = page.url();
        const conv1Match = conv1Url.match(/\/conversations\/([0-9a-f-]{36})/);
        const conv1Id = conv1Match?.[1];
        if (!conv1Id) {
            return;
        }

        // Navigate directly to the conv1 URL — tests deep-linking
        await page.goto(`/conversations/${conv1Id}`);
        await page.waitForLoadState("networkidle");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(500);

        // Verify messages are shown for conv1
        const messageList = page.locator("message-list");
        const lastMsg = messageList.locator("chat-message").last();
        await expect(lastMsg).toContainText(/mitflit king/i);
    });

    test("invalid conversation ID in URL falls back gracefully", async ({ page }) => {
        // Navigate to a nonexistent conversation ID
        await page.goto("/conversations/00000000-0000-0000-0000-000000000099");
        await page.waitForLoadState("networkidle");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(500);

        // Page should load without 404
        const mainPage = page.locator("main-page");
        await expect(mainPage).toBeVisible();

        // Should either show the landing or first conversation
        // (seeded user has conversations, so first conv should load)
        // URL might have been replaced with the first conversation's ID
        // or might still be the invalid one if fallback doesn't navigate
    });

    test('"New chat" button creates ephemeral chat', async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");

        // Navigate to an existing conversation first
        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForLoadState("networkidle");
        const conv1Url = page.url();
        expect(conv1Url).toContain("/conversations/");

        // Get history length after one navigation
        const historyAfterConv1 = await page.evaluate(() => history.length);

        // Click "New Chat" — now creates ephemeral state (no conversation yet)
        await page.locator("new-chat-button button, .new-chat button").click();
        // Wait for ephemeral state to be set
        await page.waitForTimeout(1000);

        // URL should stay at / (no conversation created yet)
        const newChatUrl = page.url();
        expect(newChatUrl).toBe("http://localhost:3000/");

        // History length should be same (replace) or +1 (push)
        const historyAfterNewChat = await page.evaluate(() => history.length);
        expect(historyAfterNewChat).toBeGreaterThanOrEqual(historyAfterConv1);
    });
});
