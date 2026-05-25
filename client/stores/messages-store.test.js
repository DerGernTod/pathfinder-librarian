import { describe, expect, it } from "bun:test";

import { createMessagesStore } from "./messages-store.js";

/**
 * Creates a ReadableStream that enqueues the given chunks then closes.
 * Each chunk is string content (will be Uint8Array-encoded).
 * @param {string[]} chunks
 * @returns {ReadableStream<Uint8Array>}
 */
function mockStream(chunks) {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });
}

/**
 * Collects all events from an async generator into an array.
 * @param {AsyncGenerator<import("./messages-store.js").SSEEvent>} gen
 * @returns {Promise<Array<{ type: string, data: unknown }>>}
 */
async function collect(gen) {
    /** @type {Array<{ type: string, data: unknown }>} */
    const events = [];
    for await (const event of gen) {
        events.push(event);
    }
    return events;
}

describe("parseSSEStream", () => {
    it("parses a single JSON line in one chunk", async () => {
        const stream = mockStream(['{"type":"test","data":42}\n']);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ type: "test", data: 42 });
    });

    it("parses multiple JSON lines in one chunk", async () => {
        const stream = mockStream([
            '{"type":"a","data":1}\n{"type":"b","data":2}\n{"type":"c","data":3}\n',
        ]);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(3);
        expect(events[0]).toEqual({ type: "a", data: 1 });
        expect(events[1]).toEqual({ type: "b", data: 2 });
        expect(events[2]).toEqual({ type: "c", data: 3 });
    });

    it("reassembles a line split across two chunks", async () => {
        const stream = mockStream(['{"type":"te', 'st","data":42}\n']);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ type: "test", data: 42 });
    });

    it("reassembles a line split at a newline boundary", async () => {
        const stream = mockStream(['{"type":"a","data":1}\n{"type":"b', '","data":2}\n']);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({ type: "a", data: 1 });
        expect(events[1]).toEqual({ type: "b", data: 2 });
    });

    it("reassembles a line split across three chunks", async () => {
        const stream = mockStream(['{"type', '":"test","', 'data":42}\n']);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ type: "test", data: 42 });
    });

    it("flushes remaining buffer at end of stream", async () => {
        const stream = mockStream(['{"type":"test","data":42}']);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ type: "test", data: 42 });
    });

    it("skips empty lines between valid lines", async () => {
        const stream = mockStream(['{"type":"a","data":1}\n\n{"type":"b","data":2}\n']);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({ type: "a", data: 1 });
        expect(events[1]).toEqual({ type: "b", data: 2 });
    });

    it("handles multi-byte characters split across chunks", async () => {
        const stream = mockStream(['{"type":"test","data":"caf', "\\u00e9", '"}\n']);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({ type: "test", data: "café" });
    });

    it("yields nothing for an empty stream", async () => {
        const stream = mockStream([]);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(0);
    });

    it("strips items missing required SSE shape", async () => {
        const stream = mockStream([
            '{"type":"valid","data":1}\n{"notype":true}\n{"type":"alsoValid","data":2}\n',
        ]);
        const events = await collect(createMessagesStore().parseSSEStream(stream));

        expect(events).toHaveLength(2);
        expect(events[0]).toEqual({ type: "valid", data: 1 });
        expect(events[1]).toEqual({ type: "alsoValid", data: 2 });
    });
});
