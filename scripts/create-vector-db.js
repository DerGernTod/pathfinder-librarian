import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";

import { z } from "zod";

import { createDb } from "../server/db/database.js";
import { getRuleItemById, getRuleItems } from "../server/db/queries.js";
import { createEmbeddings } from "./lib/google-ai-client.js";
import { createChunksFromRuleItem } from "./lib/vector-chunker.js";

/**
 * Packs a float64 array into a Buffer for BLOB storage.
 * @param {number[]} embedding
 * @returns {Buffer}
 */
export function packEmbedding(embedding) {
    const buffer = Buffer.alloc(embedding.length * 8);
    for (let i = 0; i < embedding.length; i++) {
        buffer.writeDoubleLE(embedding[i], i * 8);
    }
    return buffer;
}

/**
 * Unpacks a BLOB buffer back into a float64 array.
 * @param {Buffer | ArrayBuffer | Uint8Array} blob
 * @returns {number[]}
 */
export function unpackEmbedding(blob) {
    const buf = Buffer.isBuffer(blob)
        ? blob
        : Buffer.from(
              /** @type {unknown} */ (blob) instanceof ArrayBuffer
                  ? new Uint8Array(/** @type {ArrayBuffer} */ (/** @type {unknown} */ (blob)))
                  : /** @type {Uint8Array} */ (/** @type {unknown} */ (blob)),
          );
    const count = buf.length / 8;
    /** @type {number[]} */
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(buf.readDoubleLE(i * 8));
    }
    return result;
}

