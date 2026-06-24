import { QdrantClient } from "@qdrant/js-client-rest";

import { uuidV5FromName } from "../../scripts/lib/vector-math.js";
import { QDRANT_CONFIG } from "../../shared/constants.js";
import { qdrantSearchHitSchema, vectorChunkPayloadSchema } from "../../shared/vector-schemas.js";

/** @typedef {import("../../shared/vector-schemas.js").QdrantSearchHit} QdrantSearchHit */
/**
 * @typedef {{ id: string, ruleItemId: string, ruleItemName: string, ruleItemType: string, compendiumSource: string | null, text: string }} VectorChunkLite
 */
/**
 * @typedef {{ chunk: VectorChunkLite, score: number }} VectorChunkWithScore
 */
/**
 * @typedef {{ id: string, ruleItemId: string, ruleItemName: string, ruleItemType: string, compendiumSource: string | null, chunkIndex: number, text: string, embedding: number[] }} VectorChunkForUpsert
 */
/**
 * @typedef {{ url?: string, collection?: string, client?: QdrantClient }} CreateVectorStoreOptions
 */

const DEFAULT_COLLECTION = QDRANT_CONFIG.COLLECTION;
const SCROLL_PAGE_SIZE = 64;
const PAYLOAD_INDEX_FIELDS = ["rule_item_id", "rule_item_type", "compendium_source"];

/**
 * Build the Qdrant collection config for the given vector size.
 * @param {number} size
 * @returns {Record<string, unknown>}
 */
function collectionConfig(size) {
    return {
        vectors: { size, distance: "Cosine" },
        hnsw_config: { m: 16, ef_construct: 100 },
        on_disk_payload: true,
        optimizers_config: { default_segment_number: 2 },
        quantization_config: { scalar: { type: "int8", quantile: 0.99, always_ram: true } },
    };
}

/**
 * @typedef {{
 *   readonly collectionName: string,
 *   readonly client: QdrantClient | null,
 *   isAvailable(): boolean,
 *   ensureCollection(vectorSize?: number): Promise<boolean>,
 *   search(queryEmbedding: number[], opts?: { topN?: number, threshold?: number, filter?: unknown }): Promise<VectorChunkWithScore[]>,
 *   getChunksByRuleItemId(ruleItemId: string): Promise<Array<{ id: string, text: string, chunkIndex: number }>>,
 *   upsertChunks(chunks: VectorChunkForUpsert[]): Promise<{ upserted: number }>,
 * }} VectorStore
 */

/**
 * Factory. Construction is synchronous and performs NO I/O.
 * @param {CreateVectorStoreOptions} [options]
 * @returns {VectorStore}
 */
