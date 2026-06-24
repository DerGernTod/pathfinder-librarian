# Oven/bun ships bun:sqlite built-in; the main DB (data/dev.sqlite) uses it.
# data/vectors.sqlite is no longer needed at runtime — vector search is served
# by the Qdrant sidecar (see docker-compose.yml). The hydrate script reads
# vectors.sqlite only at migration time.
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 3000
CMD ["bun", "run", "serve"]
