import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "../helpers/mock-api-key-status.js";
import { setupTestUser } from "../helpers/test-user.js";

test.describe("cost indicator visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);

        await page.route("**/api/conversations*", async (route) => {
            if (route.request().method() === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        result: "success",
                        data: [
                            {
                                id: "conv-ci1",
                                title: "Cost Indicator Test",
                                userId: "00000000-0000-4000-8000-000000000001",
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                messageCount: 0,
                            },
                        ],
                    }),
                });
            } else {
                await route.continue();
            }
        });
    });

    /**
     * Helper: mock SSE response with cost metadata
     * @param {import("playwright/test").Page} page
     * @param {{ ragMeta: { resultCount: number, usage?: { promptTokenCount?: number, candidatesTokenCount?: number, totalTokenCount?: number }, embeddingTokens?: number }, blocks: Array<Record<string, unknown>> }} options
     */
    async function mockSseResponse(page, options) {
        await page.route("**/api/conversations/*/messages*", async (route) => {
            if (route.request().method() === "POST") {
                const body = route.request().postDataJSON();
                const now = new Date().toISOString();
                const userMessage = {
                    type: "userMessage",
                    data: {
                        id: "um-ci1",
                        conversationId: "conv-ci1",
                        role: "user",
                        content: body.content || "",
                        mode: body.mode || "gm",
                        createdAt: now,
                    },
                };
                const assistantComplete = {
                    type: "assistantComplete",
                    data: {
                        id: "am-ci1",
                        conversationId: "conv-ci1",
                        role: "assistant",
                        content: null,
                        mode: body.mode || "gm",
                        createdAt: now,
                        blocks: options.blocks,
                        ragMeta: options.ragMeta,
                    },
                };

                await route.fulfill({
                    status: 200,
                    contentType: "text/event-stream",
                    body:
                        JSON.stringify(userMessage) +
                        "\n" +
                        JSON.stringify(assistantComplete) +
                        "\n",
                });
            } else if (route.request().method() === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ result: "success", data: [] }),
                });
            } else {
                await route.continue();
            }
        });
    }

    const costBlocks = [
        {
            type: "text",
            markdown:
                "The **Goblin Warrior** is a common low-level creature found in Pathfinder 2e. Here are the key details:",
        },
    ];

    const costMeta = {
        resultCount: 2,
        usage: { promptTokenCount: 500, candidatesTokenCount: 200, totalTokenCount: 700 },
        embeddingTokens: 50,
    };

    test("cost indicator visible — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await mockSseResponse(page, { blocks: costBlocks, ragMeta: costMeta });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input'] textarea");
        await input.fill("Tell me about goblins");
        await input.press("Enter");
        await page.waitForSelector(".cost-indicator", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const indicator = page.locator(".cost-indicator").first();
        await expect(indicator).toHaveScreenshot("cost-indicator-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("cost indicator visible — tablet", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        await mockSseResponse(page, { blocks: costBlocks, ragMeta: costMeta });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input'] textarea");
        await input.fill("Tell me about goblins");
        await input.press("Enter");
        await page.waitForSelector(".cost-indicator", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const indicator = page.locator(".cost-indicator").first();
        await expect(indicator).toHaveScreenshot("cost-indicator-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("cost indicator visible — phone", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await mockSseResponse(page, { blocks: costBlocks, ragMeta: costMeta });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input'] textarea");
        await input.fill("Tell me about goblins");
        await input.press("Enter");
        await page.waitForSelector(".cost-indicator", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const indicator = page.locator(".cost-indicator").first();
        await expect(indicator).toHaveScreenshot("cost-indicator-phone.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("no cost indicator when no usage data — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await mockSseResponse(page, {
            blocks: costBlocks,
            ragMeta: { resultCount: 1 },
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input'] textarea");
        await input.fill("Tell me about goblins");
        await input.press("Enter");
        await page.waitForSelector(".assistant-bubble", { timeout: 5000 });
        await page.waitForTimeout(500);

        const indicator = page.locator(".cost-indicator");
        await expect(indicator).toHaveCount(0);
    });

    test("high token count cost display — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await mockSseResponse(page, {
            blocks: costBlocks,
            ragMeta: {
                resultCount: 3,
                usage: {
                    promptTokenCount: 5000,
                    candidatesTokenCount: 2000,
                    totalTokenCount: 7000,
                },
                embeddingTokens: 100,
            },
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input'] textarea");
        await input.fill("Tell me about goblins");
        await input.press("Enter");
        await page.waitForSelector(".cost-indicator", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const indicator = page.locator(".cost-indicator").first();
        await expect(indicator).toHaveScreenshot("cost-indicator-high-tokens-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("zero totalTokenCount edge case — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await mockSseResponse(page, {
            blocks: costBlocks,
            ragMeta: {
                resultCount: 1,
                usage: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
                embeddingTokens: 0,
            },
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input'] textarea");
        await input.fill("Tell me about goblins");
        await input.press("Enter");
        await page.waitForSelector(".cost-indicator", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const indicator = page.locator(".cost-indicator").first();
        // Verify cost indicator renders with "<$0.001" for zero cost
        await expect(indicator).toContainText("<$0.001");
        await expect(indicator).toHaveScreenshot("cost-indicator-zero-tokens-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });
});
