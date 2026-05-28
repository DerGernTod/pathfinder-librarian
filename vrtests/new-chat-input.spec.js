import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "./helpers/mock-api-key-status.js";
import { setupTestUser } from "./helpers/test-user.js";

test.describe("new chat input clearing", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(500);
    });

    test("chat input is cleared when creating new chat via landing submit", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");

        await sidebar.locator("conversation-item").first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);

        const chatInput = page.locator("chat-input textarea");
        await chatInput.fill("something");

        const newChatBtn = page.locator("new-chat-button button, .new-chat button");
        await newChatBtn.click();
        await page.waitForTimeout(500);

        const landingInput = page.locator('[data-test="landing-input"] textarea');
        await landingInput.fill("other thing");

        const landingSend = page.locator('button[data-test="landing-send"]');
        const requestPromise = page.waitForRequest("**/api/conversations/*/messages");
        await landingSend.click();
        await requestPromise;
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);

        const chatTextarea = page.locator("chat-input textarea");
        const inputValue = await chatTextarea.inputValue();
        expect(inputValue).toBe("");

        const urlBefore = page.url();
        await chatTextarea.focus();
        await chatTextarea.fill("follow up message");
        await page.waitForTimeout(200);
        const sendBtn = page.locator("chat-input .send-btn:not(.stop)");
        const secondRequest = page.waitForRequest("**/api/conversations/*/messages");
        await sendBtn.click();
        await secondRequest;
        await page.waitForLoadState("networkidle");

        const urlAfter = page.url();
        expect(urlAfter).toBe(urlBefore);
    });
});
