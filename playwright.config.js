import { defineConfig, devices } from "playwright/test";

// oxlint-disable-next-line import/no-default-export -- required by Playwright
export default defineConfig({
    testDir: "./vrtests",
    fullyParallel: true,
    retries: 2,
    snapshotDir: "./vrtests/__snapshots__",
    use: {
        baseURL: "http://localhost:3000",
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "bun run start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
    },
});
