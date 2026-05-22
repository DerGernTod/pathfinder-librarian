/** @typedef {"player" | "gm"} Mode */

/** @typedef {{ id: string, title: string, userId?: string, createdAt?: string, compactedSummary?: string | null }} Conversation */

/** @typedef {{ id: string, name: string, initials: string, subtitle: string, mode: Mode, email: string | null, isTestUser?: boolean, webauthnUserId?: string }} AuthUser */

/** @typedef {{ id: string, name: string, initials: string, subtitle: string, mode: Mode }} User */

/** @typedef {{ id: string, type: "creature" | "spell" | "melee" | "weapon" | "armor" | "equipment" | "action" | "feat" | "spellcastingEntry" | "trait" | "condition" | "effect" | "class" | "ancestry" | "heritage" | "background" | "deity" | "consumable" | "ammo" | "shield" | "hazard" | "treasure" | "backpack", name: string, compendiumSource?: string, parentId?: string, linkedSource?: string, data: unknown, createdAt: string }} RuleItem */

/** @typedef {{ id: string, userId: string, token: string, createdAt: string, expiresAt: string }} Session */

/** @typedef {{ id: string, userId: string, publicKey: string, counter: number, deviceType: string, backedUp: boolean, transports: string[] | null, aaguid: string, createdAt: string }} Credential */

/** @typedef {{ type: "text", markdown: string, italic?: boolean }} TextBlock */

/** @typedef {{ type: "callout", title: string, markdown: string }} CalloutBlock */

/** @typedef {{ mod: number }} AbilityMod */
/** @typedef {{ value: number, details?: string }} AcValue */
/** @typedef {{ value: number, max: number, details?: string }} HpValue */
/** @typedef {{ value: number, saveDetail?: string }} SaveValue */
/** @typedef {{ value: number, ability?: string }} SkillValue */

/** @typedef {{ name: string, attack: string, damage: string, damageType?: string, compendiumSource?: string, traits?: string[], traitRefs?: Array<{ name: string, ruleItemId?: string }> }} MeleeEntry */

/** @typedef {{ name: string, compendiumSource?: string, rank?: number, usage?: string, heightened?: boolean }} SpellSlotEntry */

/** @typedef {{ name: string, tradition?: string, type?: string, dc?: number, attackModifier?: number, slots?: Record<string, SpellSlotEntry[]>, cantrips?: SpellSlotEntry[] }} SpellcastingEntry */

/** @typedef {{ name: string, actionType?: number | "reaction" | "free", traits?: string[], traitRefs?: Array<{ name: string, ruleItemId?: string }>, description: string, compendiumSource?: string, deathNote?: boolean, descriptionSegments?: Array<{ text: string, ruleItemId?: string }> }} ActionEntry */

/**
 * @typedef {{
 *   name: string,
 *   type?: string,
 *   level: number,
 *   rarity?: string,
 *   traits: string[],
 *   perception?: number,
 *   languages?: { value: string[], details?: string },
 *   initiative?: string,
 *   size?: string,
 *   blurb?: string,
 *   publication?: { license?: string, remaster?: boolean, title?: string },
 *   privateNotes?: string,
 *   attributes?: {
 *     ac?: AcValue,
 *     hp?: HpValue,
 *     fortitude?: SaveValue,
 *     reflex?: SaveValue,
 *     will?: SaveValue,
 *     speed?: string,
 *   },
 *   abilities?: {
 *     str?: AbilityMod,
 *     dex?: AbilityMod,
 *     con?: AbilityMod,
 *     int?: AbilityMod,
 *     wis?: AbilityMod,
 *     cha?: AbilityMod,
 *   },
 *   skills?: Record<string, SkillValue>,
 *   melee?: MeleeEntry[],
 *   spellcasting?: SpellcastingEntry[],
 *   actions?: ActionEntry[],
 *   description?: string,
 *   compendiumSource?: string,
 *   itemRefs?: string[],
 *   traitRefs?: Array<{ name: string, ruleItemId?: string }>,
 * }} CreatureData
 */

/** @typedef {{ type: "stat-block", title?: string, data?: CreatureData, ruleItemId?: string, redacted?: boolean }} StatBlockMessageBlock */

/**
 * Relaxed creature data for LLM-emitted custom stat blocks.
 * Only `name` and `level` are required; all other fields are optional.
 * @typedef {{
 *   name: string,
 *   type?: string,
 *   level: number,
 *   rarity?: string,
 *   traits?: string[],
 *   perception?: number,
 *   languages?: { value: string[], details?: string },
 *   size?: string,
 *   blurb?: string,
 *   attributes?: {
 *     ac?: { value: number, details?: string },
 *     hp?: { value: number, max: number, details?: string },
 *     fortitude?: { value: number, saveDetail?: string },
 *     reflex?: { value: number, saveDetail?: string },
 *     will?: { value: number, saveDetail?: string },
 *     speed?: string,
 *   },
 *   abilities?: {
 *     str?: { mod: number },
 *     dex?: { mod: number },
 *     con?: { mod: number },
 *     int?: { mod: number },
 *     wis?: { mod: number },
 *     cha?: { mod: number },
 *   },
 *   skills?: Record<string, { value: number }>,
 *   melee?: Array<{ name: string, attack: string, damage: string, damageType?: string, traits?: string[] }>,
 *   actions?: Array<{ name: string, actionType?: number | "reaction" | "free", traits?: string[], description: string }>,
 *   spellcasting?: Array<{ name: string, tradition?: string, type?: string, dc?: number, attackModifier?: number, slots?: Record<string, Array<{ name: string, rank?: number }>>, cantrips?: Array<{ name: string, rank?: number }> }>,
 *   description?: string,
 * }} CustomCreatureData
 */

/** @typedef {{ type: "custom-stat-block", title: string, data: CustomCreatureData }} CustomStatBlockMessageBlock */

/** @typedef {{ type: "rule-detail", ruleItemId?: string, title?: string, category?: string, description?: string, traits?: string[] }} RuleDetailBlock */

/** @typedef {{ name: string, ruleItemId?: string }} TraitRef */

/** @typedef {TextBlock | CalloutBlock | StatBlockMessageBlock | CustomStatBlockMessageBlock | RuleDetailBlock} MessageBlock */

/** @typedef {{ id: string, type: string, name: string, compendiumSource: string, dataJson: string, parentId?: string, linkedSource?: string, itemRefs?: string[] }} ImportableRuleItem */

/** @typedef {{ id: string, ruleItemId: string, ruleItemName: string, ruleItemType: string, compendiumSource: string | undefined, chunkIndex: number, text: string, embedding?: number[] }} VectorChunk */

/** @typedef {{ name: string, type: string, score: number }} RagSource */

/** @typedef {{ contextText: string, sources: Array<RagSource>, embeddingTokens?: number }} RagContext */

/** @typedef {{ promptTokenCount?: number, candidatesTokenCount?: number, totalTokenCount?: number }} UsageMeta */

/** @typedef {{ resultCount: number, usage?: UsageMeta, embeddingTokens?: number }} RagMeta */

/** @typedef {{ inserted: number, updated: number, skipped: number, errors: number }} ImportResult */

/** @typedef {{ id: string, role: "user", content: string, blocks?: never, mode: Mode, conversationId: string, createdAt: string }} UserMessage */

/** @typedef {{ id: string, role: "assistant", blocks: MessageBlock[] | null, blocksJson?: string, mode: Mode, conversationId: string, content: null, createdAt: string, ragMeta?: RagMeta }} AssistantMessage */

/** @typedef {UserMessage | AssistantMessage} Message */

export {};
