import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "./helpers/mock-api-key-status.js";
import { setupTestUser } from "./helpers/test-user.js";

test.describe("follow-up after landing submit", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(500);
    });

    test("follow-up message goes to same conversation after landing submit", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");

        await sidebar.locator("conversation-item").first().click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(300);

        const newChatBtn = page.locator("new-chat-button button, .new-chat button");
        await newChatBtn.click();
        await page.waitForTimeout(500);

        const landingInput = page.locator('[data-test="landing-input"] textarea');
        await landingInput.fill("test");

        const landingSend = page.locator('button[data-test="landing-send"]');
        const firstReq = page.waitForRequest("**/api/conversations/*/messages");
        await landingSend.click();
        await firstReq;
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(500);

        const urlAfterFirst = page.url();
        expect(urlAfterFirst).toMatch(/\/conversations\/[0-9a-f-]{36}/);

        const chatTextarea = page.locator("chat-input textarea");
        await chatTextarea.focus();
        await chatTextarea.fill("test 2");
        await page.waitForTimeout(200);

        const sendBtn = page.locator("chat-input .send-btn:not(.stop)");
        const secondReq = page.waitForRequest(
            (req) => req.url().includes("/api/conversations/") && req.url().includes("/messages"),
        );
        await sendBtn.click();
        const req = await secondReq;
        await page.waitForLoadState("networkidle");

        const convIdFromRequest = req
            .url()
            .match(/\/conversations\/([0-9a-f-]{36})\/messages/)?.[1];
        const convIdFromUrl = urlAfterFirst.match(/\/conversations\/([0-9a-f-]{36})/)?.[1];
        expect(convIdFromRequest).toBe(convIdFromUrl);

        const urlAfterSecond = page.url();
        expect(urlAfterSecond).toBe(urlAfterFirst);
    });
});
