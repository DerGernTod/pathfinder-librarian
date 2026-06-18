---
bump: minor
---

Add PWA support: service worker caching (app shell, static assets, CDN imports, and read-only conversation data) plus an offline-aware UI that disables prompt submission, new chat, and non-cached session items. The offline indicator lives in chat-header so it stays visible on every breakpoint (the sidebar is hidden by default on phone). Online/offline transition toasts are included as a progressive enhancement.

Also fixes pre-existing test failures: pf-description.test.js now imports the component under test, archive-dialog VR snapshots mask the date string so they are stable across days, and a flaky navigation e2e waits for the switched conversation's last message instead of relying on networkidle.
