import { hc } from "hono/client";

/**
 * @typedef {import("../../server/index.js").App} App
 */

const client = /** @type {ReturnType<typeof hc<App>>} */ (/** @type {unknown} */ (hc("/")));

export { client };
