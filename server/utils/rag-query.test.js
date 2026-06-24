import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { createSingleEmbedding, queryRagContext } from "./rag-query.js";

/**
 * Build a fake VectorStore that records search() calls and returns canned hits.
 * @param {Array<{ chunk: { id: string, ruleItemId: string, ruleItemName: string, ruleItemType: string, compendiumSource: string | null, text: string }, score: number }>} hits
 * @param {{ reject?: Error }} [opts]
 */
function makeFakeStore(hits, opts = {}) {
    /** @type {Array<{ topN: number, threshold?: number }>} */
    const searchCalls = [];
    let available = true;
    const store = {
        collectionName: "rule_chunks",
        client: null,
        isAvailable: () => available,
        ensureCollection: async () => true,
        async search(
            /** @type {number[]} */ _queryEmbedding,
            /** @type {{ topN?: number, threshold?: number }} */ callOpts = {},
        ) {
            searchCalls.push({
                topN: callOpts.topN ?? 5,
                threshold: callOpts.threshold,
            });
            if (opts.reject) {
                throw opts.reject;
            }
            return hits;
        },
        async getChunksByRuleItemId() {
            return [];
        },
        async upsertChunks() {
            return { upserted: 0 };
        },
        _setAvailable(/** @type {boolean} */ v) {
            available = v;
        },
        _searchCalls: searchCalls,
    };
    return store;
}

