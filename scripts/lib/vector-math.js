import { createHash } from "node:crypto";

/** Fixed namespace UUID for deterministic point-id derivation. */
export const UUID_V5_NAMESPACE = "9b8f4c2e-7a3d-4f1b-9e6c-1a2b3c4d5e6f";

/** Buffer form of the namespace UUID (16 bytes). */
const NAMESPACE_BYTES = Buffer.from(UUID_V5_NAMESPACE.replace(/-/g, ""), "hex");

/**
 * Deterministic UUID v5 (SHA-1 namespace+name) from an arbitrary name.
 * Used as Qdrant point id so upserts are idempotent across runs.
 * @param {string} name
 * @returns {string}
 */
export function uuidV5FromName(name) {
    const hash = createHash("sha1");
    hash.update(NAMESPACE_BYTES);
    hash.update(name, "utf8");
    const bytes = hash.digest();

    // Set version (5) and variant bits per RFC 4122 §4.3.
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.subarray(0, 16).toString("hex");
    return (
        hex.substring(0, 8) +
        "-" +
        hex.substring(8, 12) +
        "-" +
        hex.substring(12, 16) +
        "-" +
        hex.substring(16, 20) +
        "-" +
        hex.substring(20, 32)
    );
}

/**
 * Cosine similarity; returns 0 for zero-length vectors.
 * Pure helper used only by tests (fake Qdrant client) and hydration sanity
 * checks — NOT by the runtime search path (Qdrant computes similarity).
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
export function cosineSimilarity(vecA, vecB) {
    const len = Math.min(vecA.length, vecB.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
