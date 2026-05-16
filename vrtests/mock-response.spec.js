import { expect, test } from "@playwright/test";

import { setupTestUser } from "./helpers/test-user.js";

test.describe("mock LLM response visual regression", () => {
    let pinnedUserId = "";

    test.beforeEach(async ({ page, context }, testInfo) => {
        const { userId } = await setupTestUser(context, testInfo);
        pinnedUserId = userId;

        // Pin mock response index 0 (saving throws) for this specific user so the
        // visual regression snapshot is deterministic even when workers run in parallel.
        await fetch("http://localhost:3000/api/test/set-mock-response", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, index: 0 }),
        });

        // Intercept conversation message POSTs to simulate network latency so
        // the UI enters the responding state reliably for visual tests.
        await page.route("**/api/conversations/*/messages", async (route) => {
            if (route.request().method() === "POST") {
                // artificial delay
                await new Promise((r) => setTimeout(r, 800));
            }
            await route.continue();
        });
        // Also intercept first-message endpoint
        await page.route("**/api/conversations/first-message", async (route) => {
            if (route.request().method() === "POST") {
                await new Promise((r) => setTimeout(r, 800));
            }
            await route.continue();
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test.afterEach(async () => {
        if (pinnedUserId) {
            await fetch("http://localhost:3000/api/test/set-mock-response", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: pinnedUserId, index: null }),
            });
            pinnedUserId = "";
        }
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

        await page.locator(".loading").waitFor({ state: "visible" });
        await page.locator(".loading").waitFor({ state: "hidden" });

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
        // The submit button should become a Stop button while responding
        const stopBtn = page.locator("chat-input button", { hasText: "Stop" });
        await expect(stopBtn).toBeVisible();
        await expect(chatInput).toHaveScreenshot("chat-input-disabled.png");
    });

    test("chat input enabled after response", async ({ page }) => {
        // Skipped: flaky due to potential lingering requests from previous tests
        const input = page.locator("chat-input textarea");
        await input.fill("Test message");
        await page.keyboard.press("Enter");

        await page.locator(".loading").waitFor({ state: "visible" });
        await page.locator(".loading").waitFor({ state: "hidden" });

        // Wait for assistant response to complete
        await page.waitForSelector("assistant-message", {
            state: "visible",
            timeout: 5000,
        });
        const chatInput = page.locator("chat-input");
        // After response completes the Stop button should not be visible
        const stopBtn = page.locator("chat-input button", { hasText: "Stop" });
        await expect(stopBtn).not.toBeVisible();
        await expect(chatInput).toHaveScreenshot("chat-input-enabled.png");
    });
});
