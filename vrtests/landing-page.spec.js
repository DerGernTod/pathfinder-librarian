import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "./helpers/mock-api-key-status.js";
import { setupTestUser } from "./helpers/test-user.js";

test.describe("landing page visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        // Step 1: Create test user and log in (sets cookie on context)
        const { userId: _userId } = await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);

        // Step 2: Set up route interceptors (now that auth is ready, before navigation)
        await page.route("**/api/conversations*", async (route) => {
            const method = route.request().method();
            if (method === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ result: "success", data: [] }),
                });
            } else {
                await route.continue();
            }
        });

        await page.route("**/api/conversations/*/messages*", async (route) => {
            const method = route.request().method();
            if (method === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ result: "success", data: [] }),
                });
            } else {
                await route.continue();
            }
        });

        // Step 3: Navigate (triggers fetch, now intercepted)
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        // Disable animations for stable snapshots
        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });
    });

    test("landing empty default state", async ({ page }) => {
        await page.waitForSelector('[data-test="landing-input"]');
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot("landing-empty-default.png", {
            fullPage: true,
            maxDiffPixelRatio: 0.01,
        });
    });

    test("landing input focused state", async ({ page }) => {
        await page.waitForSelector('[data-test="landing-input"]');
        await page.focus('[data-test="landing-input"]');
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot("landing-empty-focus.png", {
            fullPage: true,
            maxDiffPixelRatio: 0.01,
        });
    });

    test("landing after submit shows conversation and composer", async ({ page }) => {
        await page.waitForSelector('[data-test="landing-input"]');

        // Mock POST /api/conversations to return a created conversation
        await page.route("**/api/conversations*", async (route) => {
            const method = route.request().method();
            if (method === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ result: "success", data: [] }),
                });
            } else if (method === "POST") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        result: "success",
                        data: {
                            id: "conv-landing",
                            title: "Hello world",
                            createdAt: new Date().toISOString(),
                        },
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // Mock POST /api/conversations/:id/messages with SSE response
        await page.route("**/api/conversations/*/messages*", async (route) => {
            const method = route.request().method();
            if (method === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ result: "success", data: [] }),
                });
            } else if (method === "POST") {
                const userMsg = {
                    type: "userMessage",
                    data: {
                        id: "um-landing",
                        conversationId: "conv-landing",
                        role: "user",
                        content: "Hello world",
                        mode: "player",
                        createdAt: new Date().toISOString(),
                    },
                };
                const assistantMsg = {
                    type: "assistantComplete",
                    data: {
                        id: "am-landing",
                        conversationId: "conv-landing",
                        role: "assistant",
                        content: null,
                        mode: "player",
                        createdAt: new Date().toISOString(),
                        blocks: [
                            {
                                type: "text",
                                markdown: "Hi there! Welcome to Pathfinder Librarian.",
                            },
                        ],
                    },
                };
                await route.fulfill({
                    status: 200,
                    contentType: "text/event-stream",
                    body: JSON.stringify(userMsg) + "\n" + JSON.stringify(assistantMsg) + "\n",
                });
            } else {
                await route.continue();
            }
        });

        const input = page.locator('[data-test="landing-input"]');
        await input.fill("Hello world");
        await page.click('[data-test="landing-send"]');

        // Wait for UI to swap — either session item or composer appears
        await page.waitForLoadState("networkidle");
        await page.waitForSelector('[data-test="session-item"]', { timeout: 5000 });
        await page.waitForSelector("chat-message", { timeout: 5000 });

        await expect(page).toHaveScreenshot("landing-after-submit.png", {
            fullPage: true,
            maxDiffPixelRatio: 0.01,
        });
    });

    test("landing accessibility checks", async ({ page }) => {
        await page.waitForSelector('[data-test="landing-input"]');

        // Verify landing region exists with correct role and label
        const region = page.locator('[role="region"][aria-label="Welcome"]');
        await expect(region).toBeVisible();

        // Verify landing input has correct aria-label
        const input = page.locator('[data-test="landing-input"]');
        await expect(input).toBeVisible();
        await expect(input).toHaveAttribute("aria-label", "Type your first prompt");

        // Verify send button has correct aria-label
        const sendBtn = page.locator('[data-test="landing-send"]');
        await expect(sendBtn).toBeVisible();
        await expect(sendBtn).toHaveAttribute("aria-label", "Send prompt");

        // Verify hint text is present
        const hint = page.locator(".landing-hint");
        await expect(hint).toHaveText("Press Enter to send");
    });
});
