---
bump: minor
---

Replace in-memory brute-force vector search with a Qdrant sidecar (HNSW + int8 scalar quantization + payload filtering). Adds `docker-compose.yml`, a SQLite→Qdrant hydration script, and lazy-init graceful degradation when Qdrant is unavailable.
