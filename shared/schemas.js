import { z } from "zod";

const uuidSchema = z.string().uuid();

const conversationIdSchema = z.string().uuid();

const ruleItemTypeSchema = z.enum([
    "creature",
    "spell",
    "melee",
    "weapon",
    "armor",
    "equipment",
    "action",
    "feat",
    "spellcastingEntry",
    "trait",
    "condition",
    "effect",
    "class",
    "ancestry",
    "heritage",
    "background",
    "deity",
    "consumable",
    "ammo",
    "shield",
    "hazard",
    "treasure",
    "backpack",
]);

const abilityModSchema = z.object({ mod: z.number() });

const saveSchema = z.object({
    value: z.number(),
    saveDetail: z.string().optional(),
});

const skillSchema = z.object({
    value: z.number(),
    ability: z.string().optional(),
});

const acSchema = z.object({
    value: z.number(),
    details: z.string().optional(),
});

const hpSchema = z.object({
    value: z.number(),
    max: z.number(),
    details: z.string().optional(),
});

const meleeSchema = z.object({
    name: z.string(),
    attack: z.string(),
    damage: z.string(),
    damageType: z.string().optional(),
    compendiumSource: z.string().optional(),
    traits: z.array(z.string()).optional(),
});

const spellSlotSchema = z.object({
    name: z.string(),
    compendiumSource: z.string().optional(),
    rank: z.number().optional(),
    usage: z.string().optional(),
    heightened: z.boolean().optional(),
});

const spellcastingEntrySchema = z.object({
    name: z.string(),
    tradition: z.string().optional(),
    type: z.string().optional(),
    dc: z.number().optional(),
    attackModifier: z.number().optional(),
    slots: z.record(z.string(), z.array(spellSlotSchema)).optional(),
    cantrips: z.array(spellSlotSchema).optional(),
});

const actionEntrySchema = z.object({
    name: z.string(),
    actionType: z.union([z.number(), z.enum(["reaction", "free"])]).optional(),
    traits: z.array(z.string()).optional(),
    description: z.string(),
    compendiumSource: z.string().optional(),
    deathNote: z.boolean().optional(),
});

const creatureDataSchema = z.object({
    name: z.string(),
    type: z.string().optional(),
    level: z.number(),
    rarity: z.string().optional(),
    traits: z.array(z.string()),
    perception: z.number().optional(),
    languages: z
        .object({
            value: z.array(z.string()),
            details: z.string().optional(),
        })
        .optional(),
    initiative: z.string().optional(),
    size: z.string().optional(),
    blurb: z.string().optional(),
    publication: z
        .object({
            license: z.string().optional(),
            remaster: z.boolean().optional(),
            title: z.string().optional(),
        })
        .optional(),
    privateNotes: z.string().optional(),
    attributes: z.object({
        ac: acSchema.optional(),
        hp: hpSchema.optional(),
        fortitude: saveSchema.optional(),
        reflex: saveSchema.optional(),
        will: saveSchema.optional(),
        speed: z.string().optional(),
    }),
    abilities: z.object({
        str: abilityModSchema.optional(),
        dex: abilityModSchema.optional(),
        con: abilityModSchema.optional(),
        int: abilityModSchema.optional(),
        wis: abilityModSchema.optional(),
        cha: abilityModSchema.optional(),
    }),
    skills: z.record(z.string(), skillSchema).optional(),
    melee: z.array(meleeSchema).optional(),
    spellcasting: z.array(spellcastingEntrySchema).optional(),
    actions: z.array(actionEntrySchema).optional(),
    description: z.string().optional(),
    compendiumSource: z.string().optional(),
    itemRefs: z.array(z.string()).optional(),
});

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

const ensureTestUserSchema = z.object({
    userId: z.string().uuid(),
    name: z.string().min(1).max(100),
    mode: z.enum(["gm", "player"]),
});

const vectorChunkResultSchema = z.object({
    id: z.string(),
    ruleItemId: z.string(),
    ruleItemName: z.string(),
    ruleItemType: z.string(),
    compendiumSource: z.string().nullable().optional(),
    text: z.string(),
    score: z.number(),
});

// --- MessageBlock schemas for LLM output validation ---

const textBlockSchema = z.object({
    type: z.literal("text"),
    markdown: z.string(),
    italic: z.boolean().optional(),
});

const calloutBlockSchema = z.object({
    type: z.literal("callout"),
    title: z.string(),
    markdown: z.string(),
});

const statBlockMessageSchema = z.object({
    type: z.literal("stat-block"),
    // title is optional here: Gemini may omit it when anyOf schemas share
    // ruleItemId. resolveStatBlock falls back to the creature name from the DB.
    title: z.string().optional(),
    ruleItemId: z.string(),
    redacted: z.boolean().optional(),
});

const ruleDetailBlockSchema = z.object({
    type: z.literal("rule-detail"),
    ruleItemId: z.string(),
});

const messageBlockSchema = z.union([
    textBlockSchema,
    calloutBlockSchema,
    statBlockMessageSchema,
    ruleDetailBlockSchema,
]);

const messageBlocksArraySchema = z.array(messageBlockSchema);

// --- Gemini API response schema for summarization validation ---

const geminiResponseSchema = z.object({
    candidates: z
        .array(
            z.object({
                content: z
                    .object({
                        parts: z.array(
                            z.object({
                                text: z.string().optional(),
                            }),
                        ),
                    })
                    .optional(),
            }),
        )
        .optional(),
});

export {
    uuidSchema,
    conversationIdSchema,
    ruleItemTypeSchema,
    abilityModSchema,
    saveSchema,
    skillSchema,
    acSchema,
    hpSchema,
    meleeSchema,
    spellSlotSchema,
    spellcastingEntrySchema,
    actionEntrySchema,
    creatureDataSchema,
    messageSchema,
    conversationSchema,
    createConversationSchema,
    createMessageSchema,
    updateUserSchema,
    ensureTestUserSchema,
    vectorChunkResultSchema,
    textBlockSchema,
    calloutBlockSchema,
    statBlockMessageSchema,
    ruleDetailBlockSchema,
    messageBlockSchema,
    messageBlocksArraySchema,
    geminiResponseSchema,
};
