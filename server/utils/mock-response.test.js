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
        const validTypes = ["text", "callout", "stat-block", "rule-detail"];

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

            if (block.type === "text") {
                // Text blocks must have a markdown string
                const hasMarkdown = "markdown" in block && typeof block.markdown === "string";
                expect(hasMarkdown).toBe(true);
            } else if (block.type === "callout") {
                expect(block).toHaveProperty("title");
                expect(typeof block.title).toBe("string");
                // Callout blocks must have a markdown string
                const hasMarkdown = "markdown" in block && typeof block.markdown === "string";
                expect(hasMarkdown).toBe(true);
            } else if (block.type === "stat-block") {
                expect(block).toHaveProperty("title");
                expect(block).toHaveProperty("data");
            } else if (block.type === "rule-detail") {
                expect(block).toHaveProperty("ruleItemId");
                expect(typeof block.ruleItemId).toBe("string");
            }
        }
    });

    it("text blocks can have italic property", () => {
        const response = getMockResponse();
        const textBlocks = response.filter((b) => b.type === "text");

        // Check that at least one text block exists
        expect(textBlocks.length).toBeGreaterThan(0);

        // Some text blocks may have italic property (optional)
        for (const block of textBlocks) {
            if ("italic" in block) {
                expect(typeof block.italic).toBe("boolean");
            }
        }
    });

    it("callout blocks have markdown as string type", () => {
        const response = getMockResponse();
        const calloutBlocks = response.filter((b) => b.type === "callout");

        for (const block of calloutBlocks) {
            expect(typeof block.markdown).toBe("string");
        }
    });
});
