import { defineConfig, devices } from "playwright/test";

// oxlint-disable-next-line import/no-default-export -- required by Playwright
export default defineConfig({
    testDir: "./vrtests",
    fullyParallel: true,
    retries: 2,
    snapshotDir: "./vrtests/__snapshots__",
    globalSetup: "./vrtests/global-setup.js",

    use: {
        baseURL: "http://localhost:3000",
        trace: "on-first-retry",
        // Block service worker registration so test mocks (page.route /
        // context.route) are not bypassed by SW-initiated fetches. With
        // clients.claim() active in sw.js, the SW would otherwise intercept
        // API GETs and its own fetch() calls would skip Playwright's
        // page.route handlers. The page-side Cache API writes still happen,
        // so pwa-offline specs continue to exercise the offline UI.
        serviceWorkers: "block",
        launchOptions: {
            args: [
                "--disable-blink-features=LayoutAnimations",
                "--font-render-hinting=none",
                "--disable-font-subpixel-positioning",
                "--disable-lcd-text",
                "--disable-threaded-scrolling",
                "--disable-gpu",
            ],
        },
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    expect: {
        toHaveScreenshot: {
            threshold: 0.0001,
        },
        toMatchSnapshot: {
            threshold: 0.0001,
        },
    },
    webServer: {
        command: "ENABLE_MOCK_FALLBACK=true bun run start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
    },
});
