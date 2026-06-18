/**
 * Registers the service worker (`/sw.js`) unconditionally.
 *
 * SWR always revalidates in dev, so hot-reload stays correct.
 * Failures (private mode, unsupported browsers) are swallowed — the app
 * continues to work as a regular online SPA. Exports nothing — side-effect.
 */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
            // Best-effort: ignore registration failures.
        });
    });
}
