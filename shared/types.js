/** @typedef {"player" | "gm"} Mode */

/** @typedef {{ id: string, title: string }} Conversation */

/** @typedef {{ type: "paragraph", text: string, italic?: boolean }} ParagraphBlock */

/** @typedef {{ type: "callout", title: string, text: string }} CalloutBlock */

/** @typedef {{ type: "stat-block", title: string, data: Record<string, unknown> }} StatBlockMessageBlock */

/** @typedef {{ type: "list", items: Array<ListItem> }} ListBlock */

/** @typedef {{ title: string, text: string }} ListItem */

/** @typedef {ParagraphBlock | CalloutBlock | StatBlockMessageBlock | ListBlock} MessageBlock */

/** @typedef {{ id: string, role: "user", content: string }} UserMessage */

/** @typedef {{ id: string, role: "assistant", blocks: MessageBlock[] }} AssistantMessage */

/** @typedef {UserMessage | AssistantMessage} Message */

export {};
