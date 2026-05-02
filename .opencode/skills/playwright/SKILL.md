---
name: playwright
description: Use whenever writing or debugging Playwright visual regression tests
---

# Playwright visual regression test gotchas

## Auth setup pattern

Visual tests use server-side auth, not localStorage. Follow existing pattern (see `vrtests/main-page.spec.js`):

```js
test.beforeEach(async ({ page, context }) => {
    // 1. Reset DB to clean seeded state
    const res = await fetch("http://localhost:3000/api/test/reset-db", { method: "POST" });
    expect(res.ok).toBe(true);

    // 2. Quick-login as seed user
    const loginRes = await fetch("http://localhost:3000/api/auth/quick-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "00000000-0000-4000-8000-000000000001" }),
    });
    expect(loginRes.ok).toBe(true);

    // 3. Extract session token cookie
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

    // 4. Navigate and wait
    await page.goto("/");
    await page.waitForSelector("main-page");
    await page.waitForTimeout(1000);
});
```

**Never use `localStorage.clear()` for data state.** Data comes from the server API. Use `page.route()` to intercept API calls instead.

## API interception for empty state

Conversations come from server API, not localStorage. To simulate empty state, intercept the API:

```js
await page.route("**/api/conversations*", async (route) => {
    if (route.request().method() === "GET") {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ result: "success", data: [] }),
        });
    } else if (route.request().method() === "POST") {
        // For POST, mock a created conversation response
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                result: "success",
                data: { id: "mock-id", title: "...", userId: "...", createdAt: "..." },
            }),
        });
    } else {
        await route.continue();
    }
});
```

**Always check `route.request().method()`** — GET vs POST on the same URL pattern need different responses.

## SSE stream mocking

For endpoints that return SSE streams, `route.fulfill` with a string body works because browsers expose `Response.body` as a ReadableStream wrapping string content. Use newline-delimited JSON:

```js
await page.route("**/api/conversations/*/messages*", async (route) => {
    if (route.request().method() === "POST") {
        await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: [
                JSON.stringify({ type: "userMessage", data: { id: "u1", role: "user", ... } }),
                JSON.stringify({ type: "assistantComplete", data: { id: "a1", role: "assistant", ... } }),
            ].join("\n"),
        });
    } else {
        await route.continue();
    }
});
```

## Animation disabling

Disable all animations and transitions before taking snapshots for deterministic results:

```js
await page.evaluate(() => {
    const s = document.createElement("style");
    s.textContent =
        "*, *::before, *::after { animation: none !important; transition: none !important; }";
    document.head.appendChild(s);
});
```

## Selector patterns

Prefer stable selectors:

- `data-test` attributes added to Lit components for test targeting
- `aria-label` attributes for accessible elements
- `role` attribute selectors (e.g., `[role="region"]`)
- Avoid: CSS class selectors (`.class-name`) or deeply nested selectors

## Accessibility assertions

Check accessibility by asserting DOM elements with correct roles and labels:

```js
await expect(page.locator('[role="region"][aria-label="Welcome"]')).toBeVisible();
await expect(page.locator('[data-test="landing-input"]')).toHaveAttribute(
    "aria-label",
    "Type your first prompt",
);
```

## Snapshot conventions

- Snapshots stored in `vrtests/__snapshots__/` matching the test file name
- Use `fullPage: true` for full page captures
- Never reduce `maxDiffPixelRatio` below default — use `--update-snapshots` to regenerate
- Run with `bunx playwright test --update-snapshots` to generate baselines
- CI runs on Linux; local runs on Windows — snapshots include platform suffix (`-chromium-win32.png` vs `-chromium-linux.png`)

## Common failures

| Symptom                                 | Likely cause                      | Fix                                                       |
| --------------------------------------- | --------------------------------- | --------------------------------------------------------- |
| Snapshot mismatch                       | Animations/transitions running    | Add animation-disabling CSS                               |
| `page.accessibility.snapshot` undefined | Older Playwright version          | Use DOM-based a11y assertions instead                     |
| Route not intercepting                  | Method mismatch (GET vs POST)     | Check `route.request().method()`                          |
| `body.getReader` crashes                | `route.fulfill` creates null body | Ensure `contentType: "text/event-stream"` and string body |
| Landing page never shows                | Seeded user has conversations     | Intercept `GET /api/conversations` to return `data: []`   |
