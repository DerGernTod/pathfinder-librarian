# Oven/bun ships bun:sqlite built-in; the main DB (data/dev.sqlite) uses it.
# Vector search is served by the Qdrant sidecar (see docker-compose.yml);
# indexing writes directly to Qdrant via `bun run create:embeddings`.
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 3000
CMD ["bun", "run", "serve"]
