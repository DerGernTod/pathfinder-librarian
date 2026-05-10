import { SEED_IDS } from "../../shared/constants.js";
export { SEED_IDS };

import { db } from "./database.js";

/**
 * Seeds the database with initial data if conversations table is empty.
 * @param {import("bun:sqlite").Database} database - The database instance to seed
 */
export function seedIfNeeded(database) {
    const count = database.query("SELECT COUNT(*) as count FROM conversations").get();
    if (count.count > 0) {
        return;
    }

    // Seed users
    database.run(
        "INSERT INTO users (id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            SEED_IDS.USER_DEFAULT,
            "Pathfinder GM",
            "PG",
            "Game Master",
            "gm",
            "gm@test.local",
            1,
            "webauthn-gm-default-user-id",
        ],
    );

    database.run(
        "INSERT INTO users (id, name, initials, subtitle, mode, email, is_test_user, webauthn_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            SEED_IDS.USER_TEST_PLAYER,
            "Valeros",
            "VA",
            "Player",
            "player",
            "valeros@test.local",
            1,
            crypto.randomUUID(),
        ],
    );

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
        SEED_IDS.USER_TEST_PLAYER,
        "2025-01-01T10:00:00Z",
    ]);

    // Seed messages for Mitflit conversation
    _seedMitflitMessages(database, SEED_IDS.CONV_MITFLIT);

    // Seed messages for Chandelier conversation
    _seedChandelierMessages(database, SEED_IDS.CONV_CHANDELIER);

    // Seed messages for Reagents conversation
    _seedReagentsMessages(database, SEED_IDS.CONV_REAGENTS);

    // Seed rule items
    seedRuleItems(database);
}

// ─── Message content arrays (shared between global seed and per-user seed) ───

