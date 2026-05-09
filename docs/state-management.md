# State management

How UI state, view transitions, and events flow through the app. For framework-specific pitfalls, see `docs/gotchas.md`.

## Context providers

The app uses Lit's `createContext` / `ContextProvider` / `ContextConsumer` pattern. All contexts are defined in `client/stores/`.

### uiContext (`ui-store.js`)

Single provider in `main-page.js`. All consumers use `subscribe: true` to re-render on state changes.

**UIState shape:**

| Field             | Type                               | Purpose                      |
| ----------------- | ---------------------------------- | ---------------------------- |
| `sidebarExpanded` | `boolean`                          | Sidebar open/collapsed state |
| `settingsOpen`    | `boolean`                          | Settings dialog visibility   |
| `breakpoint`      | `"phone" \| "tablet" \| "desktop"` | Current viewport breakpoint  |

**Consumers:** `chat-sidebar`, `chat-header`, `landing-view`, `settings-dialog`

**Store functions** (pure, return new state): `toggleSidebar()`, `openSettings()`, `closeSettings()`, `setBreakpoint()`

**Breakpoint detection**: Two `matchMedia` queries in `main-page.connectedCallback()` detect `<768px` and `<1024px`. When breakpoint changes, `sidebarExpanded` auto-adjusts (collapses on phone/tablet, expands on desktop).

### Other contexts

| Context               | File                    | Provider       | Consumers                                                                |
| --------------------- | ----------------------- | -------------- | ------------------------------------------------------------------------ |
| `conversationContext` | `conversation-store.js` | `main-page.js` | `chat-sidebar`, `session-list`, `conversation-item`, `conversation-menu` |
| `modeContext`         | `mode-store.js`         | `main-page.js` | `chat-sidebar`, `chat-input`, `mode-toggle`, `sidebar-profile`           |
| `messagesContext`     | `messages-store.js`     | `main-page.js` | `chat-input`, `message-list`                                             |

## View state machine

`main-page.js` controls which view is displayed via `_viewState` and a derived `isLanding` getter.

### Transitions

```
"loading" ──[firstUpdated: conversations empty]──> "landing"
         ──[firstUpdated: conversations exist]──> "conversation"

"landing"      ──[handleNewChat]──────────> "landing"      (reset with _isNewChat=true)
               ──[handleLandingSubmit]────> "conversation"

"conversation" ──[handleNewChat]──────────> "landing"      (_isNewChat=true)
               ──[handleSelectConversation]─> "conversation"
```

Both views are always in the DOM. CSS `.active` class on wrapper divs controls visibility via `opacity`/`transform`/`pointer-events`.

### `_isNewChat` flag

When `true`, `handleSendMessage()` routes through `_handleFirstMessage()` which sends to the `__new__` endpoint to create a new conversation. Must be reset to `false` after a conversation is created:

| Where set `true`  | Where reset `false`                                        |
| ----------------- | ---------------------------------------------------------- |
| `handleNewChat()` | `_handleFirstMessage()` (after API call)                   |
|                   | `handleLandingSubmit()` (after `createConversation()`)     |
|                   | `handleSelectConversation()` (when `convId !== "__new__"`) |

## Event catalog

All custom events use `{ bubbles: true, composed: true }` to cross shadow DOM boundaries. Events are dispatched from the innermost component and caught by `main-page.js` on ancestor elements.

### Core events

| Event                 | Dispatched by                                                                          | Caught by (main-page)                                                  |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `send-message`        | `chat-input`                                                                           | `@send-message` on `<chat-view>`                                       |
| `stop-message`        | `chat-input`                                                                           | `@stop-message` on `<chat-view>`                                       |
| `landing-submit`      | `landing-view`                                                                         | `@landing-submit` on `<landing-view>`                                  |
| `mode-change`         | `mode-toggle` → re-dispatched by `chat-header` or `landing-view`                       | `@mode-change` on `<chat-view>` and `<landing-view>`                   |
| `toggle-sidebar`      | `sidebar-toggle` → re-dispatched by `chat-sidebar`; also `chat-header`, `landing-view` | `@toggle-sidebar` on `<chat-sidebar>`, `<chat-view>`, `<landing-view>` |
| `new-chat`            | `new-chat-button`, `chat-header`, `landing-view`                                       | `@new-chat` on `<chat-sidebar>`, `<chat-view>`, `<landing-view>`       |
| `select-conversation` | `session-list` (from `conversation-item`), `conversation-menu`                         | `@select-conversation` on `<chat-sidebar>`                             |
| `logout`              | `profile-menu` → `sidebar-profile` → `chat-sidebar`                                    | `@logout` on `<chat-sidebar>`                                          |
| `open-settings`       | `profile-menu` → `sidebar-profile` → `chat-sidebar`                                    | `@open-settings` on `<chat-sidebar>`                                   |
| `settings-closed`     | `settings-dialog`                                                                      | `@settings-closed` on `<settings-dialog>`                              |
| `settings-updated`    | `settings-dialog`                                                                      | `@settings-updated` on `<settings-dialog>`                             |
| `account-deleted`     | `settings-dialog`                                                                      | `@account-deleted` on `<settings-dialog>`                              |

### Page-level events

| Event                   | Dispatched by | Caught by                       |
| ----------------------- | ------------- | ------------------------------- |
| `user-logged-out`       | `main-page`   | `app-shell`                     |
| `login-success`         | `login-page`  | `app-shell`                     |
| `conversations-updated` | `main-page`   | `session-list` (document-level) |

### Document-level events

`select-conversation` is also dispatched on `document` by `main-page.handleNewChat()` to notify `chat-input` to clear and focus. `chat-input` listens at the document level for this event.

### Re-dispatch pattern

Some intermediate components catch an event and re-dispatch a modified version (e.g. `chat-sidebar` catches `toggle-sidebar` from `sidebar-toggle` and re-dispatches with `detail: { expanded }`). The re-dispatcher must call `e.stopPropagation()` on the original — see `docs/gotchas.md`.
