import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import z from "zod";
import { zValidator } from "@hono/zod-validator";

const app = new Hono()
    .get("/api/query", zValidator("query", z.object({ foo: z.string() })), (c) => {
        return c.json({ message: "Hello, World... oh!" + c.req.valid("query").foo });
    })
    .get("/", serveStatic({ path: "./client/index.html" }))
    .get("/*", serveStatic({ root: "./client" }));

/**
 * @typedef {typeof app} App
 */

// oxlint-disable-next-line import/no-default-export -- required for running hono
export default app;