const MITFLIT_MESSAGES = [
    {
        role: "user",
        mode: "gm",
        content:
            "I'm a GM. My party just captured a mitflit king and wants to sell them at the market of a nearby settlement. How should I handle this?",
        blocksJson: null,
        createdAt: "2025-01-01T10:01:00Z",
    },
    {
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
                    type: "NPC",
                    level: 4,
                    rarity: "unique",
                    traits: ["Goblinoid", "Humanoid", "Mitflit"],
                    perception: 9,
                    languages: { value: ["Common", "Goblin"], details: "" },
                    attributes: {
                        ac: { value: 21 },
                        hp: { value: 55, max: 55 },
                        fortitude: { value: 10 },
                        reflex: { value: 9 },
                        will: { value: 7 },
                        speed: "25 feet",
                    },
                    abilities: {
                        str: { mod: 2 },
                        dex: { mod: 4 },
                        con: { mod: 3 },
                        int: { mod: 0 },
                        wis: { mod: 1 },
                        cha: { mod: 4 },
                    },
                    skills: {
                        Acrobatics: { value: 9 },
                        Athletics: { value: 7 },
                        Deception: { value: 9 },
                        Intimidation: { value: 11 },
                        Stealth: { value: 9 },
                    },
                    melee: [
                        {
                            name: "dagger",
                            attack: "+9 (agile, finesse, versatile S)",
                            damage: "1d4+4 piercing",
                            damageType: "piercing",
                            traits: ["agile", "finesse"],
                        },
                    ],
                    spellcasting: [
                        {
                            name: "Mitflit Innate Spells",
                            tradition: "occult",
                            type: "innate",
                            dc: 17,
                            attackModifier: 7,
                            cantrips: [{ name: "Daze", rank: 1 }],
                            slots: { "1st": [{ name: "Illusory Disguise", rank: 1 }] },
                        },
                    ],
                    actions: [
                        {
                            name: "Sneak",
                            actionType: 1,
                            traits: ["move"],
                            description:
                                "The mitflit Strides up to its Speed plus 5 feet and attempts a Stealth check.",
                        },
                        {
                            name: "Cowardly Snare",
                            actionType: "reaction",
                            traits: ["manipulate"],
                            description: "Trigger: A creature moves within 10 feet of the mitflit.",
                        },
                    ],
                },
            },
        ]),
        createdAt: "2025-01-01T10:02:00Z",
    },
    {
        role: "user",
        mode: "gm",
        content:
            "The blacksmith decided to buy the mitflit king. How could this affect the settlement's and the blacksmith's standing with the party? What else could happen to the mitflit king?",
        blocksJson: null,
        createdAt: "2025-01-01T10:03:00Z",
    },
    {
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
        role: "user",
        mode: "player",
        content:
            "My fighter just got crit by a giant scorpion. How do I calculate the damage if I have resistance 5 to physical?",
        blocksJson: null,
        createdAt: "2025-01-01T10:05:00Z",
    },
    {
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

const CHANDELIER_MESSAGES = [
    {
        role: "user",
        mode: "gm",
        content:
            "My rogue wants to assassinate a noble by cutting the rope of a massive chandelier above them. What should I ask for in terms of checks?",
        blocksJson: null,
        createdAt: "2025-01-01T11:01:00Z",
    },
    {
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
        role: "user",
        mode: "gm",
        content:
            "What if the noble notices and orders guards to attack? The rogue is on the rafters.",
        blocksJson: null,
        createdAt: "2025-01-01T11:03:00Z",
    },
    {
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

const REAGENTS_MESSAGES = [
    {
        role: "user",
        mode: "player",
        content:
            "I'm playing a wizard and need to buy dragon's blood for my potion research. Where can I find it and what should it cost?",
        blocksJson: null,
        createdAt: "2025-01-01T12:01:00Z",
    },
    {
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
        role: "user",
        mode: "player",
        content: "What level of dragon would have blood usable for a wizard's research?",
        blocksJson: null,
        createdAt: "2025-01-01T12:03:00Z",
    },
    {
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

// ─── Helper functions for inserting messages ───

/**
 * Inserts messages for the Mitflit conversation.
 * @param {import("bun:sqlite").Database} database
 * @param {string} conversationId
 */
function _seedMitflitMessages(database, conversationId) {
    _insertMessages(database, MITFLIT_MESSAGES, conversationId);
}

/**
 * Inserts messages for the Chandelier conversation.
 * @param {import("bun:sqlite").Database} database
 * @param {string} conversationId
 */
function _seedChandelierMessages(database, conversationId) {
    _insertMessages(database, CHANDELIER_MESSAGES, conversationId);
}

/**
 * Inserts messages for the Reagents conversation.
 * @param {import("bun:sqlite").Database} database
 * @param {string} conversationId
 */
function _seedReagentsMessages(database, conversationId) {
    _insertMessages(database, REAGENTS_MESSAGES, conversationId);
}

/**
 * Generic message insertion helper.
 * @param {import("bun:sqlite").Database} database
 * @param {Array<{ role: string, mode: string, content: string | null, blocksJson: string | null, createdAt: string }>} messages
 * @param {string} conversationId
 */
function _insertMessages(database, messages, conversationId) {
    const insertMessage = database.prepare(
        "INSERT INTO messages (id, conversation_id, role, mode, content, blocks_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const msg of messages) {
        insertMessage.run(
            crypto.randomUUID(),
            conversationId,
            msg.role,
            msg.mode,
            msg.content,
            msg.blocksJson,
            msg.createdAt,
        );
    }
}

// ─── Rule items seeding ───

/**
 * Seeds rule_items if none exist.
 * @param {import("bun:sqlite").Database} database
 */
export function seedRuleItems(database) {
    const count = database.query("SELECT COUNT(*) as count FROM rule_items").get();
    if (count.count > 0) {
        return;
    }

    database.run(
        "INSERT INTO rule_items (id, type, name, compendium_source, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
            SEED_IDS.RULE_MITFLIT_KING,
            "creature",
            "Mitflit King",
            null,
            JSON.stringify({
                name: "Mitflit King",
                type: "NPC",
                level: 4,
                rarity: "unique",
                traits: ["Goblinoid", "Humanoid", "Mitflit"],
                perception: 9,
                languages: { value: ["Common", "Goblin"], details: "" },
                attributes: {
                    ac: { value: 21 },
                    hp: { value: 55, max: 55 },
                    fortitude: { value: 10 },
                    reflex: { value: 9 },
                    will: { value: 7 },
                    speed: "25 feet",
                },
                abilities: {
                    str: { mod: 2 },
                    dex: { mod: 4 },
                    con: { mod: 3 },
                    int: { mod: 0 },
                    wis: { mod: 1 },
                    cha: { mod: 4 },
                },
                skills: {
                    Acrobatics: { value: 9 },
                    Athletics: { value: 7 },
                    Deception: { value: 9 },
                    Intimidation: { value: 11 },
                    Stealth: { value: 9 },
                },
                melee: [
                    {
                        name: "dagger",
                        attack: "+9 (agile, finesse, versatile S)",
                        damage: "1d4+4 piercing",
                        damageType: "piercing",
                        traits: ["agile", "finesse"],
                    },
                ],
                spellcasting: [
                    {
                        name: "Mitflit Innate Spells",
                        tradition: "occult",
                        type: "innate",
                        dc: 17,
                        attackModifier: 7,
                        cantrips: [{ name: "Daze", rank: 1 }],
                        slots: { "1st": [{ name: "Illusory Disguise", rank: 1 }] },
                    },
                ],
                actions: [
                    {
                        name: "Sneak",
                        actionType: 1,
                        traits: ["move"],
                        description:
                            "The mitflit Strides up to its Speed plus 5 feet and attempts a Stealth check.",
                    },
                    {
                        name: "Cowardly Snare",
                        actionType: "reaction",
                        traits: ["manipulate"],
                        description: "Trigger: A creature moves within 10 feet of the mitflit.",
                    },
                ],
            }),
            "2025-01-01T09:00:00Z",
        ],
    );

    database.run(
        "INSERT INTO rule_items (id, type, name, compendium_source, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
            SEED_IDS.RULE_SAMPLE_SPELL,
            "spell",
            "Fireball",
            null,
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

// ─── Clear all tables ───

/**
 * Deletes all rows from all tables in reverse FK order without reseeding.
 * @param {import("bun:sqlite").Database} database
 */
export function clearAllTables(database) {
    database.run("DELETE FROM messages");
    database.run("DELETE FROM conversations");
    database.run("DELETE FROM rule_items");
    database.run("DELETE FROM challenges");
    database.run("DELETE FROM sessions");
    database.run("DELETE FROM credentials");
    database.run("DELETE FROM users");
}

// ─── Per-user seeding ───

/**
 * Seeds 2 conversations with messages for a given user. Idempotent.
 * @param {import("bun:sqlite").Database} database
 * @param {string} userId
 * @param {"gm" | "player"} _mode - Sets the user's mode; seeded messages retain original per-message modes
 */
export function seedForUser(database, userId, _mode) {
    // Idempotent: skip if conversations already exist for this user
    const count = database
        .query("SELECT COUNT(*) as count FROM conversations WHERE user_id = ?")
        .get(userId);
    if (count.count > 0) {
        return;
    }

    const conv1Id = crypto.randomUUID();
    const conv2Id = crypto.randomUUID();

    database.run("INSERT INTO conversations (id, title, user_id, created_at) VALUES (?, ?, ?, ?)", [
        conv1Id,
        "Mitflit King Capture",
        userId,
        "2025-01-01T12:00:00Z",
    ]);
    database.run("INSERT INTO conversations (id, title, user_id, created_at) VALUES (?, ?, ?, ?)", [
        conv2Id,
        "Chandelier Assassination",
        userId,
        "2025-01-01T11:00:00Z",
    ]);

    _seedMitflitMessages(database, conv1Id);
    _seedChandelierMessages(database, conv2Id);
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
    database.run("DELETE FROM challenges");
    database.run("DELETE FROM sessions");
    database.run("DELETE FROM credentials");
    database.run("DELETE FROM users");
    seedIfNeeded(database);
}

// Seed on module load for production DB
seedIfNeeded(db);
