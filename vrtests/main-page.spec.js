import { expect, test } from "playwright/test";

test.describe("main page visual regression", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
    });

    test("full page matches baseline", async ({ page }) => {
        await expect(page).toHaveScreenshot("main-page.png", {
            fullPage: true,
            maxDiffPixelRatio: 0.01,
        });
    });

    test("sidebar matches baseline", async ({ page }) => {
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("sidebar.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("chat area matches baseline", async ({ page }) => {
        const chatArea = page.locator("main.main");
        await expect(chatArea).toHaveScreenshot("chat-area.png", {
            maxDiffPixelRatio: 0.01,
        });
    });
});

test.describe("mode toggle visual regression", () => {
    test("player mode header", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("header-player-mode.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("gm mode header", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("header-gm-mode.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("player mode sidebar profile", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-player.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("gm mode sidebar profile", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-gm.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("player mode chat input", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);
        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("chat-input-player.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("gm mode chat input", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("chat-input-gm.png", {
            maxDiffPixelRatio: 0.01,
        });
    });
});

test.describe("sidebar toggle visual regression", () => {
    test("sidebar expanded state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("sidebar-expanded.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("sidebar collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("sidebar-collapsed.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("toggle button expanded state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("sidebar-toggle");
        await page.waitForTimeout(1000);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("toggle-expanded.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("toggle button collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("sidebar-toggle");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("toggle-collapsed.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("new chat button expanded state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("new-chat-button");
        await page.waitForTimeout(1000);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("new-chat-expanded.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("new chat button collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("new-chat-button");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("new-chat-collapsed.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("conversation menu dropdown trigger", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("conversation-menu-trigger.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("conversation menu with active conversation highlighted", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        await page.locator("conversation-menu button.menu-trigger").click();
        await page.waitForTimeout(500);
        const dropdown = page.locator("conversation-menu sl-dropdown");
        await expect(dropdown).toHaveScreenshot("conversation-menu-active.png", {
            maxDiffPixelRatio: 0.01,
        });
    });

    test("sidebar-profile collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-collapsed.png", {
            maxDiffPixelRatio: 0.01,
        });
    });
});
