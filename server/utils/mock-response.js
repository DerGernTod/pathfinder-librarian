/**
 * @typedef {import("../../shared/types.js").MessageBlock} MessageBlock
 */

/**
 * Pre-defined mock responses — Pathfinder-themed.
 * Each entry is an array of MessageBlock objects.
 * @type {MessageBlock[][]}
 */
const MOCK_RESPONSES = [
    // Saving throws
    [
        {
            type: "paragraph",
            text: "That's a great question about saving throws in Pathfinder 2e!",
        },
        {
            type: "callout",
            title: "Key Rule",
            segments: [
                { text: "When a creature ", highlight: false },
                { text: "critically succeeds", highlight: true },
                {
                    text: " on a saving throw, it takes no damage from effects that would deal half damage on a success.",
                },
            ],
        },
        {
            type: "paragraph",
            text: "The three basic saves are Fortitude (CON), Reflex (DEX), and Will (WIS). Proficiency with these saves is trained by default and can be increased through class features and feats.",
        },
    ],
    // Combat mechanics and MAP
    [
        {
            type: "paragraph",
            text: "Let me explain the Multiple Attack Penalty (MAP) in Pathfinder 2e combat.",
        },
        {
            type: "callout",
            title: "MAP Progression",
            segments: [
                { text: "First attack: ", highlight: false },
                { text: "-0", highlight: true },
                { text: " | Second attack: ", highlight: false },
                { text: "-5", highlight: true },
                { text: " | Third+ attacks: ", highlight: false },
                { text: "-10", highlight: true },
            ],
        },
        {
            type: "paragraph",
            text: "You can reduce MAP with certain abilities like Agile weapons (-4/-8), Twin Weapon Mastery, or using the Two-Weapon Fighter feat. Attack rolls use your proficiency bonus, attack modifier, and the target's AC.",
        },
    ],
    // Spellcasting
    [
        {
            type: "paragraph",
            text: "Spellcasting in Pathfinder 2e is governed by your class and tradition (arcane, divine, occult, or primal).",
        },
        {
            type: "callout",
            title: "Spell Components",
            segments: [
                { text: "Verbal (V) - Speaking incantations, ", highlight: false },
                { text: "Somatic (S) - Hand gestures", highlight: true },
                {
                    text: " | Material (M) - Physical components or a focus (spellcasting attribute modifier)",
                    highlight: false,
                },
            ],
        },
        {
            type: "list",
            items: [
                {
                    title: "Spontaneous Casters",
                    text: "Sorcerers, Bards, and Magi - choose spells from repertoire each day",
                },
                {
                    title: "Prepared Casters",
                    text: "Wizards, Clerics, and Druids - prepare specific spell slots during daily preparations",
                },
                {
                    title: "Heightening",
                    text: "Can be done spontaneously by spontaneous casters, prepared casters must prepare heightened versions",
                },
            ],
        },
    ],
    // Skill checks and DCs
    [
        {
            type: "paragraph",
            text: "Skill checks follow the standard formula: d20 + proficiency + ability modifier + item bonus + circumstance bonus - circumstance penalty.",
        },
        {
            type: "callout",
            title: "Difficulty Classes",
            segments: [
                {
                    text: "Untrained (-2): DC 10, Trained: DC 13, Expert: DC 16, Master: DC 19, Legendary: DC 22",
                    highlight: false,
                },
            ],
        },
        {
            type: "paragraph",
            text: "Specialized DCs: Simple tasks (DC 9), Easy (DC 10), Medium (DC 13), Hard (DC 16), Very Hard (DC 19), Extreme (DC 22+). Your GM may adjust these based on narrative factors.",
        },
    ],
    // Movement and terrain
    [
        {
            type: "paragraph",
            text: "Movement in Pathfinder 2e is measured in feet, with most creatures having 30 feet of Speed. Various actions affect how you can move.",
        },
        {
            type: "callout",
            title: "Movement Actions",
            segments: [
                {
                    text: "Step - 5 feet without triggering reactions | Stride - up to your Speed | Swim/Fly/Climb - move through that medium",
                    highlight: false,
                },
            ],
        },
        {
            type: "list",
            items: [
                {
                    title: "Difficult Terrain",
                    text: "Costs 1 extra square of movement (5 feet), cannot Step through it",
                },
                {
                    title: "Greater Difficult Terrain",
                    text: "Costs 2 extra squares of movement, includes most climbing and swimming",
                },
                {
                    title: "Moving While Prone",
                    text: "Crawling costs 1 extra square of movement (Step is 5 feet)",
                },
            ],
        },
    ],
    // Equipment and crafting
    [
        {
            type: "paragraph",
            text: "Crafting in Pathfinder 2e is a downtime activity that lets you create items from raw materials or repair damaged equipment.",
        },
        {
            type: "callout",
            title: "Crafting Check",
            segments: [
                {
                    text: "DC = Item level + 15 (or 20 for items without a clear Price)",
                    highlight: true,
                },
                {
                    text: " | Success: Reduce Price by your proficiency bonus",
                    highlight: false,
                },
            ],
        },
        {
            type: "paragraph",
            text: "The Crafting skill has a Price Table that tells you the Price in silver pieces for common items of any level. You must have the appropriate formulas (from the GM) to craft items. Each batch you craft reduces the Price by your proficiency bonus.",
        },
    ],
    // Monster lore (using list blocks)
    [
        {
            type: "paragraph",
            text: "Let me share some interesting monster lore about Mitflits, also known as Gremlins!",
        },
        {
            type: "list",
            items: [
                {
                    title: "Origins",
                    text: "Mitflits are fey creatures corrupted by the First World's chaotic energies, often born from magical accidents",
                },
                {
                    title: "Mitflit Kings",
                    text: "Rulers of Mitflit communities, granted powers by the First World to lead their subjects with cunning schemes",
                },
                {
                    title: "Combat Style",
                    text: "Rely on numbers, dirty tactics, and mischievous abilities like throwing alchemical bombs or using stealth",
                },
                {
                    title: "Weaknesses",
                    text: "Vulnerable to cold iron and protective wards; often flee when confronted with overwhelming force",
                },
            ],
        },
        {
            type: "paragraph",
            text: "Mitflits are CR 1 creatures with low HP but numerous abilities. They typically appear in groups and use ambush tactics.",
        },
    ],
    // General GM advice (callout + paragraph)
    [
        {
            type: "paragraph",
            text: "Here's some GM advice for running engaging Pathfinder 2e sessions!",
        },
        {
            type: "callout",
            title: "The Three Action Economy",
            segments: [
                {
                    text: "Every character gets 3 actions and 1 reaction per turn",
                    highlight: true,
                },
                {
                    text: " | Encourage creative use of actions and describe the results dynamically",
                    highlight: false,
                },
            ],
        },
        {
            type: "paragraph",
            text: "When players attempt creative solutions, use the degrees of success system: Critical Failure (failure + consequence), Failure (nothing happens), Success (desired outcome), Critical Success (success + bonus). This keeps the story moving forward even on partial success.",
        },
        {
            type: "paragraph",
            text: "Remember: the rules are tools, not shackles. If a rule would make the game less fun or the story less engaging, feel free to adapt it. The most important rule is that everyone at the table should have a good time!",
        },
    ],
    // Critical hits and weapon traits
    [
        {
            type: "paragraph",
            text: "Critical hits are a central mechanic in Pathfinder 2e's combat system. When you roll a natural 20 on an attack roll, you double your damage dice!",
        },
        {
            type: "callout",
            title: "Critical Success on Attack",
            segments: [
                {
                    text: "Critical Specialization (if proficient): Apply the weapon's critical specialization effect",
                    highlight: true,
                },
                {
                    text: " | Double all damage dice | Add any additional damage from the attack",
                    highlight: false,
                },
            ],
        },
        {
            type: "list",
            items: [
                {
                    title: "Critical Failure on Attack",
                    text: "Roll a d20: on 1-15, weapon becomes broken; on 16-20, it becomes damaged",
                },
                {
                    title: "Critical Specialization Effects",
                    text: "Each weapon group (Axes, Bows, Swords, etc.) has unique critical effects you can apply",
                },
                {
                    title: "Weapon Traits",
                    text: "Agile, Finesse, Backswing, Sweep, and others modify how you use weapons in combat",
                },
            ],
        },
    ],
    // Feats and character progression
    [
        {
            type: "paragraph",
            text: "Character advancement in Pathfinder 2e uses a unified XP system: 1000 XP per level, typically earned through completing encounters and story milestones.",
        },
        {
            type: "callout",
            title: "Level-Up Milestones",
            segments: [
                {
                    text: "Every level: Increase proficiency rank | +1 HP | Class feat",
                    highlight: true,
                },
                {
                    text: " | Every odd level: General feat, Skill increase | Every even level: Ancestry feat",
                    highlight: false,
                },
            ],
        },
        {
            type: "paragraph",
            text: "Feats come in multiple types: Class feats (unique to your class), Ancestry feats (from your heritage), General feats (available to all), Skill feats (require skill training), and Archetype feats (from multiclassing or dedication feats).",
        },
    ],
];

