# Gotchas

Framework and platform pitfalls that don't behave as you'd expect. Each entry explains the underlying API behavior, not just the project-specific fix.

## Shoelace wraps native elements — internal state can diverge

Shoelace components like `<sl-textarea>` and `<sl-input>` wrap a native `<textarea>` or `<input>` inside their own shadow DOM. Setting the Shoelace element's `.value` property updates the wrapper, but the native inner element may not reflect the change — especially when the value is reset to `""` after a submit.

This is standard web component behavior: a wrapper component owns its internal DOM and may not re-sync when a property is set to the same value it already has, or when its internal state was mutated by user input.

**Pattern**: Use Lit's `updated()` lifecycle to imperatively sync after every render:

```js
updated() {
    const sl = this.shadowRoot?.querySelector("sl-textarea");
    if (sl && sl.value !== this.value) {
        sl.value = this.value;
    }
}
```

See `client/components/chat-input.js` for the project example.

## Shadow DOM event propagation — re-dispatching causes double-fires

A `CustomEvent` with `{ bubbles: true, composed: true }` crosses shadow DOM boundaries per the DOM spec. If a component listens for an event and then dispatches a _new_ event in response, the ancestor receives both: the original (still bubbling) and the re-dispatched one.

This is not a Lit or Shoelace issue — it's how `EventTarget.dispatchEvent()` works. The original event continues propagating unless `stopPropagation()` is called.

**Pattern**: When re-dispatching, stop the original:

```js
handleToggle(e) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("toggle-sidebar", {
        detail: { expanded: !this._uiState.sidebarExpanded },
        bubbles: true,
        composed: true,
    }));
}
```

## Mobile viewport — `100dvh` doesn't restore after keyboard dismiss

`100dvh` reflects the "largest" viewport that excludes browser chrome, but mobile Safari and Chrome handle the transition differently when the on-screen keyboard opens and closes. On some browsers, the value doesn't restore correctly after the keyboard dismisses, leaving the layout shorter than the actual viewport.

**Pattern**: Use `window.visualViewport.height` with a `resize` listener:

```js
if (window.visualViewport) {
    const vv = window.visualViewport;
    const onResize = () => {
        this.style.height = `${vv.height}px`;
    };
    vv.addEventListener("resize", onResize);
    onResize();
}
```

Set `overflow: hidden; height: 100%` on `html` and `body` to prevent document-level scrolling. Use `height: 100vh` as a static CSS fallback for non-mobile browsers.

See `client/pages/main-page.js` for the project example.

## Shoelace events — `sl-*` prefix, not native

Shoelace components fire custom events prefixed with `sl-` (e.g. `sl-input`, `sl-change`, `sl-focus`). These are distinct from native DOM events — a native `input` event on an `<sl-input>` won't fire Shoelace's `sl-input` handler.

**Pattern**: Use `e.target.value` to read the current value from Shoelace event handlers. For Playwright tests, prefer clicking buttons over simulating keyboard events on Shoelace-controlled inputs, since native `keydown` events may not propagate through Shoelace's internal event system.

## Lit `firstUpdated` is async — `updateComplete` doesn't cover it

`firstUpdated()` runs after the first render, but any async work inside it (e.g. `fetch()`) is not awaited by `updateComplete`. Tests that need `firstUpdated`'s async work to finish must use a timeout:

```js
document.body.appendChild(element);
await new Promise((r) => setTimeout(r, 100));
```

See `docs/testing.md` for more test patterns.
