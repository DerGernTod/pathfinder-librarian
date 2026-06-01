import { expect, test } from "@playwright/test";

import { mockApiKeyStatusAvailable } from "./helpers/mock-api-key-status.js";
import { setupTestUser } from "./helpers/test-user.js";

test.describe("message list scrolling", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("long conversation is scrollable and last message is visible", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");
        await sidebar.locator("conversation-item", { hasText: "Mitflit King Capture" }).click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);

        const messageList = page.locator("message-list");

        const isScrollable = await messageList.evaluate((el) => {
            return el.scrollHeight > el.clientHeight;
        });
        expect(isScrollable).toBe(true);

        const messages = messageList.locator("chat-message");
        const count = await messages.count();
        expect(count).toBeGreaterThan(0);

        const lastMessage = messages.nth(count - 1);
        await expect(lastMessage).toBeInViewport();

        const firstMessage = messages.nth(0);
        await expect(firstMessage).not.toBeInViewport();

        await firstMessage.scrollIntoViewIfNeeded();
        await expect(firstMessage).toBeInViewport();
    });
});
