/**
 * Global toast dispatch helper.
 *
 * The `<sl-alert>` toast outlet lives in `app-shell.js` and subscribes to a
 * window-level `app-toast` event. Any component can fire a toast without
 * prop-drilling or a context dependency.
 *
 * @param {"success" | "warning" | "danger" | "primary" | "neutral"} variant
 * @param {string} message
 * @param {number} [duration=3000]
 * @returns {void}
 */
export function showToast(variant, message, duration = 3000) {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(
        new CustomEvent("app-toast", {
            detail: { variant, message, duration },
        }),
    );
}
