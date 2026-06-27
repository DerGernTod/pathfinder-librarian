import { expect, test } from "playwright/test";

import { VR_FIXED_TIMESTAMP } from "../shared/constants.js";
import { setupTestUser } from "./helpers/test-user.js";

test.describe("archive dialog visual regression", () => {
    /** @type {string} */
    let conversationId;

    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);

        // Get the seeded conversation IDs for this user via Playwright request context
        const listRes = await page.request.get("/api/conversations");
        const listData = await listRes.json();
        conversationId = listData.data[0]?.id;

        // Archive it with a pinned server-side timestamp so the rendered date is
        // deterministic (the dialog formats archived_at, which is stamped by the
        // server, not the browser — page.clock cannot reach it).
        if (conversationId) {
            const archiveRes = await page.request.post("/api/test/archive-conversation", {
                data: { conversationId, archivedAt: VR_FIXED_TIMESTAMP },
            });
            if (!archiveRes.ok) {
                throw new Error(`Archive failed: ${archiveRes.status()}`);
            }
        }

        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("archive dialog open with items — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await page.locator("sidebar-profile button.avatar").click();
        await page.waitForTimeout(300);
        await page.locator("sidebar-profile").locator('sl-menu-item:has-text("Archive")').click();
        await page.waitForTimeout(500);

        const dialog = page.locator("sl-dialog[open]");
        await expect(dialog).toBeVisible();

        const panel = dialog.locator('[part="body"]');
        await expect(panel).toHaveScreenshot("archive-dialog-open-desktop.png");
    });

    test("archive dialog open with items — tablet", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });

        await page.locator("sidebar-profile button.avatar").click();
        await page.waitForTimeout(300);
        await page.locator("sidebar-profile").locator('sl-menu-item:has-text("Archive")').click();
        await page.waitForTimeout(500);

        const dialog = page.locator("sl-dialog[open]");
        await expect(dialog).toBeVisible();

        const panel = dialog.locator('[part="body"]');
        await expect(panel).toHaveScreenshot("archive-dialog-open-tablet.png");
    });

    test("archive dialog open with items — phone", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.locator("sidebar-profile button.avatar").click({ force: true });
        await page.waitForTimeout(300);
        await page
            .locator("sidebar-profile")
            .locator('sl-menu-item:has-text("Archive")')
            .click({ force: true });
        await page.waitForTimeout(500);

        const dialog = page.locator("sl-dialog[open]");
        await expect(dialog).toBeVisible();

        const panel = dialog.locator('[part="body"]');
        await expect(panel).toHaveScreenshot("archive-dialog-open-phone.png");
    });

    test("archive dialog empty state — desktop", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        await page.request.delete(`/api/conversations/${conversationId}`);

        await page.locator("sidebar-profile button.avatar").click();
        await page.waitForTimeout(300);
        await page.locator("sidebar-profile").locator('sl-menu-item:has-text("Archive")').click();
        await page.waitForTimeout(500);

        const dialog = page.locator("sl-dialog[open]");
        await expect(dialog).toBeVisible();

        const panel = dialog.locator('[part="body"]');
        await expect(panel).toHaveScreenshot("archive-dialog-empty-desktop.png");
    });
});
