import z from "zod";

import { conversationIdSchema } from "../../shared/schemas";

export const paramSchema = z.object({
    id: z.union([conversationIdSchema, z.literal("__new__")]),
});

/** Strict param schema for archive/restore/delete — rejects "__new__" */
export const strictParamSchema = z.object({
    id: conversationIdSchema,
});
