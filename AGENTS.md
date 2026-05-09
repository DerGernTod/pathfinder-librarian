# AGENTS.md

## Project overview

No-build ESM web app: Hono server (Bun runtime) serving a Lit-component client. See `docs/architecture.md` for details.

## Commands

- `bun run start` — dev server with hot reload
- `bun run test` — run unit tests (Bun)
- `bun run check` — TypeScript typecheck (`tsgo -p jsconfig.json --noEmit`)
- `bunx oxlint .` — lint
- `bunx oxfmt . --check` — check formatting; `bunx oxfmt .` to write
- `bunx playwright test` — visual regression tests
- `bunx playwright test --update-snapshots` — regenerate baselines

## Architecture

```
server/index.js   — Hono app, Bun entrypoint
client/           — Lit web components (no build)
  pages/          — page-level components
  components/     — reusable components
  utils/          — RPC client, auth, styles
shared/           — types/schemas shared between server and client
```

Full architecture and patterns in `docs/architecture.md`.

## Lint & formatting rules

- **`no-default-export: error`** — always use named exports
- **`no-explicit-any: error`** (`fixToUnknown: true`) — use `unknown`
- **`eqeqeq: error`**, **`curly: error`** — strict equality, always use braces
- **`no-console: warn`**
- Format: 4-space indent, double quotes, semicolons, trailing commas, printWidth 100, LF

## Conventions

- Types via JSDoc only — no `.ts` files
- Lit components: `customElement("name")(Class); export { Class };`
- Server routes: Hono chaining with `zValidator`
- Zod schemas in `shared/` for reuse
- Aria labels for elements without visual labels

### Shoelace component state

Shoelace components (`sl-textarea`, `sl-input`, etc.) maintain internal state that does NOT sync from Lit property bindings back to their native inner elements. Setting `.value` on the host Lit element triggers a re-render that sets the Shoelace property, but the native `<textarea>`/`<input>` inside Shoelace's shadow DOM may not update.

**Fix**: Use the `updated()` lifecycle to force-sync:

```js
updated() {
    const sl = this.shadowRoot?.querySelector("sl-textarea");
    if (sl && sl.value !== this.value) {
        sl.value = this.value;
    }
}
```

For Playwright tests, prefer clicking send buttons over `page.keyboard.press("Enter")` on Shoelace-controlled textareas — Enter keydown may not propagate through Shoelace's event system reliably.

### Event architecture

Custom events that cross shadow DOM boundaries MUST use `bubbles: true, composed: true`. Key events:

| Event            | Dispatched by                                                          | Caught by (in main-page)                                         |
| ---------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `toggle-sidebar` | `sidebar-toggle`, `chat-header` hamburger, `chat-sidebar.handleToggle` | `@toggle-sidebar` on `<chat-sidebar>` AND `<chat-view>`          |
| `new-chat`       | `new-chat-button`                                                      | `@new-chat` on `<chat-sidebar>`, `<chat-view>`, `<landing-view>` |
| `mode-change`    | `mode-toggle` (via `chat-header`)                                      | `@mode-change` on `<chat-view>`, `<landing-view>`                |
| `send-message`   | `chat-input`                                                           | `@send-message` on `<chat-view>`                                 |

**Warning**: When `chat-sidebar.handleToggle` catches `toggle-sidebar` and re-dispatches a new event, call `e.stopPropagation()` on the original to prevent both events from reaching `main-page.handleSidebarToggle` and toggling twice (open → close → open).

### View state machine

`_viewState` transitions: `"loading"` → `"landing"` | `"conversation"`. The `_isNewChat` flag marks ephemeral new-chat state. It MUST be reset to `false` when:

- `handleLandingSubmit` creates a conversation (the conversation now exists)
- `_handleFirstMessage` creates a conversation
- `handleSelectConversation` switches to an existing conversation (`convId !== "__new__"`)

## Responsive design

Three breakpoints: phone (<768px), tablet (768–1024px), desktop (>1024px). Breakpoint state flows through `uiContext` via `UIState.breakpoint`.

Any UI change that affects layout must:

- Consider all 3 viewport sizes
- Include VR tests for each relevant viewport (phone 375×812, tablet 768×1024, desktop 1280×800)
- Use `@media` queries inside component static styles (work inside Shadow DOM)
- Test sidebar behavior (hidden/overlay on phone, collapsed on tablet, expanded on desktop)

### Mobile viewport (keyboard handling)

Do NOT use `height: 100dvh` in CSS — it does not reliably restore on all mobile browsers after the on-screen keyboard dismisses. Instead, `main-page.js` uses `window.visualViewport.height` via a JS listener on `visualViewport.resize`. The CSS `:host` uses `height: 100vh` as a static fallback. `html` and `body` have `overflow: hidden; height: 100%` to prevent document-level scrolling.

## Testing

See `docs/testing.md` for unit test patterns, mocking, happy-dom limitations, and SSE event names. Load the `playwright` skill for visual regression test gotchas. Load the `testing` skill for test writing best practices.

### Per-test user isolation (Playwright)

Each Playwright test gets its own user via `setupTestUser(context, testInfo)` from `vrtests/helpers/test-user.js`. The helper:

1. Generates deterministic UUID v4 from `testInfo.titlePath` (djb2-style multi-accumulator hash)
2. Calls `POST /api/test/ensure-test-user` (idempotent) — creates user + seeds conversations
3. Calls `POST /api/auth/quick-login` and sets session cookie

`global-setup.js` resets the DB once before all workers via `POST /api/test/reset-db`. Individual tests must NOT call `reset-db`.

DB seed functions: `clearAllTables(db)`, `seedRuleItems(db)`, `seedForUser(db, userId, mode)` — all idempotent.
