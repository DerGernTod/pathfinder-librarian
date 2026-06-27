# ---- Stage 1: builder ----
# Pin to 1.3-slim to match the local Bun 1.3.x toolchain (PLAN.md §3.6); 1.3
# carries compile fixes vs the 1.1 baseline in the original issue.
FROM oven/bun:1.3-slim AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Embeds the runtime + module graph (incl. scripts/lib/vector-math.js,
# server/db/migrate.js) into a single native binary. --sourcemap is dropped
# (PLAN.md §4.3 notes): it inflates the binary several MB and the scratch
# runtime has no tooling to consume it.
RUN bun build ./server/index.js --compile --minify --outfile dist/server-binary

# ---- Stage 2: minimal runtime ----
# scratch has no shell, no package manager, no node_modules — only the compiled
# binary + static assets + TLS root certs.
FROM scratch
WORKDIR /app
# TLS root certs for outbound HTTPS (Google AI). scratch has no standard
# discovery paths, so SSL_CERT_FILE / NODE_EXTRA_CA_CERTS are pinned below.
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
# Standalone backend engine.
COPY --from=builder /app/dist/server-binary ./server
# Build-less frontend + shared schemas + localization seed.
COPY ./client ./client
COPY ./shared ./shared
COPY ./data/localizations.json ./data/localizations.json
# Required at boot: server/index.js readFileSync()s package.json via
# process.cwd() (PLAN.md §3.2/§4.3) and throws if absent.
COPY ./package.json ./package.json

ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
ENV NODE_ENV=production

# SQLite writes go here (DB path is process.cwd()-relative → /app/data/dev.sqlite).
# Compose mounts the app_data named volume over this; the anonymous volume is
# the fallback for plain `docker run`.
VOLUME /app/data
EXPOSE 3000
# exec-form (no shell) — required since scratch has no shell. `bun build
# --compile` emits a chmod +x binary and COPY preserves the mode.
CMD ["./server"]