export function createVectorStore(options = {}) {
    const collectionName =
        options.collection ?? process.env.QDRANT_COLLECTION ?? DEFAULT_COLLECTION;
    const qdrantUrl = options.url ?? process.env.QDRANT_URL ?? null;
    const disabled = process.env.QDRANT_DISABLED === "1";

    /** @type {QdrantClient | null} */
    let client = null;
    /** @type {boolean | null} */
    let available = null;
    /** @type {Promise<boolean> | null} */
    let initPromise = null;

    if (qdrantUrl !== null && !disabled) {
        client = options.client ?? new QdrantClient({ url: qdrantUrl });
    } else {
        available = false;
    }

    const isAvailable = () => available === true;

    /**
     * @param {number} [vectorSize]
     * @returns {Promise<boolean>}
     */
    const ensureCollection = (vectorSize) => {
        if (initPromise) {
            return initPromise;
        }
        initPromise = (async () => {
            if (!client) {
                available = false;
                return false;
            }
            try {
                const resp = await client.collectionExists(collectionName);
                const exists = Boolean(resp && resp.exists);

                if (exists) {
                    available = true;
                    return true;
                }

                const size =
                    vectorSize ??
                    (process.env.QDRANT_VECTOR_SIZE
                        ? Number(process.env.QDRANT_VECTOR_SIZE)
                        : undefined);

                if (size === undefined) {
                    // oxlint-disable-next-line no-console -- boot diagnostic
                    console.warn(
                        `Qdrant collection ${collectionName} missing; run bun run hydrate:qdrant`,
                    );
                    available = false;
                    return false;
                }

                await client.createCollection(collectionName, collectionConfig(size));
                for (const field of PAYLOAD_INDEX_FIELDS) {
                    await client.createPayloadIndex(collectionName, {
                        field_name: field,
                        field_schema: "keyword",
                        wait: true,
                    });
                }
                available = true;
                return true;
            } catch (/** @type {unknown} */ error) {
                const msg = error instanceof Error ? error.message : String(error);
                // oxlint-disable-next-line no-console -- init failure diagnostic
                console.warn("Qdrant init failed:", msg);
                available = false;
                return false;
            }
        })();
        return initPromise;
    };

    /**
     * @param {QdrantSearchHit} hit
     * @returns {VectorChunkWithScore | null}
     */
    const mapHit = (hit) => {
        if (!hit.payload) {
            return null;
        }
        const parsed = qdrantSearchHitSchema.safeParse(hit);
        if (!parsed.success || !parsed.data.payload) {
            return null;
        }
        const p = parsed.data.payload;
        return {
            chunk: {
                id: p.chunk_id,
                ruleItemId: p.rule_item_id,
                ruleItemName: p.rule_item_name,
                ruleItemType: p.rule_item_type,
                compendiumSource: p.compendium_source,
                text: p.text,
            },
            score: parsed.data.score,
        };
    };

    /**
     * @param {number[]} queryEmbedding
     * @param {{ topN?: number, threshold?: number, filter?: unknown }} [opts]
     * @returns {Promise<VectorChunkWithScore[]>}
     */
    const search = async (queryEmbedding, opts = {}) => {
        const topN = opts.topN ?? 5;
        const threshold = opts.threshold ?? 0.0;
        await ensureCollection();
        if (!isAvailable() || !client) {
            return [];
        }
        try {
            const hits = await client.search(collectionName, {
                vector: queryEmbedding,
                limit: topN,
                score_threshold: threshold,
                with_payload: true,
                with_vector: false,
                ...(opts.filter !== undefined ? { filter: opts.filter } : {}),
            });
            /** @type {VectorChunkWithScore[]} */
            const out = [];
            for (const hit of /** @type {unknown[]} */ (/** @type {unknown} */ (hits))) {
                const mapped = mapHit(/** @type {QdrantSearchHit} */ (hit));
                if (mapped) {
                    out.push(mapped);
                }
            }
            return out;
        } catch (/** @type {unknown} */ error) {
            const msg = error instanceof Error ? error.message : String(error);
            // oxlint-disable-next-line no-console -- search failure diagnostic
            console.warn("Qdrant search failed:", msg);
            return [];
        }
    };

    /**
     * @param {string} ruleItemId
     * @returns {Promise<Array<{ id: string, text: string, chunkIndex: number }>>}
     */
    const getChunksByRuleItemId = async (ruleItemId) => {
        await ensureCollection();
        if (!isAvailable() || !client) {
            return [];
        }
        try {
            const resp = await client.scroll(collectionName, {
                filter: { must: [{ key: "rule_item_id", match: { value: ruleItemId } }] },
                limit: SCROLL_PAGE_SIZE,
                with_payload: true,
                with_vector: false,
            });
            /** @type {Array<{ id: string, text: string, chunkIndex: number }>} */
            const out = [];
            for (const point of /** @type {unknown[]} */ (/** @type {unknown} */ (resp.points))) {
                const p = point;
                const payload = vectorChunkPayloadSchema
                    .nullable()
                    .safeParse(/** @type {{ payload?: unknown }} */ (p).payload);
                if (!payload.success || !payload.data) {
                    continue;
                }
                out.push({
                    id: payload.data.chunk_id,
                    text: payload.data.text,
                    chunkIndex: payload.data.chunk_index,
                });
            }
            out.sort((a, b) => a.chunkIndex - b.chunkIndex);
            return out;
        } catch (/** @type {unknown} */ error) {
            const msg = error instanceof Error ? error.message : String(error);
            // oxlint-disable-next-line no-console -- scroll failure diagnostic
            console.warn("Qdrant scroll failed:", msg);
            return [];
        }
    };

    /**
     * @param {VectorChunkForUpsert[]} chunks
     * @returns {Promise<{ upserted: number }>}
     */
    const upsertChunks = async (chunks) => {
        if (!client) {
            return { upserted: 0 };
        }
        /** @type {Array<{ id: string, vector: number[], payload: Record<string, unknown> }>} */
        const points = [];
        for (const chunk of chunks) {
            const payload = {
                rule_item_id: chunk.ruleItemId,
                rule_item_name: chunk.ruleItemName,
                rule_item_type: chunk.ruleItemType,
                compendium_source: chunk.compendiumSource ?? null,
                chunk_index: chunk.chunkIndex,
                text: chunk.text,
                chunk_id: chunk.id,
            };
            const parsed = vectorChunkPayloadSchema.safeParse(payload);
            if (!parsed.success) {
                throw new Error(`Invalid chunk payload: ${parsed.error.message}`);
            }
            points.push({
                id: uuidV5FromName(chunk.id),
                vector: chunk.embedding,
                payload: parsed.data,
            });
        }
        if (points.length === 0) {
            return { upserted: 0 };
        }
        await client.upsert(collectionName, { wait: true, points });
        return { upserted: points.length };
    };

    return {
        collectionName,
        get client() {
            return client;
        },
        isAvailable,
        ensureCollection,
        search,
        getChunksByRuleItemId,
        upsertChunks,
    };
}
