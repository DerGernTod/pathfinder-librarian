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

## Testing

See `docs/testing.md` for unit test patterns, mocking, happy-dom limitations, and SSE event names. Load the `playwright` skill for visual regression test gotchas. Load the `testing` skill for test writing best practices.

### Per-test user isolation (Playwright)

Each Playwright test gets its own user via `setupTestUser(context, testInfo)` from `vrtests/helpers/test-user.js`. The helper:

1. Generates deterministic UUID v4 from `testInfo.titlePath` (djb2-style multi-accumulator hash)
2. Calls `POST /api/test/ensure-test-user` (idempotent) — creates user + seeds conversations
3. Calls `POST /api/auth/quick-login` and sets session cookie

`global-setup.js` resets the DB once before all workers via `POST /api/test/reset-db`. Individual tests must NOT call `reset-db`.

DB seed functions: `clearAllTables(db)`, `seedRuleItems(db)`, `seedForUser(db, userId, mode)` — all idempotent.
