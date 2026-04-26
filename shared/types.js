/** @typedef {"player" | "gm"} Mode */

/** @typedef {{ id: string, title: string, userId: string, createdAt: string }} Conversation */

/** @typedef {{ id: string, name: string, initials: string, subtitle: string, mode: Mode }} User */

/** @typedef {{ id: string, type: "monster" | "spell" | "ability", name: string, data: any, createdAt: string }} RuleItem */

/** @typedef {{ text: string, highlight?: boolean }} Segment */

/** @typedef {{ type: "paragraph", text?: string, segments?: Segment[], italic?: boolean }} ParagraphBlock */

/** @typedef {{ type: "callout", title: string, text?: string, segments?: Segment[] }} CalloutBlock */

/** @typedef {{ name: string, modifier: number }} AbilityScore */

/** @typedef {{ name: string, bonus: number }} SkillEntry */

/** @typedef {{ name: string, actionType?: "single" | "two" | "three" | "reaction" | "free", description: string }} CreatureAction */

/** @typedef {{ name: string, dc?: number, attack?: number, description: string, tradition?: string, rank?: number }} SpellEntry */

/** @typedef {{ name: string, description: string }} AbilityEntry */

/** @typedef {{
 *   name: string,
 *   type: string,
 *   level: number,
 *   traits: string[],
 *   perception: string,
 *   languages: string,
 *   attributes: { ac: number, hp: number, fortitude: string, reflex: string, will: string },
 *   skills: Record<string, string>,
 *   str: number,
 *   dex: number,
 *   con: number,
 *   int: number,
 *   wis: number,
 *   cha: number,
 *   actions?: CreatureAction[],
 *   spells?: SpellEntry[],
 *   abilities?: AbilityEntry[]
 * }} MonsterStatBlock */

/** @typedef {{ type: "stat-block", title: string, data: MonsterStatBlock }} StatBlockMessageBlock */

/** @typedef {{ type: "list", items: Array<ListItem> }} ListBlock */

/** @typedef {{ title: string, text?: string, segments?: Segment[] }} ListItem */

/** @typedef {ParagraphBlock | CalloutBlock | StatBlockMessageBlock | ListBlock} MessageBlock */

/** @typedef {{ id: string, role: "user", content: string, mode: Mode, conversationId?: string }} UserMessage */

/** @typedef {{ id: string, role: "assistant", blocks: MessageBlock[], mode: Mode, conversationId?: string }} AssistantMessage */

/** @typedef {UserMessage | AssistantMessage} Message */

export {};
