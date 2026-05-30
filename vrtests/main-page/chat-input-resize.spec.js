import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "../helpers/mock-api-key-status.js";
import { setupTestUser } from "../helpers/test-user.js";

const viewports = [
    { name: "phone", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1280, height: 800 },
];

test.describe("chat-input auto-resize", () => {
    for (const viewport of viewports) {
        test.describe(`${viewport.name} viewport`, () => {
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
                                        id: "conv-resize-1",
                                        title: "Resize Test",
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

                await page.route("**/api/conversations/*/messages*", async (route) => {
                    if (route.request().method() === "POST") {
                        const body = route.request().postDataJSON();
                        const now = new Date().toISOString();
                        const userMessage = {
                            type: "userMessage",
                            data: {
                                id: "um-resize-1",
                                conversationId: "conv-resize-1",
                                role: "user",
                                content: body.content || "",
                                mode: body.mode || "gm",
                                createdAt: now,
                            },
                        };
                        const assistantComplete = {
                            type: "assistantComplete",
                            data: {
                                id: "am-resize-1",
                                conversationId: "conv-resize-1",
                                role: "assistant",
                                content: null,
                                mode: body.mode || "gm",
                                createdAt: now,
                                blocks: [
                                    {
                                        type: "text",
                                        markdown: "Acknowledged.",
                                    },
                                ],
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

                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                await page.goto("/");
                await page.waitForSelector("main-page");
                await page.waitForTimeout(1000);

                const input = page.locator("[data-test='landing-input'] textarea");
                await input.fill("initial message");
                await input.press("Enter");
                await page.waitForSelector("chat-input", { timeout: 5000 });
                await page.waitForTimeout(500);

                await page.evaluate(() => {
                    const s = document.createElement("style");
                    s.textContent =
                        "*, *::before, *::after { animation: none !important; transition: none !important; }";
                    document.head.appendChild(s);
                });
            });

            test("empty textarea baseline", async ({ page }) => {
                const chatInput = page.locator("chat-input");
                await expect(chatInput).toHaveScreenshot(`${viewport.name}-input-empty.png`);
            });

            test("multi-line text grows textarea", async ({ page }) => {
                const chatInput = page.locator("chat-input");
                const textarea = page.locator("chat-input textarea");
                const lines = Array(6).fill("This is a line of text for testing.").join("\n");
                await textarea.fill(lines);
                await page.waitForTimeout(300);
                await expect(chatInput).toHaveScreenshot(`${viewport.name}-input-multiline.png`);
            });

            test("long text capped at max-height", async ({ page }) => {
                const chatInput = page.locator("chat-input");
                const textarea = page.locator("chat-input textarea");
                const lines = Array(15).fill("This is a line of text for testing.").join("\n");
                await textarea.fill(lines);
                await page.waitForTimeout(300);
                await expect(chatInput).toHaveScreenshot(`${viewport.name}-input-maxheight.png`);
            });

            test("focus preserved after submit", async ({ page }) => {
                const chatInput = page.locator("chat-input");
                const textarea = page.locator("chat-input textarea");
                await textarea.fill("test message");
                await page.waitForTimeout(200);

                const sendBtn = page.locator("chat-input .send-btn:not(.stop)");
                const requestPromise = page.waitForRequest(
                    (req) =>
                        req.url().includes("/api/conversations/") &&
                        req.url().includes("/messages"),
                );
                await sendBtn.click();
                await requestPromise;
                await page.waitForLoadState("networkidle");
                await page.waitForTimeout(300);

                await expect(chatInput).toHaveScreenshot(`${viewport.name}-input-after-submit.png`);
            });
        });
    }
});