/**
 * Per-user forced index map. When an entry is present for a userId,
 * getMockResponse and streamMockResponse always return that response index
 * instead of picking at random.
 * Intended for use by the dev-only /api/test/set-mock-response endpoint so
 * Playwright tests can pin a deterministic response per worker.
 * @type {Map<string, number>}
 */
const _userForcedIndexes = new Map();

/**
 * Pins (or releases) the mock response index for a specific user.
 * Pass null as index to restore random selection for that user.
 * @param {string} userId
 * @param {number | null} index
 */
export function setForcedMockIndexForUser(userId, index) {
    if (index === null) {
        _userForcedIndexes.delete(userId);
    } else {
        _userForcedIndexes.set(userId, index);
    }
}

/**
 * Returns a mock response. When userId is provided and a forced index has been
 * pinned for that user, always returns that response; otherwise picks at random.
 * @param {string} [userId]
 * @returns {MessageBlock[]}
 */
export function getMockResponse(userId) {
    const forced = userId !== undefined ? _userForcedIndexes.get(userId) : undefined;
    const index = forced !== undefined ? forced : Math.floor(Math.random() * MOCK_RESPONSES.length);
    return MOCK_RESPONSES[index];
}

/**
 * Returns an async generator that yields chunks of a mock response.
 * When userId is provided and a forced index has been pinned for that user,
 * always returns that response; otherwise picks at random.
 * @param {string} [userId]
 * @returns {AsyncGenerator<MessageBlock, void, unknown>}
 */
export async function* streamMockResponse(userId) {
    const forced = userId !== undefined ? _userForcedIndexes.get(userId) : undefined;
    const index = forced !== undefined ? forced : Math.floor(Math.random() * MOCK_RESPONSES.length);
    const response = MOCK_RESPONSES[index];

    for (const block of response) {
        // Simulate network/generation delay
        await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
        yield block;
    }
}
