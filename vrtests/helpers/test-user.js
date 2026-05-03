/**
 * Shared helper for Playwright tests to create isolated test users.
 *
 * Each test gets its own user identified by a deterministic UUID v4 derived
 * from the test's file path + title, ensuring idempotency across retries.
 */

/**
 * Simple pure-JS string hash producing 32 hex characters (128 bits).
 * Uses four independent 32-bit accumulators to avoid collisions.
 * @param {string} str
 * @returns {string} 32 hex characters
 */
function stringHash(str) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    let h3 = 0xd4e8f73a;
    let h4 = 0xcafebabe;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
        h3 = Math.imul(h3 ^ ch, 3266489917);
        h4 = Math.imul(h4 ^ ch, 2246822507);
    }
    const toHex = /** @param {number} h */ (h) => (h >>> 0).toString(16).padStart(8, "0");
    return toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
}

/**
 * Derives a deterministic UUID v4 from test info.
 * @param {import("playwright/test").TestInfo} testInfo
 * @returns {string} UUID v4 string
 */
function deterministicUUID(testInfo) {
    const input = testInfo.titlePath.join("::");
    const hex = stringHash(input);
    // Format: xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx (UUID v4)
    return (
        hex.slice(0, 8) +
        "-" +
        hex.slice(8, 12) +
        "-4" +
        hex.slice(13, 16) +
        "-8" +
        hex.slice(16, 19) +
        "-" +
        hex.slice(19, 32)
    );
}

/**
 * Creates (or reuses) a dedicated test user for the current test and logs in.
 *
 * @param {import("playwright/test").BrowserContext} context - Playwright browser context
 * @param {import("playwright/test").TestInfo} testInfo - Playwright test info
 * @param {"gm" | "player"} [mode="gm"] - User mode
 * @returns {Promise<{ userId: string, name: string }>}
 */
export async function setupTestUser(context, testInfo, mode = "gm") {
    const userId = deterministicUUID(testInfo);
    const name = testInfo.titlePath[testInfo.titlePath.length - 1];

    // Create (or get) the test user with seeded conversations
    const ensureRes = await fetch("http://localhost:3000/api/test/ensure-test-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name, mode }),
    });
    if (!ensureRes.ok) {
        throw new Error(`ensure-test-user failed: ${ensureRes.status}`);
    }

    // Quick-login as this user
    const loginRes = await fetch("http://localhost:3000/api/auth/quick-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
    });
    if (!loginRes.ok) {
        throw new Error(`quick-login failed: ${loginRes.status}`);
    }

    // Extract session token from Set-Cookie header and add to browser context
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

    return { userId, name };
}
