import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "../helpers/mock-api-key-status.js";
import { setupTestUser } from "../helpers/test-user.js";

test.describe("ungrounded response visual regression", () => {
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
                                id: "conv-ug1",
                                title: "Ungrounded Test",
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
     * Helper: mock SSE with ungrounded or grounded response
     * @param {import("playwright/test").Page} page
     * @param {{ ragMeta: { resultCount: number }, blocks: Array<Record<string, unknown>> }} options
     */
    async function mockSseResponse(page, options) {
        await page.route("**/api/conversations/*/messages*", async (route) => {
            if (route.request().method() === "POST") {
                const body = route.request().postDataJSON();
                const now = new Date().toISOString();
                const userMessage = {
                    type: "userMessage",
                    data: {
                        id: "um-ug1",
                        conversationId: "conv-ug1",
                        role: "user",
                        content: body.content || "",
                        mode: body.mode || "gm",
                        createdAt: now,
                    },
                };
                const assistantComplete = {
                    type: "assistantComplete",
                    data: {
                        id: "am-ug1",
                        conversationId: "conv-ug1",
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

    const ungroundedBlocks = [
        {
            type: "callout",
            title: "⚠ No Database Match",
            markdown:
                "This answer is based on general knowledge — no matching rules data was found in the database. Details may be inaccurate for Pathfinder 2e.",
        },
        {
            type: "text",
            markdown:
                "I don't have specific data about this in my database, but here's what I can share based on general Pathfinder 2e knowledge:\n\nThe creature you're asking about is likely a rare or unique NPC that isn't in the standard bestiaries.",
        },
    ];

    const groundedBlocks = [
        {
            type: "text",
            markdown:
                "The **Goblin Warrior** is a common low-level creature found in Pathfinder 2e. Here are the key details:",
        },
    ];

    test("ungrounded response — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await mockSseResponse(page, {
            blocks: ungroundedBlocks,
            ragMeta: { resultCount: 0 },
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Tell me about an unknown creature");
        await input.press("Enter");
        await page.waitForSelector(".assistant-bubble", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const bubble = page.locator(".assistant-bubble").first();
        await expect(bubble).toHaveScreenshot("ungrounded-response-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("ungrounded response — tablet", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        await mockSseResponse(page, {
            blocks: ungroundedBlocks,
            ragMeta: { resultCount: 0 },
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Tell me about an unknown creature");
        await input.press("Enter");
        await page.waitForSelector(".assistant-bubble", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const bubble = page.locator(".assistant-bubble").first();
        await expect(bubble).toHaveScreenshot("ungrounded-response-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("ungrounded response — phone", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await mockSseResponse(page, {
            blocks: ungroundedBlocks,
            ragMeta: { resultCount: 0 },
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Tell me about an unknown creature");
        await input.press("Enter");
        await page.waitForSelector(".assistant-bubble", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const bubble = page.locator(".assistant-bubble").first();
        await expect(bubble).toHaveScreenshot("ungrounded-response-phone.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("grounded response (control) — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await mockSseResponse(page, {
            blocks: groundedBlocks,
            ragMeta: { resultCount: 2 },
        });

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Tell me about goblins");
        await input.press("Enter");
        await page.waitForSelector(".assistant-bubble", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const bubble = page.locator(".assistant-bubble").first();
        await expect(bubble).toHaveScreenshot("grounded-response-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });
});
