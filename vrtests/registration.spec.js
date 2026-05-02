import { expect, test } from "playwright/test";

/** @param {import("playwright/test").Page} page @param {import("playwright/test").BrowserContext} context */
async function setupVirtualAuthenticator(page, context) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    const addResult = await cdp.send("WebAuthn.addVirtualAuthenticator", {
        options: {
            protocol: "ctap2",
            transport: "internal",
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
        },
    });
    return { cdp, authenticatorId: addResult.authenticatorId };
}

test.describe("passkey registration", () => {
    test("register new user with passkey", async ({ page, context }) => {
        const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
        expect(res.ok).toBe(true);

        const { cdp, authenticatorId } = await setupVirtualAuthenticator(page, context);

        await page.goto("/");
        await page.waitForSelector("login-page");

        const nameInput = page.locator("login-page").locator("sl-input").locator("input");
        await nameInput.fill("Test New User");

        const verifyPromise = page.waitForResponse((resp) =>
            resp.url().includes("/api/auth/register/verify"),
        );

        const registerButton = page
            .locator("login-page")
            .locator('sl-button:has-text("Create Account")');
        await registerButton.click();

        const verifyResponse = await verifyPromise;
        expect(verifyResponse.ok()).toBe(true);

        const body = await verifyResponse.json();
        expect(body.result).toBe("success");
        expect(body.data.user).toBeDefined();
        expect(body.data.user.name).toBe("Test New User");

        await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    });
});

test.describe("passkey sign-in", () => {
    test("sign in with registered passkey", async ({ page, context }) => {
        const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
        expect(res.ok).toBe(true);

        const { cdp, authenticatorId } = await setupVirtualAuthenticator(page, context);

        await page.goto("/");
        await page.waitForSelector("login-page");

        const nameInput = page.locator("login-page").locator("sl-input").locator("input");
        await nameInput.fill("Test Signin User");

        const registerVerifyPromise = page.waitForResponse((resp) =>
            resp.url().includes("/api/auth/register/verify"),
        );
        const registerButton = page
            .locator("login-page")
            .locator('sl-button:has-text("Create Account")');
        await registerButton.click();
        const registerRes = await registerVerifyPromise;
        expect(registerRes.ok()).toBe(true);

        await page.waitForSelector("main-page");

        await context.clearCookies();
        await page.reload();
        await page.waitForSelector("login-page");

        const loginFinishPromise = page.waitForResponse((resp) =>
            resp.url().includes("/api/auth/login/finish"),
        );
        const signInButton = page
            .locator("login-page")
            .locator('sl-button:has-text("Sign in with Passkey")');
        await signInButton.click();
        const loginRes = await loginFinishPromise;
        expect(loginRes.ok()).toBe(true);

        const loginBody = await loginRes.json();
        expect(loginBody.result).toBe("success");
        expect(loginBody.data.user).toBeDefined();
        expect(loginBody.data.user.name).toBe("Test Signin User");

        await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    });
});