const CREATE_VECTOR_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS vector_chunks (
    id TEXT PRIMARY KEY,
    rule_item_id TEXT NOT NULL,
    rule_item_name TEXT NOT NULL,
    rule_item_type TEXT NOT NULL,
    compendium_source TEXT,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding BLOB,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_rule_item ON vector_chunks(rule_item_id);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_type ON vector_chunks(rule_item_type);
`;

const VECTOR_HELP = `
Usage: bun scripts/create-vector-db.js [options]

Read rule items from the database, generate text chunks, embed them via the
Google AI API, and store the resulting vectors in a SQLite database.

Requires a Google AI API key. Set GOOGLE_AI_API_KEY in your environment or
pass --api-key. Use --limit and --dry-run to test without incurring costs.

Options:
  --api-key <key>     Google AI API key (or set GOOGLE_AI_API_KEY)
  --types <types>     Comma-separated entity types to process (creature,spell,etc.)
  --limit <n>         Only process the first N rule items
  --batch-size <n>    Embeddings per API call [default: 20]
  --db <path>         Source SQLite database [default: data/dev.sqlite]
  --vector-db <path>  Output vector database [default: data/vectors.sqlite]
  --model <name>      Embedding model name [default: text-embedding-004]
  --dry-run           Generate chunks without calling the embedding API
  --help              Show this help message
`;

const vectorArgsSchema = z.object({
    apiKey: z.string().optional(),
    types: z
        .string()
        .transform((v) => v.split(","))
        .optional(),
    limit: z.coerce.number().int().positive().optional(),
    batchSize: z.coerce.number().int().positive().default(20),
    db: z.string().default("data/dev.sqlite"),
    vectorDb: z.string().default("data/vectors.sqlite"),
    model: z.string().default("text-embedding-004"),
    dryRun: z.boolean().default(false),
});

/** @typedef {z.infer<typeof vectorArgsSchema>} VectorArgs */

/**
 * Parses CLI arguments for the vector DB creation script.
 * @param {string[]} argv
 * @returns {VectorArgs}
 */
export function parseVectorArgs(argv) {
    if (argv.length <= 2 || argv.includes("--help") || argv.includes("-h")) {
        console.log(VECTOR_HELP);
        process.exit(0);
    }

    /** @type {Record<string, string | boolean | undefined>} */
    const raw = {};
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--api-key" && argv[i + 1]) {
            raw.apiKey = argv[++i];
        } else if (arg === "--types" && argv[i + 1]) {
            raw.types = argv[++i];
        } else if (arg === "--limit" && argv[i + 1]) {
            raw.limit = argv[++i];
        } else if (arg === "--batch-size" && argv[i + 1]) {
            raw.batchSize = argv[++i];
        } else if (arg === "--db" && argv[i + 1]) {
            raw.db = argv[++i];
        } else if (arg === "--vector-db" && argv[i + 1]) {
            raw.vectorDb = argv[++i];
        } else if (arg === "--model" && argv[i + 1]) {
            raw.model = argv[++i];
        } else if (arg === "--dry-run") {
            raw.dryRun = true;
        }
    }

    const parsed = vectorArgsSchema.parse(raw);
    parsed.apiKey = parsed.apiKey ?? process.env.GOOGLE_AI_API_KEY;
    return parsed;
}

/**
 * Creates and initializes the vector database.
 * @param {string} dbPath
 * @returns {Database}
 */
export function createVectorDb(dbPath) {
    if (dbPath !== ":memory:" && !dbPath.startsWith("file:")) {
        const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
        mkdirSync(dir, { recursive: true });
    }
    const vdb = new Database(dbPath);
    vdb.exec("PRAGMA journal_mode=WAL");
    vdb.exec(CREATE_VECTOR_TABLE_SQL);
    return vdb;
}

/**
 * Main function to create the vector database.
 * @param {{ apiKey?: string, types?: string[], limit?: number, batchSize: number, db: string, vectorDb: string, model: string, dryRun: boolean }} options
 * @returns {Promise<{ chunksCreated: number, apiCalls: number, errors: number }>}
 */
export async function runVectorCreate(options) {
    const sourceDb = createDb(options.db);
    const ruleItems = getRuleItems(sourceDb, undefined, { includeChildren: true });

    // Filter by types
    const filtered = options.types
        ? ruleItems.filter((item) => /** @type {string[]} */ (options.types).includes(item.type))
        : ruleItems;

    // Apply limit
    const limited = options.limit ? filtered.slice(0, options.limit) : filtered;

    if (limited.length === 0) {
        console.log("No rule items to process.");
        return { chunksCreated: 0, apiCalls: 0, errors: 0 };
    }

    // Generate chunks
    const allChunks = [];
    for (const item of limited) {
        /** @type {{ name?: string, type?: string } | undefined} */
        let parent;
        if (item.parentId) {
            parent = getRuleItemById(sourceDb, item.parentId) ?? undefined;
        }
        const chunks = createChunksFromRuleItem(item, parent);
        allChunks.push(...chunks);
    }

    console.log(`Generated ${allChunks.length} chunks from ${limited.length} rule items.`);

    if (options.dryRun) {
        console.log("[DRY RUN] Chunks generated but not embedded.");
        return { chunksCreated: allChunks.length, apiCalls: 0, errors: 0 };
    }

    if (!options.apiKey) {
        throw new Error(
            "Google AI API key required. Set GOOGLE_AI_API_KEY env var or use --api-key.",
        );
    }

    // Create vector DB
    const vdb = createVectorDb(options.vectorDb);

    const insertStmt = vdb.prepare(
        "INSERT OR REPLACE INTO vector_chunks (id, rule_item_id, rule_item_name, rule_item_type, compendium_source, chunk_index, text, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );

    let apiCalls = 0;
    let errors = 0;
    let processedChunks = 0;

    // Process in batches
    for (let i = 0; i < allChunks.length; i += options.batchSize) {
        const batch = allChunks.slice(i, i + options.batchSize);
        const texts = batch.map((c) => c.text);

        try {
            const embeddings = await createEmbeddings(options.apiKey, options.model, texts);
            apiCalls++;

            for (let j = 0; j < batch.length; j++) {
                const chunk = batch[j];
                const embedding = embeddings[j];
                insertStmt.run(
                    chunk.id,
                    chunk.ruleItemId,
                    chunk.ruleItemName,
                    chunk.ruleItemType,
                    chunk.compendiumSource ?? null,
                    chunk.chunkIndex,
                    chunk.text,
                    embedding ? packEmbedding(embedding) : null,
                    new Date().toISOString(),
                );
                processedChunks++;
            }
        } catch (error) {
            errors++;
            console.error(
                `Error embedding batch ${i}-${i + batch.length}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    console.log(
        `Vector DB created: ${processedChunks} chunks, ${apiCalls} API calls, ${errors} errors.`,
    );

    return { chunksCreated: processedChunks, apiCalls, errors };
}

// Only run main when executed directly
const isMain = process.argv[1] && process.argv[1].includes("create-vector-db.js");
if (isMain) {
    const options = parseVectorArgs(process.argv);
    runVectorCreate(options)
        .then((result) => {
            console.log(
                `Complete: ${result.chunksCreated} chunks, ${result.apiCalls} API calls, ${result.errors} errors`,
            );
        })
        .catch((error) => {
            console.error("Failed:", error);
            process.exit(1);
        });
}
