import { describe, expect, it } from "bun:test";

import { getMockResponse } from "../utils/mock-response.js";

describe("getMockResponse", () => {
    it("returns a non-empty array of blocks", () => {
        const response = getMockResponse();
        expect(Array.isArray(response)).toBe(true);
        expect(response.length).toBeGreaterThan(0);
    });

    it("each block has a valid type property", () => {
        const response = getMockResponse();
        const validTypes = ["paragraph", "callout", "list", "stat-block"];

        for (const block of response) {
            expect(block).toHaveProperty("type");
            expect(validTypes).toContain(block.type);
        }
    });

    it("calling it multiple times can return different responses", () => {
        // Call it 20 times - with 10 responses, statistically very likely to see variety
        const responses = new Set();
        for (let i = 0; i < 20; i++) {
            const response = getMockResponse();
            const signature = JSON.stringify(response);
            responses.add(signature);
        }
        // We should see at least 5 different responses (allowing for some randomness)
        expect(responses.size).toBeGreaterThanOrEqual(5);
    });

    it("each block matches expected MessageBlock structure", () => {
        const response = getMockResponse();

        for (const block of response) {
            expect(block).toHaveProperty("type");

            if (block.type === "paragraph") {
                // Paragraph blocks should have either text OR segments
                const hasText = "text" in block && typeof block.text === "string";
                const hasSegments =
                    "segments" in block &&
                    Array.isArray(block.segments) &&
                    block.segments.every(
                        (s) => typeof s.text === "string" && typeof s.highlight === "boolean",
                    );
                expect(hasText || hasSegments).toBe(true);
            } else if (block.type === "callout") {
                expect(block).toHaveProperty("title");
                expect(typeof block.title).toBe("string");

                // Callouts should have either text OR segments
                const hasText = "text" in block && typeof block.text === "string";
                const hasSegments =
                    "segments" in block &&
                    Array.isArray(block.segments) &&
                    block.segments.every(
                        (s) => typeof s.text === "string" && typeof s.highlight === "boolean",
                    );
                expect(hasText || hasSegments).toBe(true);
            } else if (block.type === "list") {
                expect(block).toHaveProperty("items");
                expect(Array.isArray(block.items)).toBe(true);

                for (const item of block.items) {
                    expect(item).toHaveProperty("title");
                    expect(typeof item.title).toBe("string");
                }
            } else if (block.type === "stat-block") {
                expect(block).toHaveProperty("title");
                expect(block).toHaveProperty("data");
            }
        }
    });

    it("paragraph blocks can have italic property", () => {
        const response = getMockResponse();
        const paragraphBlocks = response.filter((b) => b.type === "paragraph");

        // Check that at least one paragraph block exists
        expect(paragraphBlocks.length).toBeGreaterThan(0);

        // Some paragraphs may have italic property (optional)
        for (const block of paragraphBlocks) {
            if ("italic" in block) {
                expect(typeof block.italic).toBe("boolean");
            }
        }
    });

    it("list items can have optional text or segments", () => {
        const response = getMockResponse();
        const listBlocks = response.filter((b) => b.type === "list");

        for (const block of listBlocks) {
            for (const item of block.items) {
                if ("text" in item) {
                    expect(typeof item.text).toBe("string");
                }
                if ("segments" in item) {
                    expect(Array.isArray(item.segments)).toBe(true);
                }
            }
        }
    });
});
