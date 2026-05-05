import z from "zod";

import { conversationIdSchema } from "../../shared/schemas";

export const paramSchema = z.object({
    id: z.union([conversationIdSchema, z.literal("__new__")]),
});
