import { createContext } from "@lit/context";

/**
 * @typedef {{
 *   mode: import("../../shared/types.js").Mode
 * }} ModeState
 */

/** @type {ReturnType<typeof import("@lit/context").createContext<ModeState>>} */
const modeContext = createContext("mode");

/**
 * Creates a mode store with local-only mode persistence.
 * Mode changes via the header toggle are local only (same as current behavior).
 * PUT /api/users/me is only called from settings-dialog's save flow (unchanged).
 * @returns {{
 *   setMode: (mode: import("../../shared/types.js").Mode) => ModeState
 * }}
 */
function createModeStore() {
    return {
        /**
         * @param {import("../../shared/types.js").Mode} mode
         * @returns {ModeState}
         */
        setMode(mode) {
            return { mode };
        },
    };
}

export { modeContext, createModeStore };
