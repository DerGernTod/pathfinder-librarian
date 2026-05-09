import { LitElement } from "lit-element";

/**
 * Base class for all Lit components in the application.
 * Provides standardized ready-state handling and event helpers.
 */
export class BaseElement extends LitElement {
    constructor() {
        super();
        // Create the promise and store resolve function immediately
        // so it's available when firstUpdated is called
        /** @type {Promise<void>} */
        this._readyPromise = new Promise((resolve) => {
            this._readyResolve = resolve;
        });
    }

    firstUpdated() {
        this._readyResolve?.();
    }

    /**
     * Returns a promise that resolves after firstUpdated completes.
     * Use this instead of setTimeout in tests.
     * @returns {Promise<void>}
     */
    get ready() {
        return this._readyPromise;
    }

    /**
     * Helper to redispatch an event with optional detail override.
     * Use only when event doesn't already bubble through shadow DOM.
     * @param {Event} event - The original event
     * @param {string} [name] - New event name (defaults to original type)
     * @param {unknown} [detail] - New detail object (defaults to original detail)
     */
    redispatch(event, name, detail) {
        const eventName = name ?? event.type;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const eventDetail = detail ?? /** @type {CustomEvent} */ (event).detail;
        this.dispatchEvent(
            new CustomEvent(eventName, {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                detail: eventDetail,
                bubbles: true,
                composed: true,
            }),
        );
    }

    /**
     * Static config for Shoelace form bindings.
     * Override in subclasses to enable automatic value sync guards.
     * @returns {{ inputs: string[], guards: Record<string, (newVal: unknown, oldVal: unknown) => boolean> }}
     */
    static get shoelaceBindings() {
        return { inputs: [], guards: {} };
    }
}
