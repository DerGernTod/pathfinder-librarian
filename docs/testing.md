# Testing patterns

## Test mocking pattern

Existing tests mock `globalThis.fetch` via `bun:test`'s `mock()`, not `client.api.*` methods. The Hono RPC client calls `fetch` internally, so mocking fetch intercepts all RPC calls. Mock return shapes must match real API responses:

```js
// Conversation responses: { result: "success", data: {...} }
mock(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result: "success", data: mockData }),
    }),
);

// SSE stream responses: ReadableStream body
mock(() =>
    Promise.resolve({
        ok: true,
        body: new ReadableStream({
            start(c) {
                c.enqueue(chunk);
                c.close();
            },
        }),
    }),
);
```

## happy-dom limitations

- `document.activeElement` does not reliably reflect `element.focus()` for shadow DOM elements. Prefer asserting element exists and has a `focus` method rather than checking `activeElement`.
- `element.focus()` may not work on custom elements — test the underlying native element (e.g., `<input>`) inside the shadow root.
- When comparing DOM elements, use strict equality to avoid timeout issues from logging huge DOM trees: `expect(elem1 === elem2).toBeTrue(true)` instead of `expect(elem1).toBe(elem2)`.

## Lit firstUpdated async wait pattern

`firstUpdated()` runs asynchronously after the first render cycle. `await element.updateComplete` does NOT wait for `firstUpdated`'s internal async work. To wait for `firstUpdated` to finish:

```js
// After appending to DOM
document.body.appendChild(element);
// Wait for firstUpdated's async fetch to resolve
await new Promise((r) => setTimeout(r, 100));
// Now loading is false, state is settled
```

## SSE event type names

The server emits SSE events via newline-delimited JSON with the following `type` field values (camelCase):

- `"userMessage"` — user message data
- `"assistantChunk"` — streaming assistant block (incremental)
- `"assistantComplete"` — final assistant message object

These are processed in `handleSendMessage` (main-page.js).

## Unit test runner

Run unit tests with `bun run test` (Bun test runner). Tests use happy-dom for DOM APIs. Follow existing test patterns in `client/pages/*.test.js` and `client/components/*.test.js`.

When writing tests:

- Consolidate tests with same GIVEN/WHEN, differing THEN only
- Test production code — never implement logic inside a test
- Never export internals just for testing
- Use bun's `mock()` function for assertions and stubs
