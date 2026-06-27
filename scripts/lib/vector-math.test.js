import { describe, expect, it } from "bun:test";

import { UUID_V5_NAMESPACE, cosineSimilarity, uuidV5FromName } from "./vector-math.js";

describe("vector-math", () => {
    describe("cosineSimilarity", () => {
        it("returns 1.0 for identical vectors", () => {
            const vec = [1, 2, 3, 4];
            expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
        });

        it("returns 0.0 for orthogonal vectors", () => {
            const vecA = [1, 0, 0];
            const vecB = [0, 1, 0];
            expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0);
        });

        it("returns -1.0 for opposite vectors", () => {
            const vecA = [1, 2, 3];
            const vecB = [-1, -2, -3];
            expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0);
        });

        it("returns 0.0 for zero vectors", () => {
            expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0.0);
            expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0.0);
        });

        it("computes correct similarity for arbitrary vectors", () => {
            const result = cosineSimilarity([1, 2, 3], [4, 5, 6]);
            expect(result).toBeCloseTo(0.9746, 3);
        });
    });

    describe("uuidV5FromName", () => {
        it("is deterministic for the same input", () => {
            expect(uuidV5FromName("chunk-1")).toBe(uuidV5FromName("chunk-1"));
        });

        it("differs for different inputs", () => {
            expect(uuidV5FromName("chunk-1")).not.toBe(uuidV5FromName("chunk-2"));
        });

        it("produces a UUID v5 formatted string", () => {
            const id = uuidV5FromName("some-chunk-id");
            expect(id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
            );
        });

        it("exposes the project namespace constant", () => {
            expect(UUID_V5_NAMESPACE).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
            );
        });
    });
});
