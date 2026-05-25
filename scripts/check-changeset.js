#!/usr/bin/env bun
/**
 * CI script: Verifies that the current branch has at least one valid changeset
 * file in the .changeset/ directory.
 *
 * Exit 0 if at least one valid changeset is found.
 * Exit 1 with a clear error message otherwise.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const CHANGESET_DIR = resolve(import.meta.dir, "../.changeset");

if (!existsSync(CHANGESET_DIR)) {
    // oxlint-disable-next-line no-console
    console.error(
        "ERROR: No .changeset/ directory found. " +
            "Create a .changeset/<name>.md file with frontmatter: bump: patch|minor|major",
    );
    process.exit(1);
}

/** @type {string[]} */
const files = readdirSync(CHANGESET_DIR).filter((f) => f.endsWith(".md"));

if (files.length === 0) {
    // oxlint-disable-next-line no-console
    console.error(
        "ERROR: No changeset found. " +
            "Create a .changeset/<name>.md file with frontmatter: bump: patch|minor|major",
    );
    process.exit(1);
}

/** @type {string[]} */
const validBumps = ["patch", "minor", "major"];

/** @type {string[]} */
const errors = [];

for (const file of files) {
    const content = readFileSync(join(CHANGESET_DIR, file), "utf-8");
    const match = content.match(/^---\s*\nbump:\s*(\S+)\s*\n---/m);

    if (!match) {
        errors.push(
            `${file}: Missing or invalid frontmatter. Expected format:\n` +
                "  ---\n" +
                "  bump: patch|minor|major\n" +
                "  ---",
        );
        continue;
    }

    const bump = match[1];
    if (!validBumps.includes(bump)) {
        errors.push(
            `${file}: Invalid bump level "${bump}". Must be one of: ${validBumps.join(", ")}`,
        );
    }
}

if (errors.length > 0) {
    // oxlint-disable-next-line no-console
    console.error("ERROR: Invalid changeset(s):\n" + errors.join("\n"));
    process.exit(1);
}

// Success — at least one valid changeset found
process.exit(0);
