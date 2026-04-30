import { z } from "zod";

const uuidSchema = z.string().uuid();

const conversationIdSchema = z.string().uuid();

const ruleItemTypeSchema = z.enum(["monster", "spell", "ability"]);

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

const updateUserSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    mode: z.enum(["gm", "player"]).optional(),
    subtitle: z.string().max(200).optional(),
});

export {
    uuidSchema,
    conversationIdSchema,
    ruleItemTypeSchema,
    messageSchema,
    conversationSchema,
    createConversationSchema,
    createMessageSchema,
    updateUserSchema,
};
