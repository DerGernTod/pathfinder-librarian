import { expect, test } from "playwright/test";

test.describe("navigation e2e tests", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("load page with conversation 1 active and verify messages", async ({ page }) => {
        const messageList = page.locator("message-list");
        await expect(messageList).toBeVisible();

        const messages = messageList.locator("chat-message");
        const messageCount = await messages.count();
        expect(messageCount).toBeGreaterThan(0);

        const firstMessage = messages.first();
        await expect(firstMessage).toContainText(/mitflit king/i);
    });

    test("switch to conversation 2 and verify messages change", async ({ page }) => {
        const messageList = page.locator("message-list");
        const initialMessageCount = await messageList.locator("chat-message").count();

        const sidebar = page.locator("chat-sidebar");
        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForTimeout(500);

        const newMessageCount = await messageList.locator("chat-message").count();
        expect(newMessageCount).toBeLessThan(initialMessageCount);

        const firstMessage = messageList.locator("chat-message").first();
        await expect(firstMessage).toContainText(/chandelier/i);
    });

    test("switch to conversation 3 and verify messages change", async ({ page }) => {
        const messageList = page.locator("message-list");
        const initialMessageCount = await messageList.locator("chat-message").count();

        const sidebar = page.locator("chat-sidebar");
        await sidebar.locator("conversation-item", { hasText: "Buying rare reagents" }).click();
        await page.waitForTimeout(500);

        const newMessageCount = await messageList.locator("chat-message").count();
        expect(newMessageCount).toBeLessThan(initialMessageCount);

        const firstMessage = messageList.locator("chat-message").first();
        await expect(firstMessage).toContainText(/dragon/i);
    });

    test("switch between conversations and verify messages switch correctly", async ({ page }) => {
        const messageList = page.locator("message-list");
        const sidebar = page.locator("chat-sidebar");

        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForTimeout(500);
        const conv1FirstMessageText = await messageList.locator("chat-message").first().textContent();

        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForTimeout(500);
        const conv2FirstMessageText = await messageList.locator("chat-message").first().textContent();

        await sidebar.locator("conversation-item", { hasText: "Buying rare reagents" }).click();
        await page.waitForTimeout(500);
        const conv3FirstMessageText = await messageList.locator("chat-message").first().textContent();

        expect(conv1FirstMessageText).not.toEqual(conv2FirstMessageText);
        expect(conv2FirstMessageText).not.toEqual(conv3FirstMessageText);
        expect(conv1FirstMessageText).not.toEqual(conv3FirstMessageText);

        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForTimeout(500);
        const backToConv1FirstMessage = messageList.locator("chat-message").first();
        await expect(backToConv1FirstMessage).toContainText(/mitflit king/i);
    });

    test("send message and verify it appears in active conversation", async ({ page }) => {
        const messageList = page.locator("message-list");
        const initialCount = await messageList.locator("chat-message").count();

        const input = page.locator("chat-input textarea");
        await input.fill("This is a test message");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1000);

        const newCount = await messageList.locator("chat-message").count();
        expect(newCount).toBe(initialCount + 1);

        const lastMessage = messageList.locator("chat-message").last();
        await expect(lastMessage).toContainText("This is a test message");
    });

    test("switch conversations and verify new message only in original conversation", async ({
        page,
    }) => {
        const messageList = page.locator("message-list");
        const input = page.locator("chat-input textarea");
        const sidebar = page.locator("chat-sidebar");

        await input.fill("Test message for conv 1");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1000);

        const conv1Count = await messageList.locator("chat-message").count();

        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();
        await page.waitForTimeout(500);

        const conv2Count = await messageList.locator("chat-message").count();
        expect(conv2Count).not.toBe(conv1Count);

        const messages = messageList.locator("chat-message");
        const hasTestMessage = await messages.count();
        expect(hasTestMessage).toBeGreaterThan(0);

        const lastMessage = messageList.locator("chat-message").last();
        await expect(lastMessage).not.toContainText("Test message for conv 1");

        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForTimeout(500);

        const backToConv1Count = await messageList.locator("chat-message").count();
        expect(backToConv1Count).toBe(conv1Count);
    });

    test("search filters conversation list", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");
        const searchInput = sidebar.locator(
            'sl-input[placeholder="Search conversations..."] input',
        );

        await searchInput.fill("Mitflit");
        await page.waitForTimeout(300);

        const visibleItems = sidebar.locator("conversation-item:not([hidden])");
        const count = await visibleItems.count();
        expect(count).toBe(1);

        await searchInput.fill("");
        await page.waitForTimeout(300);

        const allItems = sidebar.locator("conversation-item:not([hidden])");
        const allCount = await allItems.count();
        expect(allCount).toBe(3);
    });
});
