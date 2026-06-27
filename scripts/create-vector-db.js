import { z } from "zod";

import { createDb } from "../server/db/database.js";
import { getRuleItemById, getRuleItems } from "../server/db/queries.js";
import { createVectorStore } from "../server/utils/vector-store.js";
import { QDRANT_CONFIG } from "../shared/constants.js";
import { createEmbeddings } from "./lib/google-ai-client.js";
import { createChunksFromRuleItem } from "./lib/vector-chunker.js";

const VECTOR_HELP = `
Usage: bun scripts/create-vector-db.js [options]

Read rule items from the source database, generate text chunks, embed them via
the Google AI API, and upsert the resulting vectors directly into Qdrant.

Requires a Google AI API key. Set GOOGLE_AI_API_KEY in your environment or
pass --api-key. Use --limit and --dry-run to test without incurring costs.

Options:
  --api-key <key>      Google AI API key (or set GOOGLE_AI_API_KEY)
  --types <types>      Comma-separated entity types to process (creature,spell,etc.)
  --limit <n>          Only process the first N rule items
  --batch-size <n>     Embeddings per API call / points per upsert [default: 100]
  --db <path>          Source SQLite database [default: data/dev.sqlite]
  --model <name>       Embedding model name [default: gemini-embedding-001]
  --qdrant-url <url>   Qdrant URL [default: $QDRANT_URL or http://localhost:6333]
  --collection <name>  Qdrant collection [default: $QDRANT_COLLECTION or rule_chunks]
  --vector-size <n>    Embedding dimension [default: 3072]
  --recreate           Drop & recreate collection before indexing (destructive)
  --dry-run            Generate chunks without calling the embedding API
  --help               Show this help message
`;

const vectorArgsSchema = z.object({
    apiKey: z.string().optional(),
    types: z
        .string()
        .transform((v) => v.split(","))
        .optional(),
    limit: z.coerce.number().int().positive().optional(),
    batchSize: z.coerce.number().int().positive().default(100),
    db: z.string().default("data/dev.sqlite"),
    model: z.string().default("gemini-embedding-001"),
    dryRun: z.boolean().default(false),
    qdrantUrl: z.string().default(() => process.env.QDRANT_URL ?? QDRANT_CONFIG.URL),
    collection: z.string().default(() => process.env.QDRANT_COLLECTION ?? QDRANT_CONFIG.COLLECTION),
    vectorSize: z.coerce.number().int().positive().default(QDRANT_CONFIG.VECTOR_SIZE),
    recreate: z.boolean().default(false),
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
        } else if (arg === "--model" && argv[i + 1]) {
            raw.model = argv[++i];
        } else if (arg === "--qdrant-url" && argv[i + 1]) {
            raw.qdrantUrl = argv[++i];
        } else if (arg === "--collection" && argv[i + 1]) {
            raw.collection = argv[++i];
        } else if (arg === "--vector-size" && argv[i + 1]) {
            raw.vectorSize = argv[++i];
        } else if (arg === "--recreate") {
            raw.recreate = true;
        } else if (arg === "--dry-run") {
            raw.dryRun = true;
        }
    }

    const parsed = vectorArgsSchema.parse(raw);
    parsed.apiKey = parsed.apiKey ?? process.env.GOOGLE_AI_API_KEY;
    return parsed;
}

/**
 * Chunks rule items, embeds the chunks via Google AI, and upserts them directly
 * into Qdrant. Idempotent: point ids are deterministic UUID v5 derived from the
 * chunk id, so re-running cannot accumulate duplicates.
 * @param {VectorArgs} options
 * @param {{ createStore?: typeof createVectorStore }} [deps]
 * @returns {Promise<{ chunksCreated: number, apiCalls: number, errors: number }>}
 */
export async function runVectorCreate(options, deps = {}) {
    const createStore = deps.createStore ?? createVectorStore;
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

    const store = createStore({ url: options.qdrantUrl, collection: options.collection });
    if (!store.client) {
        throw new Error(`Qdrant client not constructed (url=${options.qdrantUrl})`);
    }

    if (options.recreate) {
        try {
            await store.client.deleteCollection(options.collection);
        } catch {
            // Best-effort.
        }
    }

    await store.ensureCollection(options.vectorSize);

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

            /** @type {import("../server/utils/vector-store.js").VectorChunkForUpsert[]} */
            const chunksForUpsert = batch.map((chunk, j) => ({
                id: chunk.id,
                ruleItemId: chunk.ruleItemId,
                ruleItemName: chunk.ruleItemName,
                ruleItemType: chunk.ruleItemType,
                compendiumSource: chunk.compendiumSource ?? null,
                chunkIndex: chunk.chunkIndex,
                text: chunk.text,
                embedding: embeddings[j] ?? [],
            }));

            const result = await store.upsertChunks(chunksForUpsert);
            processedChunks += result.upserted;
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
