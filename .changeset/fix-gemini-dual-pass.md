---
bump: patch
---

Fix Gemini infinite repetition loop by implementing a dual-pass LLM pipeline: Pass 1 generates creative content freely in Markdown, Pass 2 extracts structured JSON blocks. Adds reasoning scratchpad to the response schema as an additional safeguard.
