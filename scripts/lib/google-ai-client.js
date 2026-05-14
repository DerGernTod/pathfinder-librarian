import { z } from "zod";

const batchEmbedResponseSchema = z.object({
    embeddings: z.array(
        z.object({
            values: z.array(z.number()),
        }),
    ),
});

/**
 * Creates embeddings for text chunks using Google's Generative AI API.
 * @param {string} apiKey - Google AI API key
 * @param {string} model - Model name (e.g. "gemini-embedding-001")
 * @param {string[]} texts - Array of text strings to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function createEmbeddings(apiKey, model, texts) {
    if (texts.length === 0) {
        return [];
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                requests: texts.map((text) => ({
                    model: `models/${model}`,
                    content: { parts: [{ text }] },
                })),
            }),
        },
    );
    if (!response.ok) {
        throw new Error(`Google AI API error: ${response.status} ${await response.text()}`);
    }
    const result = /** @type {unknown} */ (await response.json());
    return batchEmbedResponseSchema.parse(result).embeddings.map((e) => e.values);
}
