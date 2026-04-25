import { z } from "zod";

const conversationIdSchema = z.string().uuid().or(z.string().regex(/^\d+$/));

const messageSchema = z.object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    mode: z.enum(["player", "gm"]),
    conversationId: z.string().optional(),
    content: z.string().optional(),
    blocks: z.array(z.any()).optional(),
});

const conversationSchema = z.object({
    id: z.string(),
    title: z.string(),
});

const createConversationSchema = z.object({
    title: z.string().min(1).max(200),
});

const createMessageSchema = z.object({
    content: z.string().min(1),
    mode: z.enum(["player", "gm"]),
});

export {
    conversationIdSchema,
    messageSchema,
    conversationSchema,
    createConversationSchema,
    createMessageSchema,
};
