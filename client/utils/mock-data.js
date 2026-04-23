/** @typedef {import("../../shared/types.js").Message} Message */
/** @typedef {import("../../shared/types.js").Conversation} Conversation */

/** @type {Conversation[]} */
const MOCK_CONVERSATIONS = [
    { id: "1", title: "Mitflit King Capture" },
    { id: "2", title: "Chandelier Assassination" },
    { id: "3", title: "Buying rare reagents" },
];

/** @type {Message[]} */
const MOCK_MESSAGES = [
    {
        id: "1",
        role: "user",
        mode: "gm",
        content:
            "I'm a GM. My party just captured a mitflit king and wants to sell them at the market of a nearby settlement. How should I handle this?",
    },
    {
        id: "2",
        role: "assistant",
        mode: "gm",
        blocks: [
            {
                type: "paragraph",
                segments: [
                    {
                        text: "Selling a living, unique creature like a Mitflit King isn't a standard item transaction, so standard \"Sell Items\" rules don't perfectly apply. Here is the best way to adjudicate this using PF2e mechanics:",
                    },
                ],
            },
            {
                type: "callout",
                title: "1. Earn Income (Diplomacy)",
                segments: [
                    {
                        text: "Treat this as finding a buyer for exotic goods. Have the party face make an ",
                    },
                    { text: "Earn Income", highlight: true },
                    {
                        text: " check using Diplomacy. The creature is Level 4, so the DC should be ",
                    },
                    { text: "19", highlight: true },
                    {
                        text: ". The payout should be equivalent to a Level 4 task (approx. 5 gp per day spent arranging the sale).",
                    },
                ],
            },
            {
                type: "callout",
                title: "2. Setting the Scene",
                text: 'Don\'t just let them click "sell". Make it an event. The settlement\'s guard might demand a "Monster Handling Fee" (1d4 \u00d7 10 gp). The blacksmith might want it for a sick gladiatorial pit, while the town guard wants it executed.',
            },
            {
                type: "paragraph",
                segments: [
                    {
                        text: "Here is the exact stat block pulled from the system for your reference:",
                    },
                ],
                italic: true,
            },
            {
                type: "stat-block",
                title: "Mitflit King",
                data: {
                    name: "Mitflit King",
                    type: "npc",
                    level: 4,
                    traits: ["Goblinoid", "Humanoid", "Mitflit"],
                    perception: "+9",
                    languages: "Common, Goblin",
                    attributes: { ac: 21, hp: 55, fortitude: "+10", reflex: "+9", will: "+7" },
                    skills: {
                        acrobatics: "+9",
                        athletics: "+7",
                        deception: "+9",
                        intimidation: "+11",
                        stealth: "+9",
                    },
                    str: 2,
                    dex: 4,
                    con: 3,
                    int: 0,
                    wis: 1,
                    cha: 4,
                },
            },
        ],
    },
    {
        id: "3",
        role: "user",
        mode: "gm",
        content:
            "The blacksmith decided to buy the mitflit king. How could this affect the settlement's and the blacksmith's standing with the party? What else could happen to the mitflit king?",
    },
    {
        id: "4",
        role: "assistant",
        mode: "gm",
        blocks: [
            {
                type: "paragraph",
                text: "Here are a few narrative and mechanical hooks for this decision:",
            },
            {
                type: "list",
                items: [
                    {
                        title: "Reputation Shift (Faction):",
                        text: "If the town is lawful good, selling a sapient creature to a blacksmith for gladiatorial games might lower the party's standing with the Town Guard, but raise it with the local Thieves' Guild or Underworld.",
                    },
                    {
                        title: "The Blacksmith's Debt:",
                        segments: [
                            {
                                text: "The blacksmith might not have liquid cash. He could offer a custom-crafted level 4 magical weapon (like a ",
                            },
                            { text: "+1 Striking Warhammer", highlight: true },
                            { text: ") at a deep discount instead of gold." },
                        ],
                    },
                    {
                        title: "The Mitflit's Retinue:",
                        text: "A Mitflit King wouldn't be alone. The party might soon find their base of operations besieged by angry Mitflits trying to rescue their liege.",
                    },
                ],
            },
        ],
    },
    {
        id: "5",
        role: "user",
        mode: "player",
        content:
            "My fighter just got crit by a giant scorpion. How do I calculate the damage if I have resistance 5 to physical?",
    },
    {
        id: "6",
        role: "assistant",
        mode: "player",
        blocks: [
            {
                type: "paragraph",
                segments: [
                    {
                        text: "When you have resistance to a damage type, you subtract the resistance value from the total damage dealt after applying any weaknesses or immunities.",
                    },
                ],
            },
            {
                type: "callout",
                title: "Resistance Calculation",
                segments: [
                    { text: "If the giant scorpion's crit deals " },
                    { text: "28 slashing damage", highlight: true },
                    {
                        text: " and you have resistance 5 to physical, you take 28 - 5 = ",
                    },
                    { text: "23 damage", highlight: true },
                    { text: "." },
                ],
            },
            {
                type: "paragraph",
                text: "Note that resistance applies once per hit, not per damage die. If the attack includes multiple damage types (e.g. slashing + poison), resistance only applies to the matching type.",
            },
        ],
    },
];

export { MOCK_CONVERSATIONS, MOCK_MESSAGES };
