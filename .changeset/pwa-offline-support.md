---
bump: minor
---

Add PWA support: service worker caching (app shell, static assets, CDN imports, and read-only conversation data) plus an offline-aware UI that disables prompt submission, new chat, and non-cached session items. The offline indicator lives in chat-header so it stays visible on every breakpoint (the sidebar is hidden by default on phone). Online/offline transition toasts are included as a progressive enhancement, and tapping a disabled control surfaces a "you're offline" toast.

The service worker now `clients.claim()`s on activate so it controls the very first navigation of a session (without this, viewed conversations were never cached and went offline-inaccessible), precaches the app shell at `/` + `/index.js`, falls back to the cached shell when a deep-link navigation is unreachable, and uses NetworkFirst for `/api/auth/me` and per-conversation messages so freshly-submitted data always wins on reload. Manifest link uses `crossorigin="use-credentials"` so auth-tier proxies let the manifest through.

Also fixes pre-existing test failures: pf-description.test.js now imports the component under test, archive-dialog VR snapshots mask the date string so they are stable across days, and a flaky navigation e2e waits for the switched conversation's last message instead of relying on networkidle. Playwright config sets `serviceWorkers: "block"` globally so SW-initiated fetches don't bypass `page.route` mocks; a dedicated `service-worker.spec.js` test overrides that to verify the production offline contract end-to-end.
