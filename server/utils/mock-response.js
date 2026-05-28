/**
 * @typedef {import("../../shared/types.js").MessageBlock} MessageBlock
 */

import { SEED_IDS } from "../../shared/constants.js";

/**
 * Pre-defined mock responses — Pathfinder-themed.
 * Each entry is an array of MessageBlock objects.
 * @type {MessageBlock[][]}
 */
const MOCK_RESPONSES = [
    // Saving throws
    [
        {
            type: "text",
            markdown: "That's a great question about saving throws in Pathfinder 2e!",
        },
        {
            type: "callout",
            title: "Key Rule",
            markdown:
                "When a creature **critically succeeds** on a saving throw, it takes no damage from effects that would deal half damage on a success.",
        },
        {
            type: "text",
            markdown:
                "The creature must succeed at a :dc{15} Fortitude save or take :dice{2d6 fire} damage and become :condition{Stunned 1}. The three basic saves are Fortitude (CON), Reflex (DEX), and Will (WIS).",
        },
    ],
    // Combat mechanics and MAP
    [
        {
            type: "text",
            markdown: "Let me explain the Multiple Attack Penalty (MAP) in Pathfinder 2e combat.",
        },
        {
            type: "callout",
            title: "MAP Progression",
            markdown: "First attack: **-0** | Second attack: **-5** | Third+ attacks: **-10**",
        },
        {
            type: "text",
            markdown:
                "You can reduce MAP with certain abilities like Agile weapons (-4/-8), Twin Weapon Mastery, or using the Two-Weapon Fighter feat. Attack rolls use your proficiency bonus, attack modifier, and the target's AC.",
        },
    ],
    // Spellcasting
    [
        {
            type: "text",
            markdown:
                "Spellcasting in Pathfinder 2e is governed by your class and tradition (arcane, divine, occult, or primal).",
        },
        {
            type: "callout",
            title: "Spell Components",
            markdown:
                "Verbal (V) - Speaking incantations, **Somatic (S)** - Hand gestures | Material (M) - Physical components or a focus (spellcasting attribute modifier)",
        },
        {
            type: "text",
            markdown:
                "- **Spontaneous Casters:** Sorcerers, Bards, and Magi - choose spells from repertoire each day\n- **Prepared Casters:** Wizards, Clerics, and Druids - prepare specific spell slots during daily preparations\n- **Heightening:** Can be done spontaneously by spontaneous casters, prepared casters must prepare heightened versions",
        },
    ],
    // Skill checks and DCs
    [
        {
            type: "text",
            markdown:
                "Skill checks follow the standard formula: d20 + proficiency + ability modifier + item bonus + circumstance bonus - circumstance penalty.",
        },
        {
            type: "callout",
            title: "Difficulty Classes",
            markdown:
                "Untrained (-2): DC 10, Trained: DC 13, Expert: DC 16, Master: DC 19, Legendary: DC 22",
        },
        {
            type: "text",
            markdown:
                "Specialized DCs: Simple tasks (DC 9), Easy (DC 10), Medium (DC 13), Hard (DC 16), Very Hard (DC 19), Extreme (DC 22+). Your GM may adjust these based on narrative factors.",
        },
    ],
    // Movement and terrain
    [
        {
            type: "text",
            markdown:
                "Movement in Pathfinder 2e is measured in feet, with most creatures having 30 feet of Speed. Various actions affect how you can move.",
        },
        {
            type: "callout",
            title: "Movement Actions",
            markdown:
                "Step - 5 feet without triggering reactions | Stride - up to your Speed | Swim/Fly/Climb - move through that medium",
        },
        {
            type: "text",
            markdown:
                "- **Difficult Terrain:** Costs 1 extra square of movement (5 feet), cannot Step through it\n- **Greater Difficult Terrain:** Costs 2 extra squares of movement, includes most climbing and swimming\n- **Moving While Prone:** Crawling costs 1 extra square of movement (Step is 5 feet)",
        },
    ],
    // Equipment and crafting
    [
        {
            type: "text",
            markdown:
                "Crafting in Pathfinder 2e is a downtime activity that lets you create items from raw materials or repair damaged equipment.",
        },
        {
            type: "callout",
            title: "Crafting Check",
            markdown:
                "**DC = Item level + 15** (or 20 for items without a clear Price) | Success: Reduce Price by your proficiency bonus",
        },
        {
            type: "text",
            markdown:
                "The Crafting skill has a Price Table that tells you the Price in silver pieces for common items of any level. You must have the appropriate formulas (from the GM) to craft items. Each batch you craft reduces the Price by your proficiency bonus.",
        },
    ],
    // Monster lore (using list blocks)
    [
        {
            type: "text",
            markdown:
                "Let me share some interesting monster lore about Mitflits, also known as Gremlins!",
        },
        {
            type: "text",
            markdown:
                "- **Origins:** Mitflits are fey creatures corrupted by the First World's chaotic energies, often born from magical accidents\n- **Mitflit Kings:** Rulers of Mitflit communities, granted powers by the First World to lead their subjects with cunning schemes\n- **Combat Style:** Rely on numbers, dirty tactics, and mischievous abilities like throwing alchemical bombs or using stealth\n- **Weaknesses:** Vulnerable to cold iron and protective wards; often flee when confronted with overwhelming force",
        },
        {
            type: "text",
            markdown:
                "Mitflits are CR 1 creatures with low HP but numerous abilities. They typically appear in groups and use ambush tactics.",
        },
    ],
    // General GM advice (callout + paragraph)
    [
        {
            type: "text",
            markdown: "Here's some GM advice for running engaging Pathfinder 2e sessions!",
        },
        {
            type: "callout",
            title: "The Three Action Economy",
            markdown:
                "**Every character gets 3 actions and 1 reaction per turn** | Encourage creative use of actions and describe the results dynamically",
        },
        {
            type: "text",
            markdown:
                "When players attempt creative solutions, use the degrees of success system: Critical Failure (failure + consequence), Failure (nothing happens), Success (desired outcome), Critical Success (success + bonus). This keeps the story moving forward even on partial success.",
        },
        {
            type: "text",
            markdown:
                "Remember: the rules are tools, not shackles. If a rule would make the game less fun or the story less engaging, feel free to adapt it. The most important rule is that everyone at the table should have a good time!",
        },
    ],
    // Critical hits and weapon traits
    [
        {
            type: "text",
            markdown:
                "Critical hits are a central mechanic in Pathfinder 2e's combat system. When you roll a natural 20 on an attack roll, you double your damage dice!",
        },
        {
            type: "callout",
            title: "Critical Success on Attack",
            markdown:
                "**Critical Specialization (if proficient):** Apply the weapon's critical specialization effect | Double all damage dice | Add any additional damage from the attack",
        },
        {
            type: "text",
            markdown:
                "- **Critical Failure on Attack:** Roll a d20: on 1-15, weapon becomes broken; on 16-20, it becomes damaged\n- **Critical Specialization Effects:** Each weapon group (Axes, Bows, Swords, etc.) has unique critical effects you can apply\n- **Weapon Traits:** Agile, Finesse, Backswing, Sweep, and others modify how you use weapons in combat",
        },
    ],
    // Feats and character progression
    [
        {
            type: "text",
            markdown:
                "Character advancement in Pathfinder 2e uses a unified XP system: 1000 XP per level, typically earned through completing encounters and story milestones.",
        },
        {
            type: "callout",
            title: "Level-Up Milestones",
            markdown:
                "**Every level:** Increase proficiency rank | +1 HP | Class feat | Every odd level: General feat, Skill increase | Every even level: Ancestry feat",
        },
        {
            type: "text",
            markdown:
                "Feats come in multiple types: Class feats (unique to your class), Ancestry feats (from your heritage), General feats (available to all), Skill feats (require skill training), and Archetype feats (from multiclassing or dedication feats).",
        },
    ],
    // Conditions and status effects
    [
        {
            type: "text",
            markdown: "The Enfeebled condition reduces your physical capability.",
        },
        {
            type: "rule-detail",
            ruleItemId: SEED_IDS.RULE_CONDITION_ENFEEBLED,
        },
    ],
    // Rich game component showcase
    [
        {
            type: "text",
            markdown:
                "The dragon breathes fire! Deal :dice{4d6 fire} damage. Targets must succeed at a :dc{23} Reflex save or take full damage.",
        },
        {
            type: "callout",
            title: "Breath Weapon",
            markdown:
                "The creature has :trait{Dragon} and :trait{Fire} traits. On a failed save, targets become :condition{Stunned 2}. This ability costs :action{2} actions.",
        },
        {
            type: "text",
            markdown:
                "The dragon can also use :action{reaction} as a reaction to tail swipe, or :action{free} to speak. A critical failure on the save applies :condition{Enfeebled 2} for 1 round.",
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
 * TEST-ONLY: Returns a mock response for visual regression testing.
 * Must only be invoked when ENABLE_MOCK_FALLBACK=true.
 * When userId is provided and a forced index has been
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
