import { Database } from "bun:sqlite";

import { createVectorStore } from "../server/utils/vector-store.js";
import { QDRANT_CONFIG } from "../shared/constants.js";
import { unpackEmbedding } from "./create-vector-db.js";

const HYDRATE_HELP = `
Usage: bun scripts/hydrate-qdrant.js [options]

Read chunk embeddings from the existing SQLite vector DB and upsert them into
Qdrant. Creates the collection (with detected vector size + int8 quantization)
if missing. Idempotent: re-running upserts the same point ids (UUID v5 derived
from the chunk id) so duplicates cannot accumulate.

Options:
  --vector-db <path>    Source SQLite vector DB [default: data/vectors.sqlite]
  --qdrant-url <url>    [default: $QDRANT_URL or http://localhost:6333]
  --collection <name>   [default: $QDRANT_COLLECTION or rule_chunks]
  --batch-size <n>      Points per upsert [default: 100]
  --vector-size <n>     Override detected dimension
  --recreate            Drop & recreate collection (destructive)
  --help                Show this help message
`;

/** @typedef {{ vectorDb: string, qdrantUrl: string, collection: string, batchSize: number, vectorSize?: number, recreate: boolean }} HydrateArgs */

/**
 * Parses CLI arguments for the Qdrant hydration script.
 * @param {string[]} argv
 * @returns {HydrateArgs}
 */
export function parseHydrateArgs(argv) {
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(HYDRATE_HELP);
        process.exit(0);
    }

    /** @type {Partial<HydrateArgs> & { recreate: boolean }} */
    const out = { recreate: false };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--vector-db" && argv[i + 1]) {
            out.vectorDb = argv[++i];
        } else if (arg === "--qdrant-url" && argv[i + 1]) {
            out.qdrantUrl = argv[++i];
        } else if (arg === "--collection" && argv[i + 1]) {
            out.collection = argv[++i];
        } else if (arg === "--batch-size" && argv[i + 1]) {
            out.batchSize = Number(argv[++i]);
        } else if (arg === "--vector-size" && argv[i + 1]) {
            out.vectorSize = Number(argv[++i]);
        } else if (arg === "--recreate") {
            out.recreate = true;
        }
    }

    const resolved = {
        vectorDb: out.vectorDb ?? "data/vectors.sqlite",
        qdrantUrl: out.qdrantUrl ?? process.env.QDRANT_URL ?? QDRANT_CONFIG.URL,
        collection: out.collection ?? process.env.QDRANT_COLLECTION ?? QDRANT_CONFIG.COLLECTION,
        batchSize: out.batchSize ?? 100,
        vectorSize: out.vectorSize,
        recreate: out.recreate,
    };
    return resolved;
}

/**
 * Reads all vector_chunks rows from the SQLite DB, unpacking embeddings.
 * @param {Database} sqlite
 * @returns {Array<{ id: string, rule_item_id: string, rule_item_name: string, rule_item_type: string, compendium_source: string | null, chunk_index: number, text: string, embedding: Buffer | null }>}
 */
export function readAllChunks(sqlite) {
    return sqlite
        .query(
            "SELECT id, rule_item_id, rule_item_name, rule_item_type, compendium_source, chunk_index, text, embedding FROM vector_chunks",
        )
        .all();
}

/**
 * Detects the vector dimension from the first non-null embedding BLOB.
 * @param {Array<{ embedding: Buffer | null }>} rows
 * @param {number | undefined} override
 * @returns {number}
 */
export function detectVectorSize(rows, override) {
    if (override !== undefined) {
        return override;
    }
    for (const row of rows) {
        if (row.embedding) {
            return row.embedding.length / 8;
        }
    }
    return QDRANT_CONFIG.VECTOR_SIZE;
}

/**
 * Runs the SQLite → Qdrant migration. Idempotent.
 * @param {HydrateArgs} args
 * @param {{ createStore?: typeof createVectorStore }} [deps]
 * @returns {Promise<{ points: number, batches: number, errors: number }>}
 */
export async function runHydrate(args, deps = {}) {
    const createStore = deps.createStore ?? createVectorStore;
    const sqlite = new Database(args.vectorDb, { readonly: true });
    const rows = readAllChunks(sqlite);
    const vectorSize = detectVectorSize(rows, args.vectorSize);

    const store = createStore({ url: args.qdrantUrl, collection: args.collection });
    if (!store.client) {
        sqlite.close();
        throw new Error(`Qdrant client not constructed (url=${args.qdrantUrl})`);
    }

    if (args.recreate) {
        try {
            await store.client.deleteCollection(args.collection);
        } catch {
            // Best-effort.
        }
    }

    const ok = await store.ensureCollection(vectorSize);
    if (!ok) {
        sqlite.close();
        throw new Error(
            `Failed to ensure collection ${args.collection} (vectorSize=${vectorSize})`,
        );
    }

    let points = 0;
    let batches = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += args.batchSize) {
        const slice = rows.slice(i, i + args.batchSize);
        try {
            const result = await store.upsertChunks(
                slice.map((row) => ({
                    id: String(row.id),
                    ruleItemId: String(row.rule_item_id),
                    ruleItemName: String(row.rule_item_name),
                    ruleItemType: String(row.rule_item_type),
                    compendiumSource: row.compendium_source ? String(row.compendium_source) : null,
                    chunkIndex: Number(row.chunk_index),
                    text: String(row.text),
                    embedding: row.embedding ? unpackEmbedding(row.embedding) : [],
                })),
            );
            points += result.upserted;
            batches++;
        } catch (/** @type {unknown} */ error) {
            errors++;
            console.error(
                `Error upserting batch ${i}-${i + slice.length}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    sqlite.close();
    return { points, batches, errors };
}

const isMain = process.argv[1] && process.argv[1].includes("hydrate-qdrant.js");
if (isMain) {
    const args = parseHydrateArgs(process.argv);
    runHydrate(args)
        .then((result) => {
            console.log(
                `Hydrate complete: ${result.points} points, ${result.batches} batches, ${result.errors} errors.`,
            );
        })
        .catch((error) => {
            console.error("Hydrate failed:", error);
            process.exit(1);
        });
}
