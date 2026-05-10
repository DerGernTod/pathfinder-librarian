# Gotchas and Solutions

This document catalogs common issues encountered in the codebase and their solutions.

## 1. Double/Triple Event Fires

**Problem:** Events firing multiple times due to redundant re-dispatch handlers.

**Cause:** Components re-dispatching events that already bubble through Shadow DOM.

**Solution:** Delete redundant re-dispatch handlers. Events from child components that use `bubbles: true, composed: true` already reach parent components without needing re-dispatch.

**Affected components (fixed):**

- `chat-header.js` - removed `handleModeChange`
- `landing-view.js` - removed `handleModeChange`
- `sidebar-profile.js` - removed `handleLogout`, `handleOpenSettings`
- `chat-sidebar.js` - removed `handleLogout`, `handleOpenSettings`

## 2. Test Flakiness

**Problem:** Tests using fragile `setTimeout` workarounds to wait for component initialization.

**Cause:** No standardized way to wait for `firstUpdated` to complete in tests.

**Solution:** Use `this.ready` promise from BaseElement instead of `setTimeout`.

**Before:**

```javascript
await new Promise((r) => setTimeout(r, 100));
```

**After:**

```javascript
await element.ready;
```

**Affected files (fixed):**

- `main-page.test.js` - 11 replacements
- `login-page.test.js` - 1 replacement

## 3. Shoelace Infinite Loops

**Problem:** Infinite loops when Shoelace form components emit events and parent updates component properties.

**Cause:** Unguarded event handlers that update properties, triggering more events.

**Solution:** Use Shoelace sync guards in `shoelaceBindings` static config.

**Example (settings-dialog.js):**

```javascript
static get shoelaceBindings() {
    return {
        inputs: ["nameInput", "modeInput"],
        guards: {
            nameInput: (newVal, oldVal) => newVal !== oldVal,
            modeInput: (newVal, oldVal) => newVal !== oldVal,
        },
    };
}

handleNameInput(e) {
    const newVal = e.target.value;
    const guard = this.constructor.shoelaceBindings?.guards?.nameInput;
    if (!guard || guard(newVal, this.nameInput)) {
        this.nameInput = newVal;
    }
}
```

## 4. Inconsistent Component Patterns

**Problem:** 22 Lit components extending `LitElement` directly with no shared patterns.

**Solution:** Use BaseElement as the foundation for all components.

**Benefits:**

- Standardized ready-state handling via `this.ready`
- Consistent event helpers via `this.redispatch()`
- Shared Shoelace binding configuration

## 5. Missing Ready State

**Problem:** No way to reliably wait for component initialization in tests or async flows.

**Solution:** BaseElement provides `this.ready` promise that resolves after `firstUpdated`.

**Usage:**

```javascript
// In tests
await element.ready;

// In components after attachment
await this.ready;
```
