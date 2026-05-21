import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { createDb } from "../db/database.js";
import { createConversation, createUser, getConversationById } from "../db/queries.js";
import { compactConversation } from "./compaction.js";

/** @param {string} text */
function geminiSummaryResponse(text) {
    return {
        ok: true,
        json: () =>
            Promise.resolve({
                candidates: [
                    {
                        content: {
                            parts: [{ text }],
                        },
                    },
                ],
            }),
    };
}

describe("compaction", () => {
    /** @type {ReturnType<typeof createDb>} */
    let db;
    /** @type {string} */
    let convId;

    beforeEach(() => {
        db = createDb(":memory:");
        const user = createUser(db, {
            name: "Test User",
            initials: "TU",
            subtitle: "Test",
            mode: "player",
            email: null,
            isTestUser: false,
        });
        const conv = createConversation(db, { title: "Test Chat", userId: user.id });
        convId = conv.id;
    });

    afterEach(() => {
        if (db) {
            db.close();
        }
        mock.restore();
        delete process.env.GOOGLE_AI_API_KEY;
    });

    describe("compactConversation", () => {
        it("returns null when contents are below threshold", async () => {
            const contents = [{ role: "user", parts: [{ text: "short message" }] }];
            const result = await compactConversation(db, convId, contents);
            expect(result).toBeNull();
        });

        it("returns null when contents are within keep-recent window", async () => {
            const contents = Array.from({ length: 4 }, (_, i) => ({
                role: i % 2 === 0 ? "user" : "model",
                parts: [{ text: `Turn ${i}` }],
            }));
            const result = await compactConversation(db, convId, contents, 10);
            expect(result).toBeNull();
        });

        it("calls summarization and stores summary when threshold exceeded", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";
            const summaryText = "This is a summary of the conversation.";

            globalThis.fetch = /** @type {typeof fetch} */ (
                /** @type {unknown} */ (
                    mock(() => Promise.resolve(geminiSummaryResponse(summaryText)))
                )
            );

            const oldTurns = Array.from({ length: 30 }, (_, i) => ({
                role: i % 2 === 0 ? "user" : "model",
                parts: [{ text: `x`.repeat(1000) }],
            }));

            const result = await compactConversation(db, convId, oldTurns, 100);

            expect(result).toBe(summaryText);

            const conv = getConversationById(db, convId);
            expect(conv?.compactedSummary).toBe(summaryText);
        });

        it("returns null on summarization failure", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";

            globalThis.fetch = /** @type {typeof fetch} */ (
                /** @type {unknown} */ (
                    mock(() =>
                        Promise.resolve({
                            ok: false,
                            status: 500,
                            text: () => Promise.resolve("Server Error"),
                        }),
                    )
                )
            );

            const oldTurns = Array.from({ length: 30 }, (_, i) => ({
                role: i % 2 === 0 ? "user" : "model",
                parts: [{ text: `x`.repeat(1000) }],
            }));

            const result = await compactConversation(db, convId, oldTurns, 100);

            expect(result).toBeNull();

            const conv = getConversationById(db, convId);
            expect(conv?.compactedSummary).toBeNull();
        });

        it("skips summarization when compacted summary already exists", async () => {
            process.env.GOOGLE_AI_API_KEY = "test-key";

            /** @type {import("bun:test").Mock<() => Promise<unknown>>} */
            const fetchMock = mock(() =>
                Promise.resolve(geminiSummaryResponse("should not be called")),
            );
            globalThis.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));

            db.run("UPDATE conversations SET compacted_summary = ? WHERE id = ?", [
                "Existing summary.",
                convId,
            ]);

            const oldTurns = Array.from({ length: 30 }, (_, i) => ({
                role: i % 2 === 0 ? "user" : "model",
                parts: [{ text: `x`.repeat(1000) }],
            }));

            const result = await compactConversation(db, convId, oldTurns, 100);

            expect(result).toBeNull();
            expect(fetchMock).not.toHaveBeenCalled();

            const conv = getConversationById(db, convId);
            expect(conv?.compactedSummary).toBe("Existing summary.");
        });
    });
});
