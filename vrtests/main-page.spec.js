import { expect, test } from "playwright/test";

test.describe("main page visual regression", () => {
    test.beforeEach(async ({ page, context }) => {
        // Reset DB to clean seeded state before each test
        const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
        expect(res.ok).toBe(true);

        // Quick-login as default seed user
        const loginRes = await fetch("http://localhost:3000/api/auth/quick-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001" }),
        });
        expect(loginRes.ok).toBe(true);

        // Set the session cookie on the page context
        const setCookieHeader = loginRes.headers.get("set-cookie");
        if (setCookieHeader) {
            const cookieMatch = setCookieHeader.match(/session_token=([^;]+)/);
            if (cookieMatch) {
                await context.addCookies([
                    {
                        name: "session_token",
                        value: cookieMatch[1],
                        domain: "localhost",
                        path: "/",
                    },
                ]);
            }
        }

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
        await expect(sidebar).toHaveScreenshot("sidebar.png");
    });

    test("chat area matches baseline", async ({ page }) => {
        const chatArea = page.locator("main.main");
        await expect(chatArea).toHaveScreenshot("chat-area.png");
    });
});

test.describe("stat block visual regression", () => {
    test.beforeEach(async ({ _page, context }) => {
        // Reset DB and login
        const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
        expect(res.ok).toBe(true);

        const loginRes = await fetch("http://localhost:3000/api/auth/quick-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001" }),
        });
        expect(loginRes.ok).toBe(true);

        const setCookieHeader = loginRes.headers.get("set-cookie");
        if (setCookieHeader) {
            const cookieMatch = setCookieHeader.match(/session_token=([^;]+)/);
            if (cookieMatch) {
                await context.addCookies([
                    {
                        name: "session_token",
                        value: cookieMatch[1],
                        domain: "localhost",
                        path: "/",
                    },
                ]);
            }
        }
    });

    test("full stat block with all features", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("chat-input textarea");
        await input.fill("Show me a Mitflit King stat block");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);

        const statBlock = page.locator("stat-block").first();
        await expect(statBlock).toBeVisible();

        const details = statBlock.locator("sl-details");
        await details.click();
        await page.waitForTimeout(500);

        await expect(statBlock).toHaveScreenshot("stat-block-full.png");
    });

    test("minimal stat block (partial data)", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("chat-input textarea");
        await input.fill("Show me a simple goblin stat block");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);

        const statBlock = page.locator("stat-block").first();
        await expect(statBlock).toBeVisible();

        const details = statBlock.locator("sl-details");
        await details.click();
        await page.waitForTimeout(500);

        await expect(statBlock).toHaveScreenshot("stat-block-minimal.png");
    });

    test("stat block responsive layout", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const input = page.locator("chat-input textarea");
        await input.fill("Show me a Mitflit King stat block");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);

        const statBlock = page.locator("stat-block").first();
        await expect(statBlock).toBeVisible();

        const details = statBlock.locator("sl-details");
        await details.click();
        await page.waitForTimeout(500);

        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(300);

        await expect(statBlock).toHaveScreenshot("stat-block-mobile.png");

        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(300);

        await expect(statBlock).toHaveScreenshot("stat-block-tablet.png");

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(300);
    });
});

test.describe("mode toggle visual regression", () => {
    test.beforeEach(async ({ _page, context }) => {
        // Reset DB and login
        const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
        expect(res.ok).toBe(true);

        const loginRes = await fetch("http://localhost:3000/api/auth/quick-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001" }),
        });
        expect(loginRes.ok).toBe(true);

        const setCookieHeader = loginRes.headers.get("set-cookie");
        if (setCookieHeader) {
            const cookieMatch = setCookieHeader.match(/session_token=([^;]+)/);
            if (cookieMatch) {
                await context.addCookies([
                    {
                        name: "session_token",
                        value: cookieMatch[1],
                        domain: "localhost",
                        path: "/",
                    },
                ]);
            }
        }
    });

    test("player mode header", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("header-player-mode.png");
    });

    test("gm mode header", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("header-gm-mode.png");
    });

    test("player mode sidebar profile", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-player.png");
    });

    test("gm mode sidebar profile", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-gm.png");
    });

    test("player mode chat input", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);
        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("chat-input-player.png");
    });

    test("gm mode chat input", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("chat-header");
        await page.waitForTimeout(1000);
        await page.locator("chat-header button", { hasText: "GM Mode" }).click();
        await page.waitForTimeout(500);
        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("chat-input-gm.png");
    });
});

test.describe("sidebar toggle visual regression", () => {
    test.beforeEach(async ({ _page, context }) => {
        // Reset DB and login
        const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
        expect(res.ok).toBe(true);

        const loginRes = await fetch("http://localhost:3000/api/auth/quick-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001" }),
        });
        expect(loginRes.ok).toBe(true);

        const setCookieHeader = loginRes.headers.get("set-cookie");
        if (setCookieHeader) {
            const cookieMatch = setCookieHeader.match(/session_token=([^;]+)/);
            if (cookieMatch) {
                await context.addCookies([
                    {
                        name: "session_token",
                        value: cookieMatch[1],
                        domain: "localhost",
                        path: "/",
                    },
                ]);
            }
        }
    });

    test("sidebar expanded state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("sidebar-expanded.png");
    });

    test("sidebar collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("sidebar-collapsed.png");
    });

    test("toggle button expanded state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("sidebar-toggle");
        await page.waitForTimeout(1000);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("toggle-expanded.png");
    });

    test("toggle button collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("sidebar-toggle");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("toggle-collapsed.png");
    });

    test("new chat button expanded state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("new-chat-button");
        await page.waitForTimeout(1000);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("new-chat-expanded.png");
    });

    test("new chat button collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("new-chat-button");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("new-chat-collapsed.png");
    });

    test("conversation menu dropdown trigger", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("conversation-menu-trigger.png");
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
        await expect(dropdown).toHaveScreenshot("conversation-menu-active.png");
    });

    test("sidebar-profile collapsed state", async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);
        await page.locator("sidebar-toggle button").click();
        await page.waitForTimeout(500);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("sidebar-profile-collapsed.png");
    });
});