describe("rag-query", () => {
    const originalApiKey = process.env.GOOGLE_AI_API_KEY;
    const originalMockAi = process.env.MOCK_GOOGLE_AI;

    afterEach(() => {
        if (originalApiKey !== undefined) {
            process.env.GOOGLE_AI_API_KEY = originalApiKey;
        } else {
            delete process.env.GOOGLE_AI_API_KEY;
        }
        if (originalMockAi !== undefined) {
            process.env.MOCK_GOOGLE_AI = originalMockAi;
        } else {
            delete process.env.MOCK_GOOGLE_AI;
        }
    });

    describe("createSingleEmbedding", () => {
        it("wraps single text into array and returns first result", async () => {
            process.env.MOCK_GOOGLE_AI = "1";
            const embedding = await createSingleEmbedding(
                "test prompt",
                "fake-key",
                "gemini-embedding-001",
            );
            expect(Array.isArray(embedding)).toBe(true);
            expect(embedding.length).toBeGreaterThan(0);
        });
    });

    describe("queryRagContext", () => {
        beforeEach(() => {
            process.env.MOCK_GOOGLE_AI = "1";
            process.env.GOOGLE_AI_API_KEY = "test-key";
        });

        it("returns empty context when no vectorStore provided", async () => {
            const result = await queryRagContext("What is Fireball?", { vectorStore: null });
            expect(result.contextText).toBe("");
            expect(result.sources).toEqual([]);
            expect(result.embeddingTokens).toBe(0);
        });

        it("returns empty context when API key is missing", async () => {
            delete process.env.GOOGLE_AI_API_KEY;
            const store = makeFakeStore([]);
            const result = await queryRagContext("What is Fireball?", { vectorStore: store });
            expect(result.contextText).toBe("");
            expect(result.sources).toEqual([]);
            expect(result.embeddingTokens).toBe(0);
        });

        it("returns empty context when store is unavailable", async () => {
            const store = makeFakeStore([]);
            store._setAvailable(false);
            let ensureCalls = 0;
            store.ensureCollection = async () => {
                ensureCalls++;
                return false;
            };
            const result = await queryRagContext("anything", { vectorStore: store });
            expect(result.contextText).toBe("");
            expect(ensureCalls).toBe(1);
        });

        it("lazily triggers ensureCollection when not yet available", async () => {
            const store = makeFakeStore([]);
            store._setAvailable(false);
            let ensureCalls = 0;
            store.ensureCollection = async () => {
                ensureCalls++;
                store._setAvailable(true);
                return true;
            };
            await queryRagContext("anything", { vectorStore: store });
            expect(ensureCalls).toBe(1);
        });

        it("returns formatted context with matched chunks", async () => {
            const store = makeFakeStore([
                {
                    chunk: {
                        id: "c1",
                        ruleItemId: "ri1",
                        ruleItemName: "Fireball",
                        ruleItemType: "spell",
                        compendiumSource: "Pathfinder Core Rulebook",
                        text: "Spell: Fireball (Rank 3). Traditions: arcane, primal.",
                    },
                    score: 0.95,
                },
            ]);
            const result = await queryRagContext("What is Fireball?", {
                vectorStore: store,
                topN: 5,
                threshold: 0.1,
            });
            expect(result.contextText).toContain("retrieved-context");
            expect(result.contextText).toContain("Fireball");
            expect(result.sources).toHaveLength(1);
            expect(result.sources[0].name).toBe("Fireball");
            expect(result.sources[0].type).toBe("spell");
            expect(result.sources[0].score).toBeGreaterThan(0);
        });

        it("passes overfetch = max(topN * 5, 25) to store.search()", async () => {
            const store = makeFakeStore([]);
            await queryRagContext("anything", { vectorStore: store, topN: 5 });
            expect(store._searchCalls).toHaveLength(1);
            expect(store._searchCalls[0].topN).toBe(25);
        });

        it("overfetch = max(topN * 5, 25) for topN < 5 still meets min 25", async () => {
            const store = makeFakeStore([]);
            await queryRagContext("anything", { vectorStore: store, topN: 2 });
            expect(store._searchCalls[0].topN).toBe(25);
        });

        it("overfetch scales with large topN", async () => {
            const store = makeFakeStore([]);
            await queryRagContext("anything", { vectorStore: store, topN: 10 });
            expect(store._searchCalls[0].topN).toBe(50);
        });

        it("deduplicates by rule item ID keeping highest score (first hit)", async () => {
            const store = makeFakeStore([
                {
                    chunk: {
                        id: "c1",
                        ruleItemId: "ri1",
                        ruleItemName: "Fireball",
                        ruleItemType: "spell",
                        compendiumSource: null,
                        text: "Fireball description",
                    },
                    score: 0.9,
                },
                {
                    chunk: {
                        id: "c2",
                        ruleItemId: "ri1",
                        ruleItemName: "Fireball",
                        ruleItemType: "spell",
                        compendiumSource: null,
                        text: "Fireball heightened",
                    },
                    score: 0.7,
                },
            ]);
            const result = await queryRagContext("Fireball?", {
                vectorStore: store,
                topN: 5,
            });
            expect(result.sources).toHaveLength(1);
            expect(result.sources[0].name).toBe("Fireball");
        });

        it("redacts creature chunk data when mode is player", async () => {
            const store = makeFakeStore([
                {
                    chunk: {
                        id: "c1",
                        ruleItemId: "ri1",
                        ruleItemName: "Orc Warrior",
                        ruleItemType: "creature",
                        compendiumSource: null,
                        text: "AC 21; Fort +10, Ref +9, Will +7\nHP 55/55\nTraits: Orc, Humanoid",
                    },
                    score: 0.9,
                },
            ]);
            const result = await queryRagContext("Tell me about the orc", {
                vectorStore: store,
                topN: 5,
                mode: "player",
            });
            expect(result.contextText).not.toContain("AC 21");
            expect(result.contextText).not.toContain("HP 55");
            expect(result.contextText).toContain("Orc Warrior");
            expect(result.contextText).toContain("Traits: Orc, Humanoid");
        });

        it("preserves non-creature data when mode is player", async () => {
            const store = makeFakeStore([
                {
                    chunk: {
                        id: "c1",
                        ruleItemId: "ri1",
                        ruleItemName: "Fireball",
                        ruleItemType: "spell",
                        compendiumSource: null,
                        text: "Spell: Fireball (Rank 3). Traditions: arcane, primal.",
                    },
                    score: 0.9,
                },
            ]);
            const result = await queryRagContext("What is Fireball?", {
                vectorStore: store,
                topN: 5,
                mode: "player",
            });
            expect(result.contextText).toContain("Fireball");
            expect(result.contextText).toContain("Rank 3");
        });

        it("returns full data when mode is gm", async () => {
            const store = makeFakeStore([
                {
                    chunk: {
                        id: "c1",
                        ruleItemId: "ri1",
                        ruleItemName: "Orc Warrior",
                        ruleItemType: "creature",
                        compendiumSource: null,
                        text: "AC 21; Fort +10, Ref +9, Will +7\nHP 55/55",
                    },
                    score: 0.9,
                },
            ]);
            const result = await queryRagContext("Tell me about the orc", {
                vectorStore: store,
                topN: 5,
                mode: "gm",
            });
            expect(result.contextText).toContain("AC 21");
            expect(result.contextText).toContain("HP 55");
        });

        it("returns embeddingTokens on success", async () => {
            const store = makeFakeStore([
                {
                    chunk: {
                        id: "c1",
                        ruleItemId: "ri1",
                        ruleItemName: "Fireball",
                        ruleItemType: "spell",
                        compendiumSource: null,
                        text: "Spell: Fireball.",
                    },
                    score: 0.9,
                },
            ]);
            const prompt = "What is Fireball?";
            const result = await queryRagContext(prompt, {
                vectorStore: store,
                topN: 5,
            });
            expect(result.embeddingTokens).toBe(Math.ceil(prompt.length / 4));
        });

        it("returns embeddingTokens when no results returned", async () => {
            const store = makeFakeStore([]);
            const prompt = "A very specific query about xyz";
            const result = await queryRagContext(prompt, {
                vectorStore: store,
                topN: 5,
                threshold: 0.99,
            });
            expect(result.embeddingTokens).toBe(Math.ceil(prompt.length / 4));
        });

        it("returns embeddingTokens: 0 in error catch path (store rejects)", async () => {
            const store = makeFakeStore([], { reject: new Error("simulated failure") });
            const result = await queryRagContext("test", { vectorStore: store });
            expect(result.embeddingTokens).toBe(0);
            expect(result.contextText).toContain("Error in queryRagContext");
        });

        it("estimate formula matches Math.ceil(prompt.length / 4)", async () => {
            const store = makeFakeStore([
                {
                    chunk: {
                        id: "c1",
                        ruleItemId: "ri1",
                        ruleItemName: "Test",
                        ruleItemType: "spell",
                        compendiumSource: null,
                        text: "Test text",
                    },
                    score: 0.9,
                },
            ]);
            const shortPrompt = "Hi";
            const result = await queryRagContext(shortPrompt, {
                vectorStore: store,
                topN: 5,
            });
            expect(result.embeddingTokens).toBe(Math.ceil("Hi".length / 4));
            expect(result.embeddingTokens).toBe(1);
        });
    });
});
