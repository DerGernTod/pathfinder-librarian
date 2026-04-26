import { db } from "./database.js";

/** Deterministic UUIDs for seed data — stable across restarts, usable in tests */
export const SEED_IDS = {
    USER_DEFAULT: "00000000-0000-4000-8000-000000000001",
    CONV_MITFLIT: "00000000-0000-4000-8000-000000000010",
    CONV_CHANDELIER: "00000000-0000-4000-8000-000000000011",
    CONV_REAGENTS: "00000000-0000-4000-8000-000000000012",
    RULE_MITFLIT_KING: "00000000-0000-4000-8000-000000000020",
    RULE_SAMPLE_SPELL: "00000000-0000-4000-8000-000000000021",
};

/**
 * Seeds the database with initial data if conversations table is empty.
 * @param {import("bun:sqlite").Database} database - The database instance to seed
 */
export function seedIfNeeded(database) {
    const count = database.query("SELECT COUNT(*) as count FROM conversations").get();
    if (count.count > 0) {
        return;
    }

    // Seed user
    database.run("INSERT INTO users (id, name, initials, subtitle, mode) VALUES (?, ?, ?, ?, ?)", [
        SEED_IDS.USER_DEFAULT,
        "Pathfinder GM",
        "PG",
        "Game Master",
        "gm",
    ]);

    // Seed conversations
    database.run("INSERT INTO conversations (id, title, user_id, created_at) VALUES (?, ?, ?, ?)", [
        SEED_IDS.CONV_MITFLIT,
        "Mitflit King Capture",
        SEED_IDS.USER_DEFAULT,
        "2025-01-01T12:00:00Z",
    ]);
    database.run("INSERT INTO conversations (id, title, user_id, created_at) VALUES (?, ?, ?, ?)", [
        SEED_IDS.CONV_CHANDELIER,
        "Chandelier Assassination",
        SEED_IDS.USER_DEFAULT,
        "2025-01-01T11:00:00Z",
    ]);
    database.run("INSERT INTO conversations (id, title, user_id, created_at) VALUES (?, ?, ?, ?)", [
        SEED_IDS.CONV_REAGENTS,
        "Buying rare reagents",
        SEED_IDS.USER_DEFAULT,
        "2025-01-01T10:00:00Z",
    ]);

    // Seed messages for Mitflit conversation
    const mitflitMessages = [
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_MITFLIT,
            role: "user",
            mode: "gm",
            content:
                "I'm a GM. My party just captured a mitflit king and wants to sell them at the market of a nearby settlement. How should I handle this?",
            blocksJson: null,
            createdAt: "2025-01-01T10:01:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_MITFLIT,
            role: "assistant",
            mode: "gm",
            content: null,
            blocksJson: JSON.stringify([
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
            ]),
            createdAt: "2025-01-01T10:02:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_MITFLIT,
            role: "user",
            mode: "gm",
            content:
                "The blacksmith decided to buy the mitflit king. How could this affect the settlement's and the blacksmith's standing with the party? What else could happen to the mitflit king?",
            blocksJson: null,
            createdAt: "2025-01-01T10:03:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_MITFLIT,
            role: "assistant",
            mode: "gm",
            content: null,
            blocksJson: JSON.stringify([
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
            ]),
            createdAt: "2025-01-01T10:04:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_MITFLIT,
            role: "user",
            mode: "player",
            content:
                "My fighter just got crit by a giant scorpion. How do I calculate the damage if I have resistance 5 to physical?",
            blocksJson: null,
            createdAt: "2025-01-01T10:05:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_MITFLIT,
            role: "assistant",
            mode: "player",
            content: null,
            blocksJson: JSON.stringify([
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
            ]),
            createdAt: "2025-01-01T10:06:00Z",
        },
    ];

    // Seed messages for Chandelier conversation
    const chandelierMessages = [
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_CHANDELIER,
            role: "user",
            mode: "gm",
            content:
                "My rogue wants to assassinate a noble by cutting the rope of a massive chandelier above them. What should I ask for in terms of checks?",
            blocksJson: null,
            createdAt: "2025-01-01T11:01:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_CHANDELIER,
            role: "assistant",
            mode: "gm",
            content: null,
            blocksJson: JSON.stringify([
                {
                    type: "paragraph",
                    segments: [
                        {
                            text: "This is a creative improvised action! Here's how to handle it:",
                        },
                    ],
                },
                {
                    type: "callout",
                    title: "Skill Checks Needed",
                    segments: [
                        {
                            text: "1. ",
                        },
                        { text: "Thievery (DC 18)", highlight: true },
                        {
                            text: " - to cut or weaken the rope unnoticed",
                        },
                        { text: "2. ", highlight: true },
                        { text: "Stealth (DC 20)", highlight: true },
                        {
                            text: " - to position themselves without detection",
                        },
                        { text: "3. ", highlight: true },
                        { text: "Timing check", highlight: true },
                        {
                            text: " - a free action to release when the noble is under it",
                        },
                    ],
                },
                {
                    type: "paragraph",
                    text: "If all succeed, deal 6d6 bludgeoning damage (DC 20 Reflex for half). If spotted early, guards intervene.",
                },
            ]),
            createdAt: "2025-01-01T11:02:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_CHANDELIER,
            role: "user",
            mode: "gm",
            content:
                "What if the noble notices and orders guards to attack? The rogue is on the rafters.",
            blocksJson: null,
            createdAt: "2025-01-01T11:03:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_CHANDELIER,
            role: "assistant",
            mode: "gm",
            content: null,
            blocksJson: JSON.stringify([
                {
                    type: "paragraph",
                    text: "This becomes a dynamic chase scene! Consider these complications:",
                },
                {
                    type: "list",
                    items: [
                        {
                            title: "Rafter Terrain:",
                            text: "Narrow, unstable surfaces. Acrobatics DC 15 to move without falling (10 ft fall damage). Guards have -2 to attack.",
                        },
                        {
                            title: "The Chandelier:",
                            segments: [
                                { text: "If the rogue cuts it now, they can drop it on " },
                                { text: "1d4 guards below", highlight: true },
                                { text: " for the same damage." },
                            ],
                        },
                        {
                            title: "Escape Options:",
                            text: "Through a window (Athletics DC 12 to climb out), down a nearby servant's stair, or use a grappling hook to swing to a balcony.",
                        },
                    ],
                },
            ]),
            createdAt: "2025-01-01T11:04:00Z",
        },
    ];

    // Seed messages for Reagents conversation
    const reagentsMessages = [
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_REAGENTS,
            role: "user",
            mode: "player",
            content:
                "I'm playing a wizard and need to buy dragon's blood for my potion research. Where can I find it and what should it cost?",
            blocksJson: null,
            createdAt: "2025-01-01T12:01:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_REAGENTS,
            role: "assistant",
            mode: "player",
            content: null,
            blocksJson: JSON.stringify([
                {
                    type: "paragraph",
                    segments: [
                        {
                            text: "Dragon's blood is a rare alchemical reagent. Here's how to handle it in your campaign:",
                        },
                    ],
                },
                {
                    type: "callout",
                    title: "Availability & Cost",
                    segments: [
                        {
                            text: "In a major settlement with a magic district, treat it as ",
                        },
                        { text: "Level 5 rare item", highlight: true },
                        {
                            text: ". Base cost: 25 gp per vial (enough for 1 potion or 2 scrolls).",
                        },
                    ],
                },
                {
                    type: "callout",
                    title: "Purchase Options",
                    segments: [
                        {
                            text: "1. ",
                        },
                        { text: "Alchemist's Shop", highlight: true },
                        {
                            text: " - DC 22 Diplomacy to find a supplier",
                        },
                        { text: "2. ", highlight: true },
                        { text: "Black Market", highlight: true },
                        {
                            text: " - DC 20 Underworld check, but watch for shady dealings",
                        },
                    ],
                },
                {
                    type: "paragraph",
                    text: "Your GM might require you to hunt a dragon yourself as a quest instead of buying it!",
                },
            ]),
            createdAt: "2025-01-01T12:02:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_REAGENTS,
            role: "user",
            mode: "player",
            content: "What level of dragon would have blood usable for a wizard's research?",
            blocksJson: null,
            createdAt: "2025-01-01T12:03:00Z",
        },
        {
            id: crypto.randomUUID(),
            conversationId: SEED_IDS.CONV_REAGENTS,
            role: "assistant",
            mode: "player",
            content: null,
            blocksJson: JSON.stringify([
                {
                    type: "paragraph",
                    text: "Most dragon blood is usable, but the quality affects potency:",
                },
                {
                    type: "list",
                    items: [
                        {
                            title: "Young or Adult Dragon:",
                            text: "Standard quality. Good for basic potions and scrolls. Blood harvested after death.",
                        },
                        {
                            title: "Ancient Dragon:",
                            segments: [
                                { text: "Superior quality. Grants a " },
                                { text: "+1 item bonus", highlight: true },
                                { text: " on crafting checks using this reagent." },
                            ],
                        },
                        {
                            title: "Extraction Method:",
                            text: "Non-lethal extraction is possible (Athletics or Medicine DC equal to dragon's Fortitude save) but yields 50% less blood and the dragon remembers...",
                        },
                    ],
                },
            ]),
            createdAt: "2025-01-01T12:04:00Z",
        },
    ];

    // Insert all messages
    const allMessages = [...mitflitMessages, ...chandelierMessages, ...reagentsMessages];
    const insertMessage = database.prepare(
        "INSERT INTO messages (id, conversation_id, role, mode, content, blocks_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const msg of allMessages) {
        insertMessage.run(
            msg.id,
            msg.conversationId,
            msg.role,
            msg.mode,
            msg.content,
            msg.blocksJson,
            msg.createdAt,
        );
    }

    // Seed rule items
    database.run(
        "INSERT INTO rule_items (id, type, name, data_json, created_at) VALUES (?, ?, ?, ?, ?)",
        [
            SEED_IDS.RULE_MITFLIT_KING,
            "monster",
            "Mitflit King",
            JSON.stringify({
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
            }),
            "2025-01-01T09:00:00Z",
        ],
    );

    database.run(
        "INSERT INTO rule_items (id, type, name, data_json, created_at) VALUES (?, ?, ?, ?, ?)",
        [
            SEED_IDS.RULE_SAMPLE_SPELL,
            "spell",
            "Fireball",
            JSON.stringify({
                name: "Fireball",
                level: 3,
                traditions: ["arcane", "primal"],
                cast: "two actions somatic, verbal",
                range: "120 feet",
                area: "20-foot burst",
                savingThrow: "Reflex",
                description: "A burst of fire explodes at a point you designate.",
            }),
            "2025-01-01T09:00:00Z",
        ],
    );
}

/**
 * Deletes all rows from all tables and reseeds with initial data.
 * Used by the dev-only /api/test/reset-db endpoint for E2E test isolation.
 * @param {import("bun:sqlite").Database} database - The database instance to reset
 */
export function resetAndReseedDb(database) {
    // Delete in reverse dependency order (respecting foreign keys)
    database.run("DELETE FROM messages");
    database.run("DELETE FROM conversations");
    database.run("DELETE FROM rule_items");
    database.run("DELETE FROM users");
    seedIfNeeded(database);
}

// Seed on module load for production DB
seedIfNeeded(db);
