#!/bin/sh
set -e

echo "━━━ pre-commit checks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

# Step 1: Format (auto-fix, then re-stage formatted files that were already staged)
echo "  [1/4] formatting (oxfmt)..." >&2
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
bun run format
# Re-stage only files that were already staged (to pick up format changes,
# but not accidentally stage other dirty files)
if [ -n "$STAGED_FILES" ]; then
    echo "$STAGED_FILES" | xargs -r git add
fi

# Step 2: Lint
echo "  [2/4] linting (oxlint)..." >&2
bun run lint

# Step 3: Type-check
echo "  [3/4] type-checking (tsgo)..." >&2
bun run check

# Step 4: Tests
echo "  [4/4] running tests (bun test)..." >&2
bun run test

echo "✓ all pre-commit checks passed" >&2
