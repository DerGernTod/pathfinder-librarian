import { z } from "zod";

/** Payload stored on each Qdrant point. Nullable compendium_source. */
export const vectorChunkPayloadSchema = z.object({
    rule_item_id: z.string(),
    rule_item_name: z.string(),
    rule_item_type: z.string(),
    compendium_source: z.string().nullable(),
    chunk_index: z.number().int(),
    text: z.string(),
    chunk_id: z.string(),
});

/** A single Qdrant search hit, parsed defensively. */
export const qdrantSearchHitSchema = z.object({
    id: z.union([z.string(), z.number()]),
    score: z.number(),
    payload: vectorChunkPayloadSchema.nullable(),
});

/** @typedef {z.infer<typeof vectorChunkPayloadSchema>} VectorChunkPayload */
/** @typedef {z.infer<typeof qdrantSearchHitSchema>} QdrantSearchHit */
