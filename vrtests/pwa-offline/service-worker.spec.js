import { expect, test as baseTest } from "playwright/test";

import { setupTestUser } from "../helpers/test-user.js";

/**
 * Service-worker integration test.
 *
 * The global Playwright config sets `serviceWorkers: "block"` so API mocks
 * via `page.route` aren't bypassed by SW-initiated fetches. This file
 * overrides that fixture to allow SW registration, then verifies the
 * production offline contract end-to-end:
 *
 *   1. SW registers and `clients.claim()` makes it control the first
 *      navigation (otherwise viewed conversations never get cached).
 *   2. Visiting a conversation caches its messages payload.
 *   3. Going offline and reloading still renders the cached conversation
 *      (NetworkFirst in sw.js falls back to the cached response).
 *
 * This is the regression test for the user-reported production issue
 * ("conversation can be clicked, but it makes a request as usual and
 * that one fails silently" while offline).
 */

const test = baseTest.extend({
    // eslint-disable-next-line no-empty-pattern
    context: async ({ browser }, use) => {
        const context = await browser.newContext({ serviceWorkers: "allow" });
        await use(context);
        await context.close();
    },
});

test.describe("service worker offline caching", () => {
    test("SW controls first navigation and serves cached conversation when offline", async ({
        page,
        context,
    }, testInfo) => {
        await setupTestUser(context, testInfo);
        await page.goto("/");
        await page.waitForSelector("main-page");
        // Give sw-register.js time to register + the SW time to install,
        // activate, and claim this client.
        await page.waitForTimeout(1500);

        // SW must be controlling the page (clients.claim in activate).
        const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
        expect(controlled, "navigator.serviceWorker.controller should be set").toBe(true);

        // Reload once ONLINE so the SW intercepts every static + API GET
        // (the very first navigation races the SW install and bypasses
        // it; without this warm-up the offline reload below can't fall
        // back to cached static assets).
        await page.reload();
        await page.waitForSelector("main-page");
        await page.waitForTimeout(1000);

        // Visit the first seeded conversation so its messages GET goes
        // through the SW and lands in the pwa-v1-api-data cache.
        const sidebar = page.locator("chat-sidebar");
        await expect(sidebar.locator("conversation-item")).not.toHaveCount(0);
        await sidebar.locator("conversation-item").first().click();
        await page.waitForLoadState("networkidle");

        const cachedAfterVisit = await page.evaluate(async () => {
            const cache = await caches.open("pwa-v1-api-data");
            const keys = await cache.keys();
            return keys.some((k) => /\/api\/conversations\/[^/]+\/messages$/.test(k.url));
        });
        expect(cachedAfterVisit, "conversation messages should be cached after visit").toBe(true);

        // Go offline and reload. The SW serves the cached app shell,
        // static assets, current-user, conversation list, and the active
        // conversation's messages.
        await context.setOffline(true);
        await page.reload({ waitUntil: "domcontentloaded" });

        // main-page mounts, fetches /api/conversations and the active conv's
        // messages — both served by the SW from cache.
        await page.waitForSelector("chat-message", { timeout: 10000 });
        const messageCount = await page.locator("chat-message").count();
        expect(messageCount).toBeGreaterThan(0);
    });
});
