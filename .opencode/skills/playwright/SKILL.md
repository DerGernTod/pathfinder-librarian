---
name: playwright
description: Use whenever writing or debugging Playwright visual regression tests
---

# Playwright visual regression test gotchas

## Auth setup pattern (per-test user isolation)

Each test gets its own user via `setupTestUser` helper (`vrtests/helpers/test-user.js`). DB reset happens once in `globalSetup`, not per-test:

```js
import { setupTestUser } from "./helpers/test-user.js";

test.beforeEach(async ({ page, context }, testInfo) => {
    await setupTestUser(context, testInfo);
    await page.goto("/");
    await page.waitForSelector("main-page");
    await page.waitForTimeout(1000);
});
```

`setupTestUser` calls `ensure-test-user` (idempotent, creates user + seeds conversations) then `quick-login`, then sets the session cookie on the browser context.

**Never call `reset-db` from individual tests.** Only `global-setup.js` calls it once before all workers.

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

## Landing view vs chat-view selectors

The app shows `<landing-view>` when `isLanding` (no messages loaded) and `<chat-view>` otherwise. These use **different input elements**:

| State   | Input element                      | Selector                      |
| ------- | ---------------------------------- | ----------------------------- |
| Landing | `<input class="landing-prompt">`   | `[data-test='landing-input']` |
| Chat    | `<textarea>` inside `<chat-input>` | `chat-input textarea`         |

**`isLanding` checks `filteredMessages.length === 0`, not conversations.** Returning a conversation in the mock list does NOT switch to chat-view. To stay in chat-view, either:

- Seed messages (return non-empty messages list), or
- Use the landing input selector and let the submit transition to chat-view

If mocking conversations to empty and using landing input, the submit flow is: `landing-input` → Enter → creates conversation → sends message → SSE response → chat-view appears. Use `waitForSelector("stat-block")` or similar after submit instead of `waitForTimeout`.

## Deterministic UUID v4 for test isolation

The `setupTestUser` helper derives a UUID v4 from `testInfo.titlePath`. When building similar hashing:

```
UUID v4 layout (32 hex chars → 36 chars with hyphens):
  xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx

Hex positions consumed:
  0..7   → group 1 (8 chars)
  8..11  → group 2 (4 chars)
  12     → SKIPPED (version nibble = 4)
  13..15 → group 3 suffix (3 chars)
  16     → SKIPPED (variant nibble = 8/9/a/b)
  17..19 → group 4 suffix (3 chars)
  20..31 → group 5 (12 chars)
```

**Gotcha:** slice offsets must account for the two nibble positions. Using `hex.slice(16,19)` instead of `hex.slice(17,20)` shifts all subsequent bytes, producing invalid UUIDs that fail Zod `z.string().uuid()` validation (HTTP 400).

## Shoelace `sl-details` click pattern

`<sl-details>` is a Shoelace component with Shadow DOM. When a stat block renders multiple `sl-details` elements (Attributes, Actions, Spells, Abilities), `statBlock.locator("sl-details")` matches ALL of them. Use `.first()` to avoid Playwright strict mode violations:

```js
const statBlock = page.locator("stat-block").first();
await statBlock.locator("sl-details").first().click();
```

## Mocking LLM for deterministic visual regression

Tests that depend on real LLM responses (stat block, navigation, persistence) have non-deterministic rendering. For visual regression, mock the SSE endpoint:

```js
await page.route("**/api/conversations/*/messages*", async (route) => {
    if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        const userMsg = { type: "userMessage", data: { id: "u1", role: "user", content: body.content, ... } };
        const assistantMsg = { type: "assistantComplete", data: { id: "a1", role: "assistant", blocks: [...] } };
        await route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: JSON.stringify(userMsg) + "\n" + JSON.stringify(assistantMsg) + "\n",
        });
    }
});
```

Use `route.request().postDataJSON()` to read the POST body for prompt-aware mocking.

## Snapshot update feedback loop

The `update-snapshots.yml` workflow runs `bun run e2e -- --update-snapshots`. If e2e tests fail (timeouts, broken selectors), snapshot regeneration also fails — the workflow can't commit updated baselines. Always run e2e locally first to verify all tests pass before triggering the workflow.

## Common failures

| Symptom                                 | Likely cause                            | Fix                                                       |
| --------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| Snapshot mismatch                       | Animations/transitions running          | Add animation-disabling CSS                               |
| `page.accessibility.snapshot` undefined | Older Playwright version                | Use DOM-based a11y assertions instead                     |
| Route not intercepting                  | Method mismatch (GET vs POST)           | Check `route.request().method()`                          |
| `body.getReader` crashes                | `route.fulfill` creates null body       | Ensure `contentType: "text/event-stream"` and string body |
| Landing page never shows                | Seeded user has conversations           | Intercept `GET /api/conversations` to return `data: []`   |
| `chat-input textarea` times out         | Landing view shown instead of chat-view | Use `[data-test='landing-input']` or seed messages        |
| `ensure-test-user` returns 400          | Invalid UUID format                     | Verify UUID v4 nibble offsets correct                     |
| `sl-details` click fails                | Multiple `sl-details` match             | Use `.first()`                                            |
| Real LLM snapshots flaky                | LLM response varies per run             | Mock SSE endpoint with fixed response                     |
| Snapshot update workflow fails          | E2e tests broken                        | Fix tests locally, push, then re-trigger workflow         |
