# Pre-Release Review & Polish Cascade

**Date:** 2026-03-02
**Goal:** Make Conductor smooth and approachable for non-technical users, ensure code quality for test-group release.

## Phase 1: Landing Page + In-App Help — COMPLETE
- [x] start.html: step clarity, demo vs pack distinction, sharing methods, glossary, haptic note, tag explanations
- [x] index.html: "How to Create Events" accordion, improved "What is this?", terminology (resource pack → voice pack)
- [x] Test fix: updated integration test for new "No voice packs installed" text
- [x] All 111 tests pass, 1 skip

## Phase 2: Documentation Cleanup — COMPLETE
- [x] GUIDE.md: voice pack terminology, notices/styles/haptic explainer, countdown two-levels note, demo clarification
- [x] TEXT_FORMAT.md: tag categories overview, notification explainer, iOS haptic note, expanded skip warning
- [x] RESOURCE_PACK_FORMAT.md: cross-reference to GUIDE.md, "[Not Yet Implemented]" marking

## Phase 3: Code Review & Fixes — COMPLETE
- [x] Review all JS modules + index.html
- [x] 7 bugs fixed: audio filter scaling, noticeSeconds hardcode, parseInt radix/NaN, javascript: URL, onclick injection, DecompressionStream format, SW cache gaps
- [x] 2 dead code removals: downloadBundledHTML(), idbTransaction()
- [x] SW bumped to v26 (added TEXT_FORMAT.md + RESOURCE_PACK_FORMAT.md to ASSETS)
- [x] Test suite: 111 pass, 1 skip

## Phase 4: Final Verification + Meta-Suggestions — COMPLETE
- [x] Verify SW ASSETS match actual files (done in exploration — all 22 present)
- [x] Manual QA via Playwright: load app, demo event, text-format paste, practice mode — 0 errors
- [x] Meta-suggestions delivered to Todd (conversation output)
- [x] Cascade plan marked COMPLETE

---

## Decisions
- "Voice pack" for all user-facing text; "Resource pack" only in RESOURCE_PACK_FORMAT.md
- In-app tutorial: expandable "How to Create Events" on input screen

✅ ALL PHASES COMPLETE — Pre-release review cascade finished 2026-03-02.
