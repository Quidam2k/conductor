# Cascade Plan: Demo Scripts + Pack Events UI + Hardcoded Demo

**Created:** 2026-03-17

## Phase 1: Scripts + Manifest (content only) — COMPLETE
Write 7 new event scripts, update manifest.json and wav-manifest.md, remove old demo files.

**Files to create:** 14 new script files (7 × .txt + .json)
**Files to remove:** demo-freeze.txt, demo-freeze.json, demo-walkthrough.txt, demo-walkthrough.json
**Files to modify:** manifest.json, wav-manifest.md

Scripts:
1. The Stillness — freeze mob, no props, standalone
2. The Bloom — umbrellas, standalone (replaces The Freeze)
3. Lights Out — phone flashlights, evening event
4. The Signal — sign-based, most protest-applicable
5. The Stand — interlocking pair A (stationary, umbrellas)
6. The Walk — interlocking pair B (movement, lights)
7. The Murmur — synchronized turns + signs, standalone

New cues: 21 action + 21 notice = 42 new (total 121)

⚠️ NEXT: Upon completing this phase, immediately call EnterPlanMode for Phase 2. Do NOT stop or wait for the user to ask.

---

## Phase 2: Pack Events UI — COMPLETE
Store events during pack import, surface in pack manager with Load buttons.

**Files to modify:** resourcePackManager.js, index.html

Key changes:
- RPM_STORE_EVENTS = 'events', bump DB version to 2
- Store events in IDB during importPackWithValidation()
- getPackEvents(packId) public API
- deletePack() cleans up events store
- rebaseEventToNow() helper in index.html
- renderPackManager() shows event items with Load buttons
- Load button handler: rebase → validate → embed → preview

⚠️ NEXT: Upon completing this phase, immediately call EnterPlanMode for Phase 3. Do NOT stop or wait for the user to ask.

---

## Phase 3: Hardcoded Demo + Tests — COMPLETE
Replace createDemoEvent() with "The Stillness" (TTS-only), update tests.

**Files to modify:** index.html (createDemoEvent), integration.spec.js

Key changes:
- New demo: ~8 actions over ~3.5 min, no pack/cue fields (pure TTS)
- Test updates: title, action count, duration assertions

⚠️ NEXT: Upon completing this phase, immediately call EnterPlanMode for Phase 4. Do NOT stop or wait for the user to ask.

---

## Phase 4: Build + Verify — COMPLETE
Bump SW version, rebuild standalone, run tests.

**Files modified:** sw.js (v27→v28), conductor.html (rebuilt, 379 KB, 10 scripts inlined)
**Test results:** 111 passed, 1 skipped (pre-existing webkit packs harness skip)

Cascade complete.
