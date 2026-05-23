/**
 * Mocks the `/api/auth/api-key-status` endpoint to return `{ available: true }`.
 * Prevents the warning icon from appearing in chat-input during VR tests
 * where GOOGLE_AI_API_KEY is not set in CI.
 *
 * @param {import("playwright/test").Page} page
 */
export async function mockApiKeyStatusAvailable(page) {
    await page.route("**/api/auth/api-key-status", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                result: "success",
                data: { available: true, reason: "ok" },
            }),
        });
    });
}
