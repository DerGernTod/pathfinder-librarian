---
bump: patch
---

Fixed Gemini API 400 errors caused by `additionalProperties` in the response schema. Removed silent mock fallback in production — LLM errors now surface proper error messages to the user.
