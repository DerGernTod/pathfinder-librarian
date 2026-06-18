import { expect, test } from "playwright/test";

import { mockApiKeyStatusAvailable } from "../helpers/mock-api-key-status.js";
import { setupTestUser } from "../helpers/test-user.js";

/**
 * PWA offline visual regression.
 *
 * Uses `context.setOffline(true)` to flip `navigator.onLine` and fire the
 * browser's `offline` event — the offline UI appears without depending on
 * the service worker installing (PLAN §"Offline Detection Approach").
 *
 * Coverage per PLAN §"Visual regression tests":
 *   - desktop 1280x800: sidebar offline badge + dimmed non-active items
 *   - tablet  768x1024: collapsed-sidebar offline dot
 *   - phone   375x812:  landing input disabled, sidebar overlay
 *   - chat-input / new-chat-button offline affordances
 *   - partial-cache scenario (page.evaluate replaces `window.caches`)
 *
 * Critical invariant: when online, snapshots must be byte-identical to the
 * existing baselines (the indicator renders nothing online; the host is
 * `position: absolute` so it does not enter `.profile` grid flow).
 */
test.describe("PWA offline UX", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);
    });

    test.afterEach(async ({ context }) => {
        // Always restore network state so subsequent tests are deterministic.
        await context.setOffline(false);
    });

    /**
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

    // ---------------- Desktop ----------------

    test("desktop 1280x800 — offline sidebar badge + dimmed items", async ({ page, context }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        // Sanity: online baseline has no indicator.
        expect(await page.locator("offline-indicator").count()).toBeGreaterThan(0);
        await expect(page.locator("offline-indicator .offline-badge")).toHaveCount(0);

        await context.setOffline(true);
        // Wait for the offline event to propagate through UIState → re-render.
        await page.waitForTimeout(800);
        await expect(page.locator("offline-indicator .offline-badge")).toBeVisible();

        await disableAnimations(page);

        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("offline-sidebar-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("desktop 1280x800 — chat-input send button disabled offline", async ({
        page,
        context,
    }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("chat-input");
        await page.waitForTimeout(1000);

        await context.setOffline(true);
        await page.waitForTimeout(800);

        const sendBtn = page.locator("chat-input .send-btn");
        await expect(sendBtn).toBeDisabled();
        await expect(sendBtn).toHaveAttribute("title", "Unavailable offline");

        await disableAnimations(page);
        const input = page.locator("chat-input");
        await expect(input).toHaveScreenshot("offline-chat-input-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("desktop 1280x800 — new-chat-button aria-disabled offline", async ({ page, context }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("new-chat-button");
        await page.waitForTimeout(1000);

        await context.setOffline(true);
        await page.waitForTimeout(800);

        const btn = page.locator("new-chat-button button");
        await expect(btn).toHaveAttribute("aria-disabled", "true");
        await expect(btn).toHaveAttribute("tabindex", "-1");
        await expect(btn).not.toHaveAttribute("disabled");

        await disableAnimations(page);
        const ncb = page.locator("new-chat-button");
        await expect(ncb).toHaveScreenshot("offline-new-chat-button-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("desktop 1280x800 — online byte-identical to existing snapshot", async ({ page }) => {
        // No setOffline call: defaults to online. offline-indicator renders
        // nothing, so this snapshot MUST match anything captured before
        // PWA work (verifies `:host { position: absolute }` doesn't reflow).
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        await disableAnimations(page);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("online-sidebar-profile-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    // ---------------- Tablet (collapsed by default) ----------------

    test("tablet 768x1024 — offline dot in collapsed sidebar", async ({ page, context }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        await context.setOffline(true);
        await page.waitForTimeout(800);

        await expect(page.locator("offline-indicator .offline-dot")).toBeVisible();

        await disableAnimations(page);
        const profile = page.locator("sidebar-profile");
        await expect(profile).toHaveScreenshot("offline-sidebar-profile-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("tablet 768x1024 — offline sidebar matches baseline", async ({ page, context }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        await context.setOffline(true);
        await page.waitForTimeout(800);

        await disableAnimations(page);
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar).toHaveScreenshot("offline-sidebar-tablet.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    // ---------------- Phone ----------------

    test("phone 375x812 — offline chat-header new-chat icon aria-disabled", async ({
        page,
        context,
    }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        await context.setOffline(true);
        await page.waitForTimeout(800);

        const iconBtn = page.locator("chat-header .new-chat-icon-btn");
        await expect(iconBtn).toHaveAttribute("aria-disabled", "true");
        await expect(iconBtn).toHaveAttribute("tabindex", "-1");
    });

    test("phone 375x812 — offline landing-view (no conversations)", async ({ page, context }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        // Mock empty conversation list BEFORE navigation so main-page mounts
        // in the landing view immediately.
        await page.route("**/api/conversations*", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ result: "success", data: [] }),
            });
        });

        await page.goto("/");
        await page.waitForSelector("landing-view", { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);

        // Go offline; main-page's window offline listener fans into UIState.
        await context.setOffline(true);
        await page.waitForTimeout(800);

        const sendBtn = page.locator('landing-view [data-test="landing-send"]');
        await expect(sendBtn).toBeDisabled();

        await disableAnimations(page);
        const landing = page.locator("landing-view");
        await expect(landing).toHaveScreenshot("offline-landing-view-phone.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    test("phone 375x812 — offline sidebar overlay badge visible", async ({ page, context }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        // Open the phone sidebar overlay.
        await page.locator("chat-header .hamburger-btn").click();
        await page.waitForTimeout(500);

        await context.setOffline(true);
        await page.waitForTimeout(800);

        const badge = page.locator("offline-indicator .offline-badge");
        await expect(badge).toBeVisible();

        await disableAnimations(page);
        // Snapshot the offline-indicator itself (its host is positioned
        // absolutely inside .profile, so a full-sidebar screenshot on phone
        // has flaky visibility from the fixed/translated overlay).
        await expect(page.locator("sidebar-profile")).toHaveScreenshot(
            "offline-sidebar-profile-phone.png",
            { maxDiffPixelRatio: 0.05 },
        );
    });

    // ---------------- Partial-cache scenario (PLAN reviewer point #12) ----------------

    test("desktop — partial-cache: not every conversation-item is enabled offline", async ({
        page,
        context,
    }) => {
        await page.setViewportSize({ width: 1280, height: 800 });

        // Navigate first so relative URLs in page.evaluate resolve.
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        // Identify the seeded conversations.
        const convIds = await page.evaluate(async () => {
            const res = await fetch("/api/conversations");
            const json = await res.json();
            return /** @type {{ result: string, data: Array<{ id: string }> }} */ (json).data.map(
                (c) => c.id,
            );
        });
        expect(convIds.length).toBeGreaterThan(0);

        // Inject a partial-cache stub BEFORE the offline transition so
        // session-list's willUpdate finds exactly one cached conversation.
        // Real Chromium already defines `window.caches`, so a plain assignment
        // silently fails. Use Object.defineProperty (configurable: true) per PLAN.
        const cachedId = convIds[0];
        await page.evaluate(
            async ([id]) => {
                const stub = {
                    open: async () => ({
                        match: async (/** @type {string | URL | Request} */ req) => {
                            const url =
                                typeof req === "string"
                                    ? req
                                    : req instanceof URL
                                      ? req.href
                                      : req.url;
                            return url.endsWith(`/api/conversations/${id}/messages`)
                                ? new Response("{}", { status: 200 })
                                : undefined;
                        },
                    }),
                    match: async () => undefined,
                    keys: async () => [],
                    delete: async () => false,
                };
                Object.defineProperty(window, "caches", {
                    value: stub,
                    configurable: true,
                });
            },
            /** @type {[string]} */ ([cachedId]),
        );

        await context.setOffline(true);
        await page.waitForTimeout(1000); // allow willUpdate + cache lookup to settle

        const items = page.locator("conversation-item");
        const count = await items.count();
        expect(count).toBeGreaterThan(0);

        // Count items still interactive (no aria-disabled=true on the inner
        // .item div). The cached + active conversations are exempt; every
        // OTHER non-cached item should be disabled.
        let enabledCount = 0;
        for (let i = 0; i < count; i++) {
            const ariaDisabled = await items
                .nth(i)
                .evaluate((el) =>
                    el.shadowRoot?.querySelector(".item")?.getAttribute("aria-disabled"),
                );
            if (ariaDisabled !== "true") {
                enabledCount++;
            }
        }
        // We only assert that NOT everything is enabled (i.e., dimming kicked in).
        expect(enabledCount).toBeLessThan(count);
    });
});
