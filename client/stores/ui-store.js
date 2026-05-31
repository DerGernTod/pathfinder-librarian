import { createContext } from "@lit/context";

/**
 * @typedef {{
 *   sidebarExpanded: boolean,
 *   settingsOpen: boolean,
 *   archiveOpen: boolean,
 *   breakpoint: "phone" | "tablet" | "desktop"
 * }} UIState
 */

/** @type {ReturnType<typeof import("@lit/context").createContext<UIState>>} */
const uiContext = createContext("ui");

/**
 * Creates a UI store with methods for managing UI state.
 * @returns {{
 *   toggleSidebar: (current: UIState) => UIState,
 *   openSettings: (current: UIState) => UIState,
 *   closeSettings: (current: UIState) => UIState,
 *   openArchive: (current: UIState) => UIState,
 *   closeArchive: (current: UIState) => UIState,
 *   setBreakpoint: (current: UIState, breakpoint: "phone" | "tablet" | "desktop") => UIState
 * }}
 */
function createUIStore() {
    return {
        /**
         * @param {UIState} current
         * @returns {UIState}
         */
        toggleSidebar(current) {
            return { ...current, sidebarExpanded: !current.sidebarExpanded };
        },

        /**
         * @param {UIState} current
         * @returns {UIState}
         */
        openSettings(current) {
            return { ...current, settingsOpen: true };
        },

        /**
         * @param {UIState} current
         * @returns {UIState}
         */
        closeSettings(current) {
            return { ...current, settingsOpen: false };
        },

        /**
         * @param {UIState} current
         * @returns {UIState}
         */
        openArchive(current) {
            return { ...current, archiveOpen: true };
        },

        /**
         * @param {UIState} current
         * @returns {UIState}
         */
        closeArchive(current) {
            return { ...current, archiveOpen: false };
        },

        /** @param {"phone" | "tablet" | "desktop"} breakpoint */
        setBreakpoint(current, breakpoint) {
            return { ...current, breakpoint };
        },
    };
}

export { uiContext, createUIStore };
