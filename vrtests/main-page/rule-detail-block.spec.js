import { expect, test } from "playwright/test";

import { setupTestUser } from "../helpers/test-user.js";

test.describe("rule-detail block visual regression", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);

        await page.route("**/api/conversations*", async (route) => {
            if (route.request().method() === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        result: "success",
                        data: [
                            {
                                id: "conv-rd1",
                                title: "Rule Detail Test",
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
     * Helper: mock SSE to return a rule-detail block
     * @param {import("playwright/test").Page} page
     * @param {Array<Record<string, unknown>>} blocks
     */
    async function mockSseWithBlocks(page, blocks) {
        await page.route("**/api/conversations/*/messages*", async (route) => {
            if (route.request().method() === "POST") {
                const body = route.request().postDataJSON();
                const now = new Date().toISOString();
                const userMessage = {
                    type: "userMessage",
                    data: {
                        id: "um-rd1",
                        conversationId: "conv-rd1",
                        role: "user",
                        content: body.content || "",
                        mode: body.mode || "gm",
                        createdAt: now,
                    },
                };
                const assistantComplete = {
                    type: "assistantComplete",
                    data: {
                        id: "am-rd1",
                        conversationId: "conv-rd1",
                        role: "assistant",
                        content: null,
                        mode: body.mode || "gm",
                        createdAt: now,
                        blocks,
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

    test("inline rule-detail block with description", async ({ page }) => {
        await mockSseWithBlocks(page, [
            {
                type: "text",
                markdown: "The creature is afflicted with a condition.",
            },
            {
                type: "rule-detail",
                title: "Enfeebled",
                category: "condition",
                description:
                    "You take a status penalty to your Strength-based attack and damage rolls.",
            },
        ]);

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Tell me about a condition");
        await input.press("Enter");
        await page.waitForSelector(".rule-detail-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        // Disable animations for deterministic snapshot
        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const block = page.locator(".rule-detail-block").first();
        await expect(block).toHaveScreenshot("rule-detail-block-with-description.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("inline rule-detail block with traits", async ({ page }) => {
        await mockSseWithBlocks(page, [
            {
                type: "rule-detail",
                title: "Humanoid",
                category: "trait",
                description: "Humanoid creatures are any creatures that are vaguely human-shaped.",
                traits: ["Human", "Shapechanger"],
            },
        ]);

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("Tell me about the humanoid trait");
        await input.press("Enter");
        await page.waitForSelector(".rule-detail-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const block = page.locator(".rule-detail-block").first();
        await expect(block).toHaveScreenshot("rule-detail-block-with-traits.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("inline rule-detail block phone viewport", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await mockSseWithBlocks(page, [
            {
                type: "text",
                markdown: "A condition affects the creature.",
            },
            {
                type: "rule-detail",
                title: "Enfeebled",
                category: "condition",
                description:
                    "You take a status penalty to your Strength-based attack and damage rolls.",
            },
        ]);

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("What is enfeebled?");
        await input.press("Enter");
        await page.waitForSelector(".rule-detail-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const block = page.locator(".rule-detail-block").first();
        await expect(block).toHaveScreenshot("rule-detail-block-phone.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("inline rule-detail block tablet viewport", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        await mockSseWithBlocks(page, [
            {
                type: "text",
                markdown: "A condition affects the creature.",
            },
            {
                type: "rule-detail",
                title: "Enfeebled",
                category: "condition",
                description:
                    "You take a status penalty to your Strength-based attack and damage rolls.",
            },
        ]);

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("What is enfeebled?");
        await input.press("Enter");
        await page.waitForSelector(".rule-detail-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const block = page.locator(".rule-detail-block").first();
        await expect(block).toHaveScreenshot("rule-detail-block-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("inline rule-detail block desktop viewport", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await mockSseWithBlocks(page, [
            {
                type: "text",
                markdown: "A condition affects the creature.",
            },
            {
                type: "rule-detail",
                title: "Enfeebled",
                category: "condition",
                description:
                    "You take a status penalty to your Strength-based attack and damage rolls.",
            },
        ]);

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("[data-test='landing-input']");
        await input.fill("What is enfeebled?");
        await input.press("Enter");
        await page.waitForSelector(".rule-detail-block", { timeout: 5000 });
        await page.waitForTimeout(500);

        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });

        const block = page.locator(".rule-detail-block").first();
        await expect(block).toHaveScreenshot("rule-detail-block-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });
});
