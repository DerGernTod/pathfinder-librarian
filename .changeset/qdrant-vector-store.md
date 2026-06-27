---
bump: minor
---

Replace in-memory brute-force vector search with a Qdrant sidecar (HNSW + int8
scalar quantization + payload filtering). Adds `docker-compose.yml`, lazy-init
graceful degradation when Qdrant is unavailable, and a single-step indexing
script (`bun run create:embeddings`) that chunks → embeds → upserts directly to
Qdrant. Includes a README setup guide, deterministic VR test timestamps for the
archive dialog, and consolidated error logging for vector-store init/runtime.
