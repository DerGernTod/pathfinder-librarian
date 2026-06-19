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
 * The offline indicator lives in chat-header so it is visible on every
 * breakpoint (the sidebar is hidden by default on phone, so a sidebar-
 * anchored indicator would be invisible exactly when the user needs it
 * most — next to the disabled send button).
 *
 * Coverage:
 *   - desktop 1280x800: header badge + dimmed non-active items
 *   - tablet  768x1024: header badge in collapsed-sidebar layout
 *   - phone   375x812:  header badge + landing input disabled
 *   - chat-input / new-chat-button offline affordances
 *   - partial-cache scenario (page.evaluate replaces `window.caches`)
 *
 * Critical invariant: when online, snapshots must be byte-identical to
 * existing baselines (the indicator renders nothing online).
 */
test.describe("PWA offline UX", () => {
    test.beforeEach(async ({ page, context }, testInfo) => {
        await setupTestUser(context, testInfo);
        await mockApiKeyStatusAvailable(page);
    });

    test.afterEach(async ({ context }) => {
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

    test("desktop 1280x800 — offline header badge + dimmed items", async ({ page, context }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        // Sanity: online baseline has no badge.
        expect(await page.locator("offline-indicator").count()).toBeGreaterThan(0);
        await expect(page.locator("offline-indicator .offline-badge")).toHaveCount(0);

        await context.setOffline(true);
        await page.waitForTimeout(800);
        await expect(page.locator("offline-indicator .offline-badge")).toBeVisible();

        await disableAnimations(page);

        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("offline-header-desktop.png", {
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
        // PWA work.
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        await disableAnimations(page);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("online-header-desktop.png", {
            maxDiffPixelRatio: 0.05,
        });
    });

    // ---------------- Tablet (sidebar collapses by default) ----------------

    test("tablet 768x1024 — offline badge in header", async ({ page, context }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        await context.setOffline(true);
        await page.waitForTimeout(800);

        await expect(page.locator("offline-indicator .offline-badge")).toBeVisible();

        await disableAnimations(page);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("offline-header-tablet.png", {
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

    test("phone 375x812 — offline header badge visible (sidebar hidden)", async ({
        page,
        context,
    }) => {
        // On phone the sidebar is hidden by default; the indicator MUST
        // be visible in the header without opening the sidebar overlay.
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        // Sanity: sidebar overlay is not open.
        await expect(page.locator("chat-sidebar.visible")).toHaveCount(0);

        await context.setOffline(true);
        await page.waitForTimeout(800);

        const badge = page.locator("offline-indicator .offline-badge");
        await expect(badge).toBeVisible();

        await disableAnimations(page);
        const header = page.locator("chat-header");
        await expect(header).toHaveScreenshot("offline-header-phone.png", {
            maxDiffPixelRatio: 0.05,
        });
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

    // ---------------- Partial-cache scenario ----------------

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
        // silently fails. Use Object.defineProperty (configurable: true).
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
        await page.waitForTimeout(1000);

        const items = page.locator("conversation-item");
        const count = await items.count();
        expect(count).toBeGreaterThan(0);

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
        expect(enabledCount).toBeLessThan(count);
    });

    test("desktop — visiting a conversation caches it for offline access", async ({
        page,
        context,
    }) => {
        // Verifies the page-side cache write in messages-store.fetchMessages:
        // navigating into a conversation must populate the same cache the
        // session-list consults when deciding what to disable offline.
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto("/");
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        const sidebar = page.locator("chat-sidebar");

        // Visit each seeded conversation so its messages GET is intercepted
        // by the page-side cache write.
        const convs = await page.evaluate(async () => {
            const res = await fetch("/api/conversations");
            const json = await res.json();
            return /** @type {{ result: string, data: Array<{ id: string, title: string }> }} */ (
                json
            ).data.map((c) => ({ id: c.id, title: c.title }));
        });
        expect(convs.length).toBeGreaterThanOrEqual(2);

        for (const conv of convs) {
            await sidebar.locator("conversation-item", { hasText: conv.title }).first().click();
            // Wait for the messages GET round-trip + page-side cache write.
            // SSE for assistant streaming keeps networkidle unreliable, so
            // poll the cache directly.
            await expect
                .poll(
                    async () => {
                        return await page.evaluate(async (id) => {
                            const cache = await caches.open("pwa-v1-api-data");
                            return Boolean(await cache.match(`/api/conversations/${id}/messages`));
                        }, conv.id);
                    },
                    { timeout: 5000, intervals: [100, 250, 500] },
                )
                .toBe(true);
        }

        // Now each conversation URL must be in the pwa-v1-api-data cache.
        const cached = await page.evaluate(async (items) => {
            const cache = await caches.open("pwa-v1-api-data");
            /** @param {string} id */
            const present = async (id) =>
                Boolean(await cache.match(`/api/conversations/${id}/messages`));
            const out = /** @type {Record<string, boolean>} */ ({});
            for (const item of items) {
                out[item.id] = await present(item.id);
            }
            return out;
        }, convs);
        for (const conv of convs) {
            expect(cached[conv.id], `conversation ${conv.title} should be cached after visit`).toBe(
                true,
            );
        }

        // Going offline: every seeded conversation must remain interactive.
        await context.setOffline(true);
        await page.waitForTimeout(500);

        const items = page.locator("conversation-item");
        const count = await items.count();
        expect(count).toBe(convs.length);

        // session-list queries the cache asynchronously on the offline
        // transition; poll until the disabled count settles.
        await expect
            .poll(
                async () => {
                    let disabled = 0;
                    const all = await items.all();
                    for (const item of all) {
                        const ariaDisabled = await item.evaluate((el) =>
                            el.shadowRoot?.querySelector(".item")?.getAttribute("aria-disabled"),
                        );
                        if (ariaDisabled === "true") {
                            disabled++;
                        }
                    }
                    return disabled;
                },
                { timeout: 5000, intervals: [100, 250, 500] },
            )
            .toBe(0);
    });
});
