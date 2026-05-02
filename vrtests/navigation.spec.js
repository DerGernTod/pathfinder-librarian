import { expect, test } from "playwright/test";

test.describe("navigation e2e tests", () => {
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
        const initialMessageCount = await messageList.locator("chat-message").count();

        const sidebar = page.locator("chat-sidebar");
        await sidebar.locator("conversation-item", { hasText: "Chandelier Assassination" }).click();

        const newMessageCount = await messageList.locator("chat-message").count();
        expect(newMessageCount).toBeLessThan(initialMessageCount);

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

        const newCount = await messageList.locator("chat-message").count();
        expect(newCount).toBe(initialCount + 1);

        // messages reversed to autoscroll to bottom
        const firstMessage = messageList.locator("chat-message").first();
        await expect(firstMessage).toContainText("This is a test message");
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
