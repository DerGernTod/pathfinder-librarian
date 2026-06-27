## CI / Workflows

### Updating Playwright visual-regression snapshots

When a CI run fails on the `e2e` job because snapshots are outdated, use the **Update Snapshots** workflow:

1. Go to **Actions → Update Snapshots → Run workflow**.
2. Set the **branch** input to the PR branch name (e.g. `fix/my-feature`).
3. Click **Run workflow**.

The workflow will:

- Run Playwright with `--update-snapshots` on the specified branch.
- Commit any changed `.png` files and push them to the branch.
- Trigger the main **CI** workflow for the new commit so PR required checks are reported.

**Prerequisites**: the repository secret `PAT_VR_PUSH` must be a fine-grained PAT
with **Contents: Read and Write** (to push commits) and **Actions: Read and Write**
(to dispatch the CI workflow) on this repository.

---

## Vector search setup (Qdrant)

RAG context retrieval is optional. When `QDRANT_URL` is unset the app skips
vector search and answers without retrieved context — local dev and visual
regression tests do not require Qdrant. To enable it:

1. **Start the Qdrant sidecar** (dev override exposes port 6333 to the host)

    ```bash
    bun run qdrant:up        # docker compose up -d qdrant && logs -f
    ```

    Default URL: `http://localhost:6333`.

2. **Set env vars** (only `QDRANT_URL` is required to enable RAG)

    ```bash
    export QDRANT_URL=http://localhost:6333
    export QDRANT_COLLECTION=rule_chunks      # optional
    export GOOGLE_AI_API_KEY=...              # required for indexing + queries
    ```

3. **Index rule items into Qdrant** (chunks → embeds → upserts in one step)

    ```bash
    bun run create:embeddings
    # or a smaller demo subset:
    bun run create:demo:vector-db
    ```

    Re-running is idempotent (point ids are deterministic UUID v5).

4. **Verify**
    ```bash
    curl -s http://localhost:6333/collections/rule_chunks | grep points_count
    # expect points_count > 0
    ```

See `docs/architecture.md` → "Vector store (Qdrant sidecar)" for the collection
schema, lifecycle, and the over-fetch ownership rule.

---

i'm trying to build a RAG system for the pathfinder rpg. i want a chat-like assistant interaction that's augmented with deterministic data (e.g. stat blocks of npcs, spells, equipment etc.). the user should be able to ask things like this:
"i'm a gm, my party just captured a mitflit king and wants to sell them at the market of a nearby settlement. how should i handle this?". the assistant should respond with settlement requirements, rules, proposals of how to set the scene, DCs on required skill rolls etc.. another example of a question:
"i'm an assassin, hanging from a chandelier. i want to jump on an enemy below me and cut their throat. what do i need to roll?" - the assistant should find the respective rule sets and answer with the requirements, what to roll, what skills they need, what stats of the enemy affect the action etc.
it should be possible to ask follow-up questions, like "the blacksmith decided to buy the mitflit king, how could this affect the settlement's and the blacksmith's standing with the party, what else could happen to the mitflit king?" - the assistant should propose some possibilities. also, we need a simple toggle between "player" and "gm" answers, so players don't get information they should not see (e.g. monster stat blocks).

- scaffold how the UI could look like. i'm leaning towards a modern web app look (shadcn-like components).
- research how to get the data from https://github.com/foundryvtt/pf2e into a format fit for this scenario (we probably need a vector db with vectors and an additional "rule item" table for deterministic results, and connect them somehow)
- propose a format for the vector chunks: what's the best way to store details from foundry, so that it's later easily possible to fetch the deterministic connected "rule item"s? for example, a monster can have several spells, so we need to create chunks about the monster, as well as connections between the monster and their spells, as well as chunks about the spells themselves, without having too much duplicate data (e.g. with metadata links to other rule items, in foundry roughly categorized into items and actors)
- propose a system prompt (maybe different between GM and PC?)
