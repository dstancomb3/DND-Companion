# Manual acceptance results — 2026-10-27

Tester: user; PR #84 feature/workspace-panel-replacement. These are manually reported results, not CI automation.

## Passed
Steps 1–17 except narration consistency at 18, plus 19, 21, 22, 31–33.
- Startup, character sheet and reload; all six-panel workspace operations and layout persistence (1–12).
- Narrative action, encounter entry, enemy inspection, attacking and health/log effects, turn end (13–17, 19).
- Encounter closes after last spawned hostile (21), defeated enemy inspectable (22).
- Adventure pause, resume and continued story (31–33).

## Failed or partial — must fix and retest
- **Roll request UI regression**: too small and incorrectly located. Commit `9ff8c63` moves/promotes roll prompts above narrative, pending actual user and browser verification.
- **18 attack narration PARTIAL**: DM sometimes narrates outcome, sometimes only a mechanical log. Require one committed narration receipt or explicit recoverable pending status per resolved player attack.
- **20 NPC behavior FAIL/PARTIAL**: enemies often hold position instead of using attack/actions. Investigate spawn capabilities, innate attack projection, target range, turn readiness and movement choices before concluding absence of equipment is the cause. **Innate animal attacks must not depend on droppable weapons.**
- **20 encounter spawn FAIL**: description says pack of dogs but only alpha combat NPC spawned; after alpha death encounter closes and narration describes attacking remaining uninstantiated dogs without combat. Need reconcile narrative entity roster with authoritative encounter instances, join/reopen battle on new hostility, and prevent narration from claiming combat resolution for absent combatants.
- **26/28 rest BLOCKED**: short/long rest requests submitted but AI DM did not adjudicate them. Implement AI DM approval/denial via authoritative scene-safety criteria, distinguish AI vs human host, and expose request state to player.
- **34 notes NOT TESTED**: AI DM not yet distributing scoped Notes/People/Quests/Planes/Locations.

## Untested due to blockers
23–25 loot transfer/dedup/reload; 27 rest recovery; 29–30 provisions/recovery; 35–37 final character and note regressions.

## Acceptance priorities
1. Confirm enlarged/relocated roll request retains correct response flow.
2. Ensure NPCs have usable innate attacks, multi-enemy spawn consistency, and follow-on combat after killing first enemy.
3. Make AI-DM rest approval truly complete.
4. Narration once per committed action; then loot and rest persistence.
5. Retest untested steps and Notes scoping.

**Do not mark 18, 20, 26 or 28 as passing solely because their checkboxes were checked; user comments report inconsistent or blocked behavior.**
