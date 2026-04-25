---
name: testing
description: Use whenever writing or running tests
---

Whenever you run tests, pipe the test output into a text file in ./temp. This saves context and enables you to grep important info from it.

Whenever you write tests,

- consolidate tests with the same GIVEN and WHEN, and only a differing THEN
- always test production code, never implement code inside a test that is then tested
- never change production code just so you can test more easily (e.g. never export internal functionality that is not supposed to be used externally)

When testing function execution and arguments, use bun's `mock` function.

Good:

```js
it("emits select-conversation on menu item click", async () => {
    const el = createMenu([{ id: "42", title: "Pick me" }]);
    await el.updateComplete;

    /** @type {import("bun:test").Mock<(arg: CustomEvent<{ id: string }>) => void>} */
    let listener = mock(() => {});
    el.addEventListener("select-conversation", listener);

    const item = /** @type {HTMLElement} */ (
        el.shadowRoot.querySelector('sl-menu-item[value="42"]')
    );
    fireEvent.click(item);
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0][0].detail.id).toBe("42");
});
```

Bad:

```js
it("emits select-conversation on menu item click", async () => {
    const el = createMenu([{ id: "42", title: "Pick me" }]);
    await el.updateComplete;

    let dispatched = false;
    /** @type {any} */
    let detail = null;
    el.addEventListener("select-conversation", (e) => {
        dispatched = true;
        detail = e.detail;
    });

    const item = el.shadowRoot.querySelector('sl-menu-item[value="42"]');
    fireEvent.click(item);
    expect(dispatched).toBe(true);
    expect(detail?.id).toBe("42");
});
```

When comparing DOM elements, use strict equality to avoid timeout issues from logging huge DOM trees:

Good:

```js
expect(elem1 === elem2).toBeTrue(true);
```

Bad:

```js
expect(elem1).toBe(elem2);
```
