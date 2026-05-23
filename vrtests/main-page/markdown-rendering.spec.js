import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "../helpers/mock-api-key-status.js";
import { setupTestUser } from "../helpers/test-user.js";

test.describe("markdown rendering visual regression", () => {
    /**
     * Helper: mock SSE to return specific blocks
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
                        id: "um-md1",
                        conversationId: "conv-md1",
                        role: "user",
                        content: body.content || "",
                        mode: body.mode || "gm",
                        createdAt: now,
                    },
                };
                const assistantComplete = {
                    type: "assistantComplete",
                    data: {
                        id: "am-md1",
                        conversationId: "conv-md1",
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

    /**
     * Disable animations and transitions for deterministic snapshots.
     * @param {import("playwright/test").Page} page
     */
    async function disableAnimations(page) {
        await page.evaluate(() => {
            const s = document.createElement("style");
            s.textContent =
                "*, *::before, *::after { animation: none !important; transition: none !important; }";
            document.head.appendChild(s);
        });
    }

    test.describe("callout with rich markdown", () => {
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
                                    id: "conv-md1",
                                    title: "Markdown Test",
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

        test("desktop viewport (1280x800)", async ({ page }) => {
            await page.setViewportSize({ width: 1280, height: 800 });

            await mockSseWithBlocks(page, [
                {
                    type: "text",
                    markdown: "Here are the critical hit rules:",
                },
                {
                    type: "callout",
                    title: "Critical Hits",
                    markdown:
                        "When you roll a **natural 20** on an attack roll, you score a critical hit!\n\n- Double all damage dice\n- Apply weapon's **critical specialization** effect\n- > *Note:* Some creatures are immune to critical hits",
                },
            ]);

            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);

            const input = page.locator("[data-test='landing-input']");
            await input.fill("Tell me about critical hits");
            await input.press("Enter");
            await page.waitForSelector(".callout-card", { timeout: 5000 });
            await page.waitForTimeout(500);

            await disableAnimations(page);

            const chatArea = page.locator("main.main");
            await expect(chatArea).toHaveScreenshot("markdown-callout-desktop.png");
        });

        test("tablet viewport (768x1024)", async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });

            await mockSseWithBlocks(page, [
                {
                    type: "text",
                    markdown: "Here are the critical hit rules:",
                },
                {
                    type: "callout",
                    title: "Critical Hits",
                    markdown:
                        "When you roll a **natural 20** on an attack roll, you score a critical hit!\n\n- Double all damage dice\n- Apply weapon's **critical specialization** effect\n- > *Note:* Some creatures are immune to critical hits",
                },
            ]);

            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);

            const input = page.locator("[data-test='landing-input']");
            await input.fill("Tell me about critical hits");
            await input.press("Enter");
            await page.waitForSelector(".callout-card", { timeout: 5000 });
            await page.waitForTimeout(500);

            await disableAnimations(page);

            const chatArea = page.locator("main.main");
            await expect(chatArea).toHaveScreenshot("markdown-callout-tablet.png");
        });

        test("phone viewport (375x812)", async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 812 });

            await mockSseWithBlocks(page, [
                {
                    type: "text",
                    markdown: "Here are the critical hit rules:",
                },
                {
                    type: "callout",
                    title: "Critical Hits",
                    markdown:
                        "When you roll a **natural 20** on an attack roll, you score a critical hit!\n\n- Double all damage dice\n- Apply weapon's **critical specialization** effect\n- > *Note:* Some creatures are immune to critical hits",
                },
            ]);

            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);

            const input = page.locator("[data-test='landing-input']");
            await input.fill("Tell me about critical hits");
            await input.press("Enter");
            await page.waitForSelector(".callout-card", { timeout: 5000 });
            await page.waitForTimeout(500);

            await disableAnimations(page);

            const chatArea = page.locator("main.main");
            await expect(chatArea).toHaveScreenshot("markdown-callout-phone.png");
        });
    });

    test.describe("text block with varied formatting", () => {
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
                                    id: "conv-md2",
                                    title: "Formatting Test",
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

        test("desktop viewport (1280x800)", async ({ page }) => {
            await page.setViewportSize({ width: 1280, height: 800 });

            await mockSseWithBlocks(page, [
                {
                    type: "text",
                    markdown:
                        "## Combat Actions\n\nYou have **3 actions** per turn. Common actions:\n\n1. `Stride` — move up to your Speed\n2. `Strike` — make an attack\n3. `Cast a Spell` — requires *Somatic*, *Verbal*, or *Material* components\n\n> The GM may allow creative uses of actions.",
                },
            ]);

            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);

            const input = page.locator("[data-test='landing-input']");
            await input.fill("What are combat actions?");
            await input.press("Enter");
            await page.waitForSelector(".markdown-body", { timeout: 5000 });
            await page.waitForTimeout(500);

            await disableAnimations(page);

            const chatArea = page.locator("main.main");
            await expect(chatArea).toHaveScreenshot("markdown-formatting-desktop.png");
        });

        test("tablet viewport (768x1024)", async ({ page }) => {
            await page.setViewportSize({ width: 768, height: 1024 });

            await mockSseWithBlocks(page, [
                {
                    type: "text",
                    markdown:
                        "## Combat Actions\n\nYou have **3 actions** per turn. Common actions:\n\n1. `Stride` — move up to your Speed\n2. `Strike` — make an attack\n3. `Cast a Spell` — requires *Somatic*, *Verbal*, or *Material* components\n\n> The GM may allow creative uses of actions.",
                },
            ]);

            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);

            const input = page.locator("[data-test='landing-input']");
            await input.fill("What are combat actions?");
            await input.press("Enter");
            await page.waitForSelector(".markdown-body", { timeout: 5000 });
            await page.waitForTimeout(500);

            await disableAnimations(page);

            const chatArea = page.locator("main.main");
            await expect(chatArea).toHaveScreenshot("markdown-formatting-tablet.png");
        });

        test("phone viewport (375x812)", async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 812 });

            await mockSseWithBlocks(page, [
                {
                    type: "text",
                    markdown:
                        "## Combat Actions\n\nYou have **3 actions** per turn. Common actions:\n\n1. `Stride` — move up to your Speed\n2. `Strike` — make an attack\n3. `Cast a Spell` — requires *Somatic*, *Verbal*, or *Material* components\n\n> The GM may allow creative uses of actions.",
                },
            ]);

            await page.goto("/");
            await page.waitForSelector("main-page");
            await page.waitForTimeout(1000);

            const input = page.locator("[data-test='landing-input']");
            await input.fill("What are combat actions?");
            await input.press("Enter");
            await page.waitForSelector(".markdown-body", { timeout: 5000 });
            await page.waitForTimeout(500);

            await disableAnimations(page);

            const chatArea = page.locator("main.main");
            await expect(chatArea).toHaveScreenshot("markdown-formatting-phone.png");
        });
    });
});
