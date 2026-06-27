/**
 * Constants shared between server and client.
 */

/** RAG pipeline configuration defaults */
export const RAG_CONFIG = {
    EMBEDDING_MODEL: "gemini-embedding-001",
    LLM_MODEL: "gemini-2.5-flash",
    TOP_N: 5,
    SIMILARITY_THRESHOLD: 0.3,
};

/** Qdrant sidecar configuration. Consumed by server/utils/vector-store.js. */
export const QDRANT_CONFIG = {
    COLLECTION: "rule_chunks",
    URL: "http://localhost:6333",
    VECTOR_SIZE: 3072,
    SEARCH_OVERFETCH_FACTOR: 5,
    SEARCH_MIN_LIMIT: 25,
};

/** Gemini API configuration */
export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Conversation history configuration */
export const CONVERSATION_CONFIG = {
    MAX_HISTORY_TURNS: 20,
    COMPACTION_THRESHOLD_TOKENS: 500000,
    COMPACTION_KEEP_RECENT_TURNS: 10,
};

/** Deterministic UUIDs for seed data — stable across restarts, usable in tests */
export const SEED_IDS = {
    USER_DEFAULT: "00000000-0000-4000-8000-000000000001",
    USER_TEST_PLAYER: "00000000-0000-4000-8000-000000000002",
    CONV_MITFLIT: "00000000-0000-4000-8000-000000000010",
    CONV_CHANDELIER: "00000000-0000-4000-8000-000000000011",
    CONV_REAGENTS: "00000000-0000-4000-8000-000000000012",
    RULE_MITFLIT_KING: "00000000-0000-4000-8000-000000000020",
    RULE_SAMPLE_SPELL: "00000000-0000-4000-8000-000000000021",
    RULE_MITFLIT_MELEE: "00000000-0000-4000-8000-000000000030",
    RULE_MITFLIT_ACTION_SNEAK: "00000000-0000-4000-8000-000000000031",
    RULE_MITFLIT_ACTION_SNARE: "00000000-0000-4000-8000-000000000032",
    RULE_MITFLIT_SPELLCASTING: "00000000-0000-4000-8000-000000000033",
    RULE_TRAIT_HUMANOID: "00000000-0000-4000-8000-000000000040",
    RULE_TRAIT_GOBLINOID: "00000000-0000-4000-8000-000000000041",
    RULE_CONDITION_ENFEEBLED: "00000000-0000-4000-8000-000000000050",
};

/** Fixed timestamp used by VR tests to freeze date-rendered UI (e.g. archive dialog). */
export const VR_FIXED_TIMESTAMP = "2026-01-15T12:00:00Z"; // renders as "Jan 15, 2026"
