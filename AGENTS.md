# AGENTS.md

## Project overview

No-build ESM web app: Hono server (Bun runtime) serving a Lit-component client. No bundler — the browser resolves imports via `esm.sh` CDN (see `client/index.html` import map).

## Commands

- `bun run start` — dev server with hot reload (`bun run --hot ./server/index.js --development`)
- `bun run test` — run tests via vitest (single run, not watch)
- `bunx oxlint .` — lint
- `bunx oxfmt . --check` — check formatting; `npx oxfmt .` to write
- `bunx playwright test` — visual regression tests (Playwright)
- `bunx playwright test --update-snapshots` — regenerate baselines

No separate typecheck command — `jsconfig.json` enables `checkJs` + `strict` for VS Code / editor inline checking. TypeScript is a devDependency only for the language service, not for compilation.

## Architecture

```
server/index.js   — Hono app, Bun entrypoint, serves static client files
client/           — Lit web components (no build, loaded directly by browser)
  index.html      — import map maps lit/hono to esm.sh CDN URLs
  pages/          — Lit element components (one component per file)
  utils/          — RPC client and shared utilities
shared/           — intended for types/schemas shared between server and client
```

### Hono RPC type sharing

`server/index.js` exports `@typedef {typeof app} App`. The client imports this type in `client/utils/rpc-client.js` via JSDoc to get end-to-end type safety on RPC calls. When adding server routes, the `App` typedef propagates automatically.

### Lit component pattern

Custom elements use named exports with functional decorator style — e.g. `customElement("main-page")(MainPage)` — because `no-default-export` is an error rule in oxlint. Do not use `@customElement` decorator or default exports.

### Shoelace via esm.sh

Shoelace components are imported as side-effect imports from `esm.sh` with `?deps=lit@3.3.2` to ensure a single Lit instance is shared (avoids duplicate Lit registration errors). The dark theme stylesheet is loaded in `index.html`.

**Import pattern** — cherry-pick each component directly in the file that uses it. No import map entries needed:

```js
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/input/input.js?deps=lit@3.3.2";
```

**Component path convention** — `dist/components/<name>/<name>.js` (e.g. `card/card.js`, `details/details.js`, `spinner/spinner.js`).

**Side-effect only** — these imports register the custom element (`<sl-input>`, `<sl-card>`, etc.). Do not destructure or alias them.

**Events** — Shoelace fires custom events prefixed with `sl-` (e.g. `sl-input`, `sl-change`, `sl-focus`). Use `e.target.value` to read the current value.

## Lint & formatting rules (non-obvious)

- **`no-default-export: error`** — always use named exports (server entry has an oxlint-disable comment for Hono's requirement)
- **`no-explicit-any: error`** with `fixToUnknown: true` — use `unknown` instead of `any`
- **`eqeqeq: error`**, **`curly: error`** — strict equality, always use braces
- **`no-console: warn`**
- Format: 4-space indent, double quotes, semicolons, trailing commas, printWidth 100, LF line endings

## Testing

- **Unit tests**: Bun test runner (`bun test`) — prefer over vitest where possible. Lit component tests likely need happy-dom for DOM APIs.
- **Visual regression tests**: Playwright — config in `playwright.config.js`, tests in `vrtests/`, snapshots in `vrtests/__snapshots__/`. Uses Chromium only. Dev server auto-started.
- TDD is encouraged — write tests first when adding features. Target high coverage.

---

### ⚠️ CRITICAL: Visual Regression Tests

Whenever implementing UI-related changes, you **MUST** add visual regression tests.

**UI Changes Include:**
- New or modified Lit components
- CSS/styling changes (layout, spacing, colors, transitions)
- State-driven UI changes (collapsed/expanded, toggles, hover/active states)
- Icon or component positioning changes
- Any change affecting the visual appearance of the application

**Requirements:**
- Add tests to `vrtests/` directory following existing patterns
- Test all relevant states (default, collapsed/expanded, hover, active, etc.)
- Use `toHaveScreenshot()` with appropriate selectors
- Reference `vrtests/main-page.spec.js` for examples

**Commands:**
- `bunx playwright test` — run visual regression tests
- `bunx playwright test --update-snapshots` — regenerate baselines

**Failure to add visual regression tests for UI changes is considered a bug and will be rejected.**

## Conventions

- Clean code: single responsibility, principle of least knowledge, minimal dependencies. Follow Uncle Bob's practices.
- Idiomatic functional JS — no classes where a function suffices.
- Types via JSDoc only — no `.ts` files.
- Server routes use Hono chaining with `zValidator` for request validation.
- Zod schemas in shared/ for reuse across server and client.
