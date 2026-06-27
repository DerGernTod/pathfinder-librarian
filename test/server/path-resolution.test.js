import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guards the `process.cwd()`-based path resolution introduced in
 * `server/index.js` so the package.json read and the client/ static root keep
 * working both in dev (repo root) and inside a `bun build --compile` binary
 * (where `import.meta.dir`/`import.meta.url` resolve to the executable's
 * location, not the source tree).
 *
 * See PLAN.md §3.2 / §4.2.
 */

describe("server path resolution (process.cwd-based)", () => {
    it("resolves package.json via process.cwd() to the same file as import.meta.url", () => {
        // What the OLD code did (breaks inside a compiled binary):
        const metaPath = fileURLToPath(new URL("../../package.json", import.meta.url));
        // What the NEW code does (works in dev + scratch container WORKDIR /app):
        const cwdPath = resolve(process.cwd(), "package.json");

        expect(existsSync(cwdPath)).toBe(true);
        expect(resolve(cwdPath)).toBe(resolve(metaPath));
    });

    it("reads the same version from the cwd-resolved package.json", () => {
        const cwdPath = resolve(process.cwd(), "package.json");
        const pkg = JSON.parse(readFileSync(cwdPath, "utf-8"));

        expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("resolves the client dir via process.cwd() and it contains index.html", () => {
        // Mirrors `const clientDir = resolve(process.cwd(), "client")` in server/index.js
        const clientDir = resolve(process.cwd(), "client");

        expect(existsSync(clientDir)).toBe(true);
        expect(existsSync(resolve(clientDir, "index.html"))).toBe(true);
        expect(existsSync(resolve(clientDir, "manifest.webmanifest"))).toBe(true);
    });

    it("resolves the localizations seed via process.cwd()", () => {
        // foundry-refs.js#loadLocalizations reads process.cwd()/data/localizations.json.
        // Guarded here because the new .dockerignore keeps this file in context.
        const locPath = resolve(process.cwd(), "data", "localizations.json");

        expect(existsSync(locPath)).toBe(true);
        const contents = readFileSync(locPath, "utf-8");
        expect(contents.length).toBeGreaterThan(0);
    });
});
