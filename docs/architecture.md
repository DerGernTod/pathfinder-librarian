# Architecture

## Overview

No-build ESM web app: Hono server (Bun runtime) serving a Lit-component client. No bundler — the browser resolves imports via `esm.sh` CDN (see `client/index.html` import map).

```
server/index.js   — Hono app, Bun entrypoint, serves static client files
client/           — Lit web components (no build, loaded directly by browser)
  index.html      — import map maps lit/hono to esm.sh CDN URLs
  pages/          — Lit element components (one component per file)
  utils/          — RPC client and shared utilities
shared/           — intended for types/schemas shared between server and client
```

## Hono RPC type sharing

`server/index.js` exports `@typedef {typeof app} App`. The client imports this type in `client/utils/rpc-client.js` via JSDoc to get end-to-end type safety on RPC calls. When adding server routes, the `App` typedef propagates automatically.

## Lit component pattern

Custom elements use named exports with functional decorator style — e.g. `customElement("main-page")(MainPage)` — because `no-default-export` is an error rule in oxlint. Do not use `@customElement` decorator or default exports.

Export pattern:

```js
customElement("main-page")(MainPage);
export { MainPage };
```

## Shoelace via esm.sh

Shoelace components are imported as side-effect imports from `esm.sh` with `?deps=lit@3.3.2` to ensure a single Lit instance is shared (avoids duplicate Lit registration errors). The dark theme stylesheet is loaded in `index.html`.

**Import pattern** — cherry-pick each component directly in the file that uses it. No import map entries needed:

```js
import "https://esm.sh/@shoelace-style/shoelace@2.20.1/dist/components/input/input.js?deps=lit@3.3.2";
```

**Component path convention** — `dist/components/<name>/<name>.js` (e.g. `card/card.js`, `details/details.js`, `spinner/spinner.js`).

**Side-effect only** — these imports register the custom element (`<sl-input>`, `<sl-card>`, etc.). Do not destructure or alias them.

**Events** — Shoelace fires custom events prefixed with `sl-` (e.g. `sl-input`, `sl-change`, `sl-focus`). Use `e.target.value` to read the current value.

## Hono RPC call signatures

The Hono RPC client is typed via JSDoc from `client/utils/rpc-client.js`. Call patterns:

```js
// GET with no params
client.api.conversations.$get()

// POST with JSON body
client.api.conversations.$post({ json: { title: "..." } })

// Parameterized routes: GET with path param
client.api.conversations[":id"].messages.$get({ param: { id: convId } })

// Parameterized routes: POST with path param + JSON body
client.api.conversations[":id"].messages.$post(
    { param: { id: convId }, json: { content: "...", mode: this.mode } },
    { init: { signal: controller.signal } },
)
```

All RPC methods return raw `Response` objects — call `.json()` for JSON endpoints or access `.body` (ReadableStream) for SSE/streaming endpoints.
