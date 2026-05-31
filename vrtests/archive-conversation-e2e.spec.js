import { expect, test } from "playwright/test";

import { setupTestUser } from "./helpers/test-user.js";

test.describe("archive conversation e2e", () => {
    test.beforeEach(async ({ context }, testInfo) => {
        await setupTestUser(context, testInfo);
    });

    test("archiving a conversation removes it from sidebar and shows in archive dialog", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const items = page.locator("conversation-item");
        const countBefore = await items.count();
        expect(countBefore).toBeGreaterThanOrEqual(2);

        const secondItem = items.nth(1);
        const titleEl = secondItem.locator(".item-title");
        const title = await titleEl.textContent();
        expect(title).toBeTruthy();

        await secondItem.hover();
        await page.waitForTimeout(200);

        const kebab = secondItem.locator(".kebab");
        await kebab.click();
        await page.waitForTimeout(200);

        const archiveBtn = secondItem.locator('[data-action="archive"]');
        await archiveBtn.click();
        await page.waitForTimeout(500);

        const countAfter = await items.count();
        expect(countAfter).toBe(countBefore - 1);

        const remainingTitles = await items.locator(".item-title").allTextContents();
        expect(remainingTitles.map((t) => t.trim())).not.toContain(title?.trim());

        await page.locator("sidebar-profile button.avatar").click();
        await page.waitForTimeout(300);
        await page.locator("sidebar-profile").locator('sl-menu-item:has-text("Archive")').click();
        await page.waitForTimeout(1000);

        const dialog = page.locator("sl-dialog[open]");
        await expect(dialog).toBeVisible();

        const archivedTitle = await dialog.locator(".archived-title").first().textContent();
        expect(archivedTitle?.trim()).toBe(title?.trim());
    });

    test("kebab is always visible on phone without hover", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        await page
            .locator("chat-header")
            .locator('button[aria-label="Open sidebar"]')
            .click({ force: true });
        await page.waitForTimeout(500);

        const firstItem = page.locator("conversation-item").first();
        const kebab = firstItem.locator(".kebab");
        await expect(kebab).toBeVisible();
    });

    test("archiving on phone viewport works via tap", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        await page
            .locator("chat-header")
            .locator('button[aria-label="Open sidebar"]')
            .click({ force: true });
        await page.waitForTimeout(500);

        const items = page.locator("conversation-item");
        const countBefore = await items.count();
        expect(countBefore).toBeGreaterThanOrEqual(1);

        const firstItem = items.first();
        const kebab = firstItem.locator(".kebab");
        await kebab.click({ force: true });
        await page.waitForTimeout(200);

        const archiveBtn = firstItem.locator('[data-action="archive"]');
        await archiveBtn.click({ force: true });
        await page.waitForTimeout(500);

        const countAfter = await items.count();
        expect(countAfter).toBe(countBefore - 1);
    });
});
