#!/usr/bin/env bun
/**
 * CLI script: Aggregates all changeset files in .changeset/, determines the
 * highest bump level (major > minor > patch), bumps package.json version
 * accordingly, writes the updated package.json, and deletes consumed
 * changeset files.
 *
 * Usage: bun scripts/version.js
 *
 * Intended to be run manually as part of the release process.
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const CHANGESET_DIR = resolve(import.meta.dir, "../.changeset");
const PACKAGE_JSON_PATH = resolve(import.meta.dir, "../package.json");

/**
 * Bump priority: major=3, minor=2, patch=1
 * @param {string} level
 * @returns {number}
 */
function bumpPriority(level) {
    if (level === "major") {
        return 3;
    }
    if (level === "minor") {
        return 2;
    }
    return 1;
}

/**
 * @param {string} version - semver string like "1.2.3"
 * @param {string} bump - "major" | "minor" | "patch"
 * @returns {string}
 */
function bumpVersion(version, bump) {
    const parts = version.split(".").map(Number);

    if (bump === "major") {
        parts[0] = parts[0] + 1;
        parts[1] = 0;
        parts[2] = 0;
    } else if (bump === "minor") {
        parts[1] = parts[1] + 1;
        parts[2] = 0;
    } else {
        parts[2] = parts[2] + 1;
    }

    return parts.join(".");
}

// 1. Read all .md files in .changeset/
/** @type {string[]} */
const files = readdirSync(CHANGESET_DIR).filter((f) => f.endsWith(".md"));

if (files.length === 0) {
    // oxlint-disable-next-line no-console
    console.log("No changesets found. Nothing to do.");
    process.exit(0);
}

// 2. Parse YAML frontmatter from each
/** @type {{ bump: string, file: string }[]} */
const changesets = [];

for (const file of files) {
    const content = readFileSync(join(CHANGESET_DIR, file), "utf-8");
    const match = content.match(/^---\s*\nbump:\s*(\S+)\s*\n---/m);

    if (!match) {
        // oxlint-disable-next-line no-console
        console.error(`WARNING: ${file} has invalid frontmatter, skipping.`);
        continue;
    }

    changesets.push({ bump: match[1], file });
}

if (changesets.length === 0) {
    // oxlint-disable-next-line no-console
    console.log("No valid changesets found. Nothing to do.");
    process.exit(0);
}

// 3. Determine highest bump level
/** @type {string} */
let highestBump = "patch";

for (const cs of changesets) {
    if (bumpPriority(cs.bump) > bumpPriority(highestBump)) {
        highestBump = cs.bump;
    }
}

// 4. Read current version from package.json
const pkg = /** @type {{ version: string }} */ (
    JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"))
);
const oldVersion = pkg.version;

// 5. Bump version
const newVersion = bumpVersion(oldVersion, highestBump);
pkg.version = newVersion;

// 6. Write updated package.json
writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 4) + "\n");

// 7. Delete all consumed .changeset/*.md files
for (const cs of changesets) {
    unlinkSync(join(CHANGESET_DIR, cs.file));
    // oxlint-disable-next-line no-console
    console.log(`Deleted ${cs.file}`);
}

// 8. Print new version to stdout
// oxlint-disable-next-line no-console
console.log(`Version bumped: ${oldVersion} → ${newVersion} (${highestBump})`);
console.log(newVersion);
