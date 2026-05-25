---
bump: patch
---

Fix Gemini repetition loops by adding temperature/topP/maxOutputTokens params, fix compaction ordering so summaries are included in LLM calls, and fix SSE stream parsing to buffer partial lines across chunks.
