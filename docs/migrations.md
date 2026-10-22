# Migrations & Cutover: Character Companion

This document tracks all active migration/cutover constraints, deprecated compatibility paths, and safe-edit cautions. All findings are code-grounded.

---

## Active Migrations

- **Schema Convergence:** Migration from legacy/open5e data to Zod/OpenAPI schemas (`lib/api-zod/`, `lib/api-spec/`, `data/open5e/`, `scripts/`)
- **Data Normalization:** Ongoing normalization of imported data (`scripts/convert-open5e-to-project-format.ts`)

---

## Deprecated Compatibility Paths

- Some legacy fields and formats remain for compatibility; do not remove unless all consumers are migrated
- Document any removal or cutover in this file and `docs/feature-status.md`

---

## Safe-Edit Cautions

- Never flatten or erase partial/migrating systems unless all edge cases and legacy compatibility are confirmed
- Always document migration steps and risks here

---

## How to Update This Doc

- Add a dated entry for each migration/cutover or deprecation
- Reference concrete files/modules and affected systems
- Be explicit about any ambiguities or conservative calls

## 2026-05-10 Adventure Phase 1 One-Off Encounter MVP (Slice 1+2 — Live AI Input)

- Files: `artifacts/living-character-sheet/app/adventure/new.tsx`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`
- Change: Added one-off session entry UI (session-type selector, startInCombat toggle for one-off mode); replaced one-off stub input handler with live AI call to `handleCampaignRuntimeTurn`; removed `isCampaignScaffold` ternary guards from context builders (inventory, hostile actors, known actors) so one-off sessions get full context in AI prompts.
- Conservative boundary: No server route changes, no schema expansion, no CombatContext/PartyContext/partyApi changes, and no campaign mode behavior changes. One-off now calls the existing live response API with the same request/response contract as campaign sessions. Slice 3+ (quick action un-stub, post-turn processing, session completion) remain deferred.

## 2026-05-19 Adventure One-Off Intro + Encounter Isolation + Session Combat Cards (Bounded)

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmSessionFeedScaffold.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/context/PartyContext.tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-session-feed-scaffold.test.mts`
- Change: replaced one-off seeded DM opening from raw guidance/context echo to narrative opener paragraph generation, added fresh-session combat-state isolation (clear stale party combat state on new/join and hide one-off snapshot until player conversation begins), and added bounded in-session encounter tools panel that reuses existing attack/action/resource cards during active one-off encounters.
- Conservative boundary: no server route/schema/authority migration; changes are client-side UX/runtime orchestration over existing CombatContext/PartyContext and reusable UI components.

## 2026-05-10 Adventure Phase 30 Campaign Adjudication Roll Bridge (Bounded)

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmCampaignRuntimeApi.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `docs/feature-status.md`
- Change: added additive `adjudicationRequests` support to campaign runtime turn contract parsing/normalization and session completion handling so DM turns can request explicit party roll prompts (for uncertain identification/lore/perception and related checks) through existing `createPartyRollRequest` authority paths.
- Conservative boundary: no new party endpoints, no combat authority migration, and no schema cutover; implementation reuses existing roll-request APIs and remains bounded to campaign session orchestration.

## 2026-05-10 Adventure Phase 31 Compendium-Backed Encounter Source Bridge (Bounded)

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmCampaignRuntimeApi.ts`, `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `docs/feature-status.md`
- Change: added additive encounter intent source metadata (`hostileCreatureSourceType`, `hostileCreatureSourceId`) and source-aware normalization/spawn handling so encounter orchestration can create/reuse hostile NPCs using canonical monster identity when available, with safe fallback to existing name-based behavior.
- Conservative boundary: no new party routes, no schema cutover, and no authority migration; implementation stays within existing `addCombatNpc` and roll-request API boundaries.

## 2026-05-10 Adventure Phase 32 Canonical Hostile-Actor Continuity Bridge (Bounded)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/api-server/src/routes/adventure.ts`, `docs/feature-status.md`
- Change: added source-aware hostile NPC identity capture in encounter orchestration results plus campaign session continuity context injection (`CURRENT HOSTILE ACTORS`, `KNOWN ENCOUNTER ACTORS`) so subsequent runtime turns can preserve actor identity alignment between narration and spawned combatants.
- Conservative boundary: no new routes or schema cutover and no combat-authority migration; continuity is additive prompt/context steering over existing party runtime state and encounter APIs.

## 2026-05-10 Adventure Phase 33 Narrative Consistency Guardrails + Validation Coverage (Bounded)

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/api-server/src/routes/adventure.handoff-route.test.ts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime.test.mts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime-integration.test.mts`, `docs/feature-status.md`
- Change: added server-side canonical hostile actor parsing/alignment helpers for campaign runtime turns so encounter intents can be normalized against continuity anchors (`CURRENT HOSTILE ACTORS`, `KNOWN ENCOUNTER ACTORS`), including source-aware monster-id backfill when names match canonical actors; expanded focused tests to cover continuity parsing/alignment and orchestration identity reporting.
- Conservative boundary: no new endpoints, no schema cutover, and no authority migration; this is additive guardrail logic and validation over existing runtime contracts.

## 2026-05-08 Adventure Phase 29 Awareness Persistence + Supporting-Screen Rollout (Bounded)

- Files: `artifacts/living-character-sheet/context/AdventureSessionContext.tsx`, `artifacts/living-character-sheet/components/adventure/AiDmSessionAwarenessPlaceholderStrip.tsx`, `artifacts/living-character-sheet/app/(tabs)/sheet.tsx`, `artifacts/living-character-sheet/app/(tabs)/quick-update.tsx`, `artifacts/living-character-sheet/app/party.tsx`, `artifacts/living-character-sheet/app/landing.tsx`, `artifacts/living-character-sheet/app/adventure/index.tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-session-awareness-context.test.mts`, `docs/feature-status.md`
- Change: added bounded local active-session awareness persistence helpers (parse/build return-path-backed active record), expanded awareness helper tests, and rolled reusable awareness strip actions (`Return to Session`, explicit `End Session` clear) onto key supporting screens and Adventure entry surfaces.
- Conservative boundary: no server orchestration authority migration and no schema or route expansion; awareness state remains local-device context only and does not imply server-authoritative session runtime.

## 2026-05-08 Adventure Phase 27 Campaign Continuation Snapshot Persistence

- Files: `artifacts/api-server/src/lib/campaignContinuationStore.ts`, `artifacts/api-server/src/routes/adventure.ts`, `lib/db/src/schema/adventure.ts`, `lib/db/src/schema/index.ts`
- Change: moved campaign continuation snapshot storage from an in-memory route-local map to a DB-backed snapshot table with safe in-process fallback when the database or table is unavailable, while preserving the existing `/api/adventure/campaign-continuations` POST/GET contracts and snapshot readback shape.
- Conservative boundary: no Adventure authority migration beyond the existing continuation contract; the client still submits and hydrates using the same payloads, and local fallback keeps sessions working in offline or unprovisioned environments.

## 2026-05-08 Adventure Encounter Intent + Session Navigation Slice

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmCampaignRuntimeApi.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/app/adventure/index.tsx`, `artifacts/living-character-sheet/app/adventure/new.tsx`
- Change: added additive encounter-intent metadata to campaign runtime turn contracts so the session route can trigger existing party combat authority paths (NPC add, initiative start, roll-request prompts), strengthened inventory-consistency prompt constraints to reduce invented gear narration, removed the confusing Adventure-home character-sheet CTA, and added a contextual character-sheet entry on New Session.
- Conservative boundary: no party-route schema expansion and no authority migration; implementation reuses existing roll-request endpoints and keeps Adventure as a bounded orchestrator.

## 2026-05-08 Adventure Encounter Intent Phase 14 (Battle Reuse + Roll Prompt Safety)

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/api-server/src/routes/adventure.handoff-route.test.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime.test.mts`
- Change: added deterministic server-side encounter intent key fallback and explicit encounter-intent normalization helper coverage, then hardened campaign session encounter orchestration to reuse active battles, skip duplicate hostile NPC spawn by battle/name match, create per-roll request feedback, and block continued narrative turns while encounter resolution is pending.
- Conservative boundary: no new party endpoints, no party schema migration, and no authority-boundary shift; all runtime actions continue through existing party APIs.

## 2026-05-08 Adventure Encounter Intent Phase 15 (Integration Gating Coverage)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime-integration.test.mts`
- Change: extracted campaign encounter-intent orchestration into a dependency-injected helper and added focused integration-style tests that cover party-missing, no-connected-members, active-battle reuse, duplicate hostile-NPC spawn skip, and initiative roll-request insertion for narration-blocked encounters.
- Conservative boundary: no new routes or schemas, no authority migration, and no server orchestration expansion; session runtime continues to reuse existing party APIs and roll-request endpoints.

## 2026-05-08 Adventure Encounter Intent Phase 16 (Gate Visibility + Deterministic Clear Transition)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-gate-visibility.test.mts`
- Change: added bounded encounter-gate visibility helpers and compact campaign session UI instrumentation for pending reason, required-roll progress, and gate-cleared confirmation; updated gate-clear semantics so narration unblocks only when all required prompt rolls (including injected initiative when needed) are successfully created.
- Conservative boundary: no endpoint additions, no schema changes, and no authority-boundary migration; implementation remains client-side orchestration over existing party APIs and roll-request routes.

## 2026-05-08 Adventure Encounter Intent Phase 17 (Completion-Aware Encounter Gate)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-gate-visibility.test.mts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime-integration.test.mts`
- Change: added completion-aware required-roll resolution helpers that evaluate live party combat-state roll responses per target member and battle, then wired campaign session gate visibility to recompute against combat-state updates so narration stays blocked until required prompts are fully answered; expanded gate UI with resolved/unresolved progress and added focused tests for unresolved-vs-resolved transitions.
- Conservative boundary: no new endpoints, no schema cutover, and no authority migration; implementation remains a bounded client orchestration layer over existing party roll-request and combat-state APIs.

## 2026-05-08 Adventure Encounter Intent Phase 18 (Completion Matching Robustness + Pending Health)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-gate-visibility.test.mts`
- Change: hardened required-roll completion matching to require exact battle and exact target-member set alignment (preventing superset/mismatch false positives), ensured duplicate same-stat request scenarios resolve only from a fully answered exact-target request, and added bounded gate-health signaling when completion cannot yet be authoritatively evaluated (missing battle context, missing combat state, or unresolved targets).
- Conservative boundary: no new routes, no schema changes, and no authority migration; this remains a client-side robustness/observability improvement over existing party combat-state and roll-request APIs.

## 2026-05-08 Adventure Encounter Intent Phase 19 (Stale Context Recovery + Timeout Observability)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-gate-visibility.test.mts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime-integration.test.mts`
- Change: added a bounded encounter-gate health reason taxonomy (`missing_combat_state`, `missing_battle_context`, `missing_targets`, `stale_battle_context`, `awaiting_responses`) with stable reason text mapping, added stale battle-context recovery helper logic that can recompute gate battle id from current target-member participation without crossing authority boundaries, and added gate-age timeout observability tiers (30s watch, 90s delayed) for compact runtime instrumentation while preserving fail-closed gate behavior.
- Conservative boundary: no endpoint additions, no schema changes, no auto-unblock timeout behavior, and no authority migration; this is client-side resilience/observability hardening over existing combat-state and roll-request APIs.

## 2026-05-08 Adventure Encounter Intent Phase 20 (Multi-Battle Deterministic Selection + Membership Churn Safety)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-gate-visibility.test.mts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime-integration.test.mts`
- Change: added multi-battle deterministic candidate ranking (by target member coverage, active turn ownership, and stable battleId ordering) and `determineBestBattleCandidate()` tie-break logic that prefers current battle if it maintains target coverage, then expanded `recoverEncounterGateBattleContext()` to support membership-churn policy modes (`locked_targets` = original targets required, fail-closed default; `live_targets` = current connected targets, future opt-in) so gates can recover gracefully when members churn or battles merge during long-running encounters. Extended `EncounterRollCompletionState` with additive metadata fields (`evaluatedBattleId`, `evaluatedTargetCount`, `evaluationRationale`, `targetPolicyMode`) for deterministic observability without behavior changes.
- Conservative boundary: no new endpoints, no schema expansion, and no authority migration; this remains a client-side multi-battle orchestration hardening over existing party battle and roll-request APIs with fail-closed default policy (`locked_targets`).

## 2026-05-08 Adventure Encounter Intent Phase 21 (Confirmation-Aware Gate Clear + Narration Unblock)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-gate-visibility.test.mts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime-integration.test.mts`
- Change: added explicit encounter-gate clear confirmation semantics so a fully resolved gate can enter `cleared` status while remaining active until DM confirms unblock (`clearConfirmed`), then added compact session-card actions (`Refresh`, `Confirm & Continue`) to re-evaluate live gate state without implicit auto-dismiss and to explicitly unblock narration after review.
- Conservative boundary: no endpoint changes, no schema expansion, and no authority migration; gate clear remains deterministic and fail-closed, with unblock now requiring explicit local confirmation rather than implicit auto-clear.

## 2026-05-08 Adventure Encounter Intent Phase 22 (Confirmation Audit Trail + Safe Reopen)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-gate-visibility.test.mts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime-integration.test.mts`
- Change: extended encounter-gate visibility with additive confirmation audit metadata (`confirmedAtMs`, `confirmedBy`, `confirmationSource`) and wired session-level confirmation persistence so confirm actions produce deterministic local audit records; added fail-closed reopen semantics so any post-confirm regression in required-roll completion reopens the gate and clears confirmation metadata.
- Conservative boundary: no route/schema authority changes and no auto-override behavior; reopen remains deterministic local safety logic driven by existing combat-state/roll-request authority.

## 2026-05-08 Adventure Encounter Intent Phase 23 (Locked-Target Override Acknowledge Path)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-gate-visibility.test.mts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime-integration.test.mts`
- Change: added an explicit local override contract for locked-target encounter gates (`overrideMode`, `overrideReasonCode`, `overrideAtMs`, `overrideBy`) and a bounded DM action path to acknowledge missing locked targets when gate health indicates stale/missing target context; override is intentionally opt-in and additive, and resets on new encounter gate context.
- Conservative boundary: no endpoint/schema authority migration and no implicit timeout or auto-override behavior; fail-closed defaults are preserved unless explicit local DM acknowledgement is invoked.

## 2026-05-08 Adventure Encounter Intent Phase 24 (Override Safety Window + Explicit Revoke)

- Files: `artifacts/living-character-sheet/utils/adventure/campaignEncounterRuntime.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/campaign-encounter-gate-visibility.test.mts`, `artifacts/living-character-sheet/tests/state/campaign-encounter-runtime-integration.test.mts`
- Change: added override lifecycle safety metadata (`overrideStatus`, `overrideExpiresAtMs`, `overrideRevokedAtMs`, `overrideRevokedBy`) and explicit session controls for revoking an active locked-target override, while automatically expiring the override after a bounded local window and restoring normal fail-closed gate evaluation if the encounter remains unresolved.
- Conservative boundary: no route/schema authority migration and no implicit auto-override behavior; override remains explicit, local, bounded, and fully reversible.

## 2026-05-07 Adventure Phase 13 Slice 1-2 + Client Continuity Submit, Resume Read, and Live Turn Wiring

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/api-server/src/routes/adventure.handoff-route.test.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmCampaignContinuationApi.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmCampaignRuntimeApi.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/app-map.md`, `docs/feature-status.md`
- Change: added additive campaign continuation ingest contract support (`campaign-continuation.v1`) and endpoint-scoped idempotency safety (`replay`, `payload_conflict`, `in_progress`) under existing Adventure route authority, wired a bounded campaign continuation checkpoint submit path into the campaign session shell, added a bounded snapshot read endpoint plus client hydration/refresh status path for deterministic session resume continuity, and added a bounded live campaign runtime turn endpoint + client input integration for in-session AI DM responses.
- Safety boundary: no server runtime orchestration authority migration and no persistence-model cutover were introduced; this remains bounded ingest/read/turn plus client continuity UX wiring parallel to existing one-off and campaign scaffold paths.

## 2026-05-08 Adventure Local Campaign Resume Archive

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmCampaignSessionArchiveStorage.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `docs/feature-status.md`
- Change: added additive local archive storage for campaign scaffold sessions so a started adventure is immediately resumable from Saved Sessions, with local hydration of entries/pending choices on reopen.
- Conservative boundary: no server-side orchestration or new persistence authority was introduced; this is client-local resume state only and coexists with existing one-off archive behavior.

## 2026-05-08 Character Creation Gear Phase 1 Milestone 1 (Foundation + DM NPC Inventory Compatibility)

- Files: `artifacts/living-character-sheet/utils/creationGear.ts`, `artifacts/living-character-sheet/utils/dmNpcStorage.ts`, `artifacts/living-character-sheet/app/create-character.tsx`, `artifacts/living-character-sheet/app/dm-npc.tsx`, `artifacts/living-character-sheet/tests/state/creation-gear-foundation.test.mts`, `artifacts/living-character-sheet/tests/state/dm-npc-storage.test.mts`, `docs/feature-status.md`, `docs/migrations.md`
- Change:
  - Added a shared creation-gear groundwork module that encodes class-based starting wealth rules, official-item draft generation, and additive background/race auto-gear mapping support where current coverage is explicit.
  - Character creation now seeds safe auto-granted background gear into initial snapshot inventory instead of always persisting an empty inventory.
  - Added DM NPC inventory compatibility normalization so saved NPC records can carry an additive inventory field without breaking legacy stored rows.
- Conservative boundary:
  - No player-facing starting-gear step UI yet.
  - No full strict-package coverage matrix or Open5e equipment ingestion yet.
  - No combat, party, or orchestration authority expansion.

## 2026-05-08 Character Creation Gear Phase 2 + Phase 3 (Run Back-to-Back)

- Files: `artifacts/living-character-sheet/utils/creationGear.ts`, `artifacts/living-character-sheet/app/create-character.tsx`, `artifacts/living-character-sheet/tests/state/creation-gear-foundation.test.mts`, `docs/feature-status.md`, `docs/migrations.md`
- Change:
  - Expanded creation gear foundation from partial support to full create-character class/background coverage with strict package options, curated presets, class-based free-choice budgets, and a shared catalog/filter helper surface for upcoming DM picker reuse.
  - Added a dedicated Starting Gear step to create-character wizard (Step 4 of 5) and moved review to final step.
  - Character creation persistence now resolves inventory and starting currency through the selected gear mode (`strict`, `preset`, `free`) plus auto-granted race/background items.
  - Added focused coverage tests validating class/background support completeness and strict/free loadout behavior.
- Conservative boundary:
  - No server authority changes.
  - No DM picker UI rollout in this change; only shared helper surface and persistence-ready loadout engine were expanded.
  - No Open5e ingestion migration in this slice.

## 2026-05-08 Character Creation Gear Phase 4 Slice 1 (DM NPC Gear Tab Wiring)

- Files: `artifacts/living-character-sheet/app/dm-npc.tsx`, `artifacts/living-character-sheet/components/DmNpcGearPicker.tsx`, `artifacts/living-character-sheet/app/create-character.tsx`
- Change:
  - Added a dedicated Gear tab to DM NPC editor flow and wired it to the shared creation gear engine.
  - Added strict/preset mode selection, package/preset content display with itemized costs, and inventory synchronization into NPC state via `onInventoryUpdate`.
  - Kept free-choice mode in conservative placeholder state (`coming soon`) while preserving budget/readout scaffolding and shared engine wiring.
  - Added missing `sectionHeader` style token used by create-character gear content cards to restore package typecheck baseline.
- Conservative boundary:
  - No server route, schema, or authority changes.
  - No destructive migration of saved NPC payloads; inventory compatibility remains additive and legacy-safe.
  - Full free-choice picker controls for DM NPCs remain deferred to a follow-up slice.

## 2026-05-08 Character Creation Gear Phase 4 Slice 2 (DM Free-Choice Completion + Advisory Budget + Quest Tie-In)

- Files: `artifacts/living-character-sheet/utils/creationGear.ts`, `artifacts/living-character-sheet/app/create-character.tsx`, `artifacts/living-character-sheet/components/DmNpcGearPicker.tsx`, `artifacts/living-character-sheet/app/dm-npc.tsx`, `artifacts/living-character-sheet/tests/state/creation-gear-foundation.test.mts`, `docs/feature-status.md`, `docs/migrations.md`
- Change:
  - Completed DM NPC free-choice picker UI with item-level add/remove quantity controls and live inventory sync through the existing NPC state path.
  - Changed free-choice budget behavior from hard cap to advisory-only for both create-character and DM NPC creation flows.
  - Added shared gear randomization helper wiring so randomization now includes gear selection in character and NPC creation flows.
  - Added an optional `Quest Tie-In` tab to DM NPC creator while keeping the existing Secrets tab and additive `quests` field compatibility.
- Conservative boundary:
  - No server route, schema, or authority changes.
  - No destructive migration of saved NPC payloads; existing additive compatibility fields remain intact.
  - Quest tie-in remains optional text linkage in current bounded UI slice (no quest authority migration).

## 2026-05-08 Character Creation Gear Phase 4 Slice 3 (DM Load Presets + Rarity Filtering)

- Files: `artifacts/living-character-sheet/utils/creationGear.ts`, `artifacts/living-character-sheet/components/DmNpcGearPicker.tsx`, `artifacts/living-character-sheet/tests/state/creation-gear-foundation.test.mts`, `docs/feature-status.md`, `docs/migrations.md`
- Change:
  - Added additive rarity metadata to creation gear catalog entries (`Common`..`Artifact`) with bounded max-rarity filtering support.
  - Added DM NPC Gear tab controls for load presets (`light`, `moderate`, `heavy`, `encumbered`) and max-rarity selector.
  - Free-choice randomization now honors category, max-rarity, and load preset constraints; load presets use estimated weight caps.
  - Added focused state tests for rarity metadata/filtering and load-preset constrained randomization.
- Conservative boundary:
  - No server route, schema, or authority changes.
  - No destructive migration of persisted NPC records; behavior is additive and UI/runtime only.
  - Existing create-character flow remains compatible with unchanged default helper call patterns.

## 2026-05-08 Character Creation Gear Phase 4 Slice 4 (Package + Bonus Loot Randomization)

- Files: `artifacts/living-character-sheet/utils/creationGear.ts`, `artifacts/living-character-sheet/components/DmNpcGearPicker.tsx`, `artifacts/living-character-sheet/app/dm-npc.tsx`, `artifacts/living-character-sheet/tests/state/creation-gear-foundation.test.mts`, `docs/feature-status.md`, `docs/migrations.md`
- Change:
  - Added bounded random bonus-loot pool entries with explicit rarity tiers (`Common`..`Artifact`) and mixed categories (weapon/armor/consumable/gear/treasure).
  - Updated randomization to scale loot volume by load preset targets (`light` sparse, `encumbered` heavy) while honoring selected max rarity.
  - Updated strict/preset randomization contract to retain base class package and append rarity-capped bonus loot so load+rarity controls materially affect output.
  - DM NPC gear picker now consumes strict/preset bonus selections when building inventory loadouts.
  - Added focused tests for strict bonus-loot ingestion, rarity-cap enforcement, and light-vs-encumbered randomization weight deltas.
- Conservative boundary:
  - No server route/schema/authority migration.
  - Additive client runtime behavior only; persisted NPC inventory compatibility remains unchanged.
  - Existing create-character call paths remain backward-compatible with unchanged required params.

---

## 2026-04-27 Combat Authority Hardening

- Files: `artifacts/living-character-sheet/types/combatOutcome.ts`, `artifacts/living-character-sheet/utils/combat/resolveHitSaveDamage.ts`, `artifacts/living-character-sheet/utils/combat/resolveCombatAction.ts`, `artifacts/living-character-sheet/context/CombatContext.tsx`, `artifacts/living-character-sheet/context/CharacterContext.tsx`
- Change: encoded explicit target authority metadata (`mode`, `canApplyLocally`, `certainty`, `reason`) so local-vs-remote consequence handling no longer depends only on the implicit `isLocalCharacter -> applyState` convention.
- Conservative boundary: no new remote mutation path was introduced; remote party members and NPCs still resolve as preview-only until server-backed or synchronized mutation authority exists.
- Risk posture: if future code accidentally marks a remote target as `applied_local`, the new explicit authority guard still blocks local character-state mutation.

## 2026-04-27 Progression / Rules Rollout (Phase 6)

- Files: `artifacts/living-character-sheet/rules/engine.ts`, `artifacts/living-character-sheet/data/progression/types.ts`, `artifacts/living-character-sheet/data/progression/engine.ts`, `artifacts/living-character-sheet/rules/registry.ts`, `artifacts/living-character-sheet/types/index.ts`, `artifacts/living-character-sheet/components/sheet/LevelUpModal.tsx`, `artifacts/living-character-sheet/app/edit-character.tsx`, `artifacts/living-character-sheet/context/CharacterContext.tsx`, `artifacts/living-character-sheet/app/create-character.tsx`
- Change: completed previously deferred progression helper stubs by deriving action/resource unlocks, hardened homebrew registry ingestion with validation, and encoded explicit multiclass non-support guardrails in deterministic level-up audit output.
- Conservative boundary: no broad rules-engine rewrite and no destructive snapshot migrations were introduced; all changes are additive and backward-compatible with existing character snapshots.
- Portability impact: progression-sensitive defense fields (damage/condition immunities and resistances) now have a post-creation maintenance path in edit flow while preserving existing import/export schema.
- Explainability groundwork: class feature records can now carry optional provenance metadata (`originKind`, `explanation`) so future UI explainability can build on stored structure without changing current behavior.

## 2026-04-27 State / Sync / Mutation Hardening (Phase 7)

- Files: `artifacts/living-character-sheet/context/MutationHistoryContext.tsx`, `artifacts/living-character-sheet/utils/mutationUndo.ts`, `artifacts/living-character-sheet/utils/aiQueue.ts`, `artifacts/living-character-sheet/context/PartyContext.tsx`, `artifacts/living-character-sheet/utils/partyApi.ts`, `artifacts/api-server/src/routes/party.ts`, `artifacts/api-server/src/lib/partyRuntimeSchema.ts`, `artifacts/api-server/src/lib/partySyncGuard.ts`
- Change: completed resource undo roundtrip for mutation history, added deterministic queue idempotency keys with dedupe for deferred AI calls, and added stale member snapshot conflict guards (`stale_member_snapshot`) to party sync to prevent older payload overwrites.
- Sync breadth: party sync/runtime defenses now include condition immunities in addition to damage resistances/immunities.
- Conservative boundary: preserved existing queue and persistence architecture; no CRDT/collaborative rewrite and no destructive migrations were introduced.

## 2026-04-27 Product / Performance / Parked Tracks (Phase 8)

- Files: `artifacts/living-character-sheet/utils/monsterApi.ts`, `artifacts/living-character-sheet/app/dm-monsters.tsx`, `artifacts/living-character-sheet/tests/state/monster-cache-plan.test.mts`
- Change: completed deferred monster compendium cache hardening by making stale-cache-first behavior explicit, adding in-flight refresh dedupe metadata, and exposing trusted cache source/staleness metadata for product surfaces.
- Product polish: DM monster compendium now supports explicit manual refresh and a lightweight cache-status indicator so users understand when they are seeing stale cached data versus fresh data.
- Conservative boundary: no data-layer redesign and no persistence migration; existing public `getCompendium` behavior remains backward compatible while `getCompendiumWithMeta` adds optional trust metadata.

## 2026-04-27 Final Roadmap and Status Reconciliation

- Files: `docs/app-map.md`, `docs/feature-status.md`, `AGENTS.md`, `.github/instructions/docs/app-map.md`, `.github/instructions/docs/feature-status.md`, `.github/instructions/AGENTS.md`, `docs/architecture.md`, `docs/combat-runtime.md`, `docs/mechanics-convergence.md`
- Change: reconciled documentation and roadmap claims with implemented Phase 1-8 code paths, including queue/sync hardening, progression/rules rollout, and monster compendium performance hardening.
- Drift reduction: restored missing root governance docs referenced by policy and converted instruction-copy docs into explicit mirrors of canonical root documents.
- Deferred audit: status docs now explicitly separate finished work, partial systems, intentionally limited boundaries, and truly deferred backlog items.

## 2026-04-27 Deferred Implementation Pass (Task-by-Task)

- Files: `lib/db/src/schema/ai.ts`, `lib/db/src/schema/index.ts`, `artifacts/api-server/src/lib/aiIdempotencyHash.ts`, `artifacts/api-server/src/lib/aiIdempotencyStore.ts`, `artifacts/api-server/src/routes/ai/index.ts`, `artifacts/api-server/src/routes/party.ts`, `artifacts/living-character-sheet/utils/partyApi.ts`, `artifacts/living-character-sheet/context/CombatContext.tsx`, `artifacts/api-server/src/lib/aiIdempotencyStore.test.ts`
- Change: implemented server-side idempotency storage/lookup for replayed AI requests and added server-authoritative remote combat outcome apply endpoint consumed by `CombatContext` for preview-only remote targets.
- Safety boundary: remote outcome apply currently handles HP/tempHP damage application for member and NPC targets; broader mutation categories remain deferred.
- Rollout note: environments must apply DB schema updates (e.g. `pnpm --filter @workspace/db run push`) to provision `ai_idempotency_records` and enable durable idempotency storage.

## 2026-04-27 Corrective Hardening and Closeout Reconciliation

- Files: `artifacts/api-server/src/routes/party.ts`, `artifacts/api-server/src/routes/ai/index.ts`, `artifacts/api-server/src/routes/party.remote-apply-route.test.ts`, `artifacts/api-server/src/routes/ai/idempotency-route-safety.test.ts`, `docs/app-map.md`, `docs/feature-status.md`, `docs/architecture.md`, `docs/combat-runtime.md`, `AGENTS.md`
- Change: hardened remote apply with fail-closed source member and turn-ownership guards, isolated AI idempotency persistence failures from normal route outcomes, and added focused api-server route safety tests for both paths.
- Conservative boundary: remote apply scope remains limited to current preview-only remote member/NPC HP/tempHP consequences; no broader remote mutation model was introduced.
- Reconciliation outcome: docs, roadmap/status language, and recommended validation commands were updated to match shipped behavior and current deferred backlog.

## 2026-04-28 Progression UX Alignment (Product Phase 2)

- Files: `artifacts/living-character-sheet/components/sheet/LevelUpModal.tsx`, `artifacts/living-character-sheet/app/(tabs)/sheet.tsx`, `artifacts/living-character-sheet/app/edit-character.tsx`
- Change: surfaced deterministic progression output more clearly in the client with level-up overview cards, explicit sheet-impact guidance, applied-change recap, recent unlock provenance on the sheet, and honest manual level-edit warnings.
- Conservative boundary: no progression authority moved out of the existing deterministic audit / AI fallback split; this phase is UI-only and preserves explicit multiclass and unsupported-class guardrails.
- Product intent: align progression UX closer to D&D rules structure while keeping BG3-style clarity about what changed, what still needs user choice, and when the manual editor is not a substitute for the guided level-up flow.

## 2026-04-27 Options Settings Integration and Cleanup (Phase A2)

- Files: `artifacts/living-character-sheet/context/AppSettingsContext.tsx`, `artifacts/living-character-sheet/app/options.tsx`, `artifacts/living-character-sheet/utils/featureFlags.ts`
- Change: removed dead battle-NPC display keys from the canonical `AppSettings` schema while adding migration-safe hydration cleanup that strips legacy persisted keys (`showBattleNpcDisposition`, `showBattleNpcInitiative`, `showBattleNpcSourceType`) from older local snapshots.
- UX alignment: tightened misleading settings copy for `confirmBeforeDangerousActions` so the options label/description now match current runtime behavior (display-reset confirmation scope).
- Discoverability: added centralized visibility for distributed-but-real controls (`autoConcentrationSave`, `disablePartyCardThemes`) without moving authority or removing contextual controls in combat/party screens.
- Feature-flag decision: explicitly kept feature flags dev-only and separate from user settings persistence to avoid broad settings-system expansion in this phase.

## 2026-04-27 Standards Closure Micro-Pass (Combat + Progression Gate)

- Files: `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/context/CombatContext.tsx`, `artifacts/living-character-sheet/utils/combat/resolveHitSaveDamage.ts`, `artifacts/living-character-sheet/tests/smoke/level-up-flow.smoke.spec.ts`
- Change: added conservative spell-cast command shaping that extracts only explicit save/damage clues from existing spell text, includes class-derived save DC where class mapping is known, and records explicit `resolutionLimitations` instead of faking unsupported data.
- Concentration consistency: replaced implicit `concentrationSpells[0]` selection with explicit candidate selection (owned single, legacy single, or fail-ambiguous with notes) so concentration checks do not silently target the wrong spell.
- Test reliability: hardened focused level-up smoke selectors to scope within the level-up dialog and match current CTA/header labels, improving trustworthiness of the progression regression gate without changing product wording.
- Conservative boundary: no server authority redesign, no broad combat refactor, and no full spell engine introduction.

## 2026-04-28 Nested Locations Phase 1

- Files: `artifacts/living-character-sheet/types/index.ts`, `artifacts/living-character-sheet/utils/locationHierarchy.ts`, `artifacts/living-character-sheet/components/notes/LocationsTab.tsx`, `artifacts/living-character-sheet/components/notes/QuestsTab.tsx`, `artifacts/living-character-sheet/app/dm-notes.tsx`, `artifacts/living-character-sheet/context/CharacterContext.tsx`, `artifacts/living-character-sheet/utils/dmNotesStorage.ts`, `artifacts/api-server/src/routes/ai/index.ts`, `artifacts/living-character-sheet/types/questParser.ts`
- Change: introduced additive `parentLocationId` authority on `CampaignLocation`, added hierarchy ordering/breadcrumb helpers for Notes and DM Notes, and routed parser-detected location containment relationships into that field instead of treating generic graph relationships as the UI authority.
- Conservative boundary: quest links remain direct-only with no automatic inheritance up or down the location tree; existing flat save data is preserved and may remain unnested until explicitly edited, parsed, or migrated.
- Parser boundary: the AI route now recognizes and prompts for `contained_in` / `contains_location`, but ambiguous containment and conflicting parent assignments still degrade conservatively instead of forcing automatic restructuring.

## 2026-04-28 Nested Locations Phase 2 (Normalization + Coverage)

- Files: `artifacts/living-character-sheet/utils/locationHierarchy.ts`, `artifacts/living-character-sheet/utils/mechanics/characterSnapshotMechanicsAdapters.ts`, `artifacts/living-character-sheet/utils/dmNotesStorage.ts`, `artifacts/living-character-sheet/data/mockCharacter.ts`, `artifacts/living-character-sheet/tests/state/location-hierarchy.test.mts`
- Change: completed automatic hierarchy normalization for legacy payloads by inferring parent links from containment relationships, rejecting invalid parents, and clearing cyclic parent chains during snapshot and DM notes normalization.
- Data alignment: updated demo/mock campaign locations and quest location tags so nested areas use explicit parent-child links and direct quest scoping without city-wide bleed.
- Validation: added focused executable tests that cover relationship-based parent inference, cycle-safety fallback, and hierarchy breadcrumb/tree ordering.

## 2026-04-28 Deferred Review Phase 1.1 (Containment Replay)

- Files: `artifacts/living-character-sheet/types/index.ts`, `artifacts/living-character-sheet/context/CharacterContext.tsx`, `artifacts/living-character-sheet/app/dm-notes.tsx`
- Change: extended deferred review decisions to support containment replay actions (`apply_location_parent`, `keep_location_unparented`) for relationship operations, with cycle/identity guards enforced at apply time.
- UX: parser review queue now shows containment-specific approve/retry/keep-separate controls and allows apply for approved containment operations in the same batch apply path as inventory links.
- Conservative boundary: replay remains scoped to recognized location containment relationships only; unresolved/unsupported relationship types continue to defer without replay.

## 2026-04-28 Deferred Review Phase 1.2 (Parent Override Controls)

- Files: `artifacts/living-character-sheet/app/dm-notes.tsx`
- Change: containment deferred-review cards now include explicit parent override options derived from current location hierarchy, allowing reviewers to apply parser containment with a manually selected parent before replay.
- Guardrails: override options exclude self and descendant locations to prevent obvious cycles in the review surface before apply-time validation.

## 2026-04-28 Spell Engine Phase 2 Groundwork (Attack Roll Plumbing)

- Files: `artifacts/living-character-sheet/utils/combat/buildSpellDeclaredPayload.ts`, `artifacts/living-character-sheet/utils/combat/spellMetadataPresentation.ts`, `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`, `artifacts/living-character-sheet/tests/combat/buildSpellDeclaredPayload.test.mts`, `artifacts/living-character-sheet/tests/combat/spellMetadataPresentation.test.mts`
- Change: added additive prepared-spell attack-roll plumbing so spell declarations can optionally carry `declared.attackRoll` when provided, include derived spell-attack bonus hints in metadata/presentation, and keep explicit limitations when roll input is absent.
- Conservative boundary: no new roll-input UI was introduced and no resolver authority boundary changed; current cast flows continue to work without requiring additional user input.

## 2026-04-28 Spell Engine Phase 2 Slice (Sheet Attack Roll Input)

- Files: `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/tests/combat/spellMetadataPresentation.test.mts`
- Change: added a minimal optional spell-attack roll input path inside the existing sheet cast modal for prepared spells, including suggested spell-attack bonus display and optional critical-hit toggle; cast now forwards entered roll data into the existing prepared-spell resolution plumbing.
- Conservative boundary: attacks tab cast modal has not yet been given the same roll-entry controls in this slice; leaving the field blank still preserves prior conservative behavior with explicit resolver limitations.

## 2026-04-28 Spell Engine Phase 2 Slice (Attacks Modal Roll Parity)

- Files: `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`
- Change: mirrored the sheet flow by adding optional spell-attack roll input and critical toggle to the attacks tab leveled-spell slot picker, including suggested spell-attack bonus hints and validation before cast confirmation.
- Conservative boundary: this slice preserves optional entry semantics (blank roll remains valid and keeps explicit limitations) and does not yet introduce per-target save roll entry UI.

## 2026-04-28 Spell Engine Phase 2 Slice (Per-Target Save Roll Capture)

- Files: `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`
- Change: added optional per-target save roll inputs to prepared-spell cast modals (sheet and attacks) when a spell declares a save and targets are selected; entered totals are now forwarded through `declared.save.targetRolls` for resolver consumption.
- Conservative boundary: save roll entry remains optional and only populates selected target IDs, preserving existing unresolved-save behavior when fields are left blank.

## 2026-04-28 Spell Engine Phase 2 Slice (Cantrip Modal Routing)

- Files: `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`
- Change: routed prepared cantrip casts through the same cast modal path used for leveled spells so optional spell-attack and per-target save roll inputs apply consistently before command submission.
- Conservative boundary: no resolver authority changes; this is UI flow unification only, and cantrips continue to consume no slots.

## 2026-04-28 Spell Engine Phase 2 Slice (Declared Save Roll Summary)

- Files: `artifacts/living-character-sheet/utils/combat/spellMetadataPresentation.ts`, `artifacts/living-character-sheet/tests/combat/spellMetadataPresentation.test.mts`
- Change: extended declared spell summary formatting to include a compact `Target save rolls` line when `declared.save.targetRolls` is present, with a short preview and overflow count for quick in-session verification.
- Conservative boundary: presentation-only change; no command payload, resolver authority, or combat outcome behavior changed.

## 2026-04-28 Spell Engine Phase 2 Slice (Named Save Roll Summary)

- Files: `artifacts/living-character-sheet/utils/combat/spellMetadataPresentation.ts`, `artifacts/living-character-sheet/tests/combat/spellMetadataPresentation.test.mts`, `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`
- Change: cast outcome declared summary now resolves `declared.save.targetRolls` preview labels to party target names when available, and both sheet/attacks summaries now use the final merged declared payload (including target save rolls) rather than the pre-merge payload.
- Conservative boundary: summary/readability improvement only; no resolver logic or authority pathways changed.

## 2026-04-28 Spell Engine Phase 2 Slice (Save Roll Preview Order)

- Files: `artifacts/living-character-sheet/utils/combat/spellMetadataPresentation.ts`, `artifacts/living-character-sheet/tests/combat/spellMetadataPresentation.test.mts`, `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`
- Change: declared save roll preview now accepts selected target ordering and displays preview entries in that order (with stable fallback for unordered IDs), improving consistency with the target picker sequence.
- Conservative boundary: presentation ordering only; no resolver or payload semantics changed.

## 2026-04-28 Combat Depth Phase C2 (Spell Engine Expansion)

- Files: `artifacts/living-character-sheet/utils/combat/buildSpellDeclaredPayload.ts`, `artifacts/living-character-sheet/types/combatResolution.ts`, `artifacts/living-character-sheet/types/combatOutcome.ts`, `artifacts/living-character-sheet/utils/combat/resolveHitSaveDamage.ts`, `artifacts/living-character-sheet/utils/combat/spellMetadataPresentation.ts`, `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`, `artifacts/living-character-sheet/tests/combat/buildSpellDeclaredPayload.test.mts`, `artifacts/living-character-sheet/tests/combat/spellMetadataPresentation.test.mts`, `artifacts/living-character-sheet/tests/combat/resolveCombatAction.safety.test.mts`
- Change: expanded prepared-spell declaration shaping with structured spell metadata (`mode`, `targetScopeHint`, `scaling`, `concentration`, `damageModel`, parsing confidence), added conservative dice-expression damage packet extraction using deterministic averages, introduced explicit safe upcast support for known spells plus bounded text-pattern scaling, and improved resolver fidelity by preventing attack-mode spell auto-resolution when attack rolls are missing.
- Feedback improvements: cast declared summary now surfaces spell mode/scope, dice packet previews, scaling status, and damage model details; cast metadata now carries richer declaration context for troubleshooting and UX.
- Conservative boundary: no authority-boundary rewrite and no speculative full-rule parser; unsupported or ambiguous spell semantics remain explicit limitations instead of inferred automation.

## 2026-04-28 Combat Depth Phase C2 Corrective Patch (Choice-Type Upcast Honesty)

- Files: `artifacts/living-character-sheet/utils/combat/buildSpellDeclaredPayload.ts`, `artifacts/living-character-sheet/tests/combat/buildSpellDeclaredPayload.test.mts`
- Change: removed the explicit Chromatic Orb upcast rule that hardcoded an incorrect damage type and added a conservative guard that keeps upcast scaling partial when the chosen damage type is not explicitly declared in the cast payload.
- Safety intent: prefer explicit limitation text over false precision for choice-based spell damage semantics until a safe declared choice path exists.

## 2026-04-28 Combat Depth Phase C3 (Condition Engine Expansion)

- Files: `artifacts/living-character-sheet/types/combatConditions.ts`, `artifacts/living-character-sheet/types/combatResolution.ts`, `artifacts/living-character-sheet/types/combatOutcome.ts`, `artifacts/living-character-sheet/utils/combat/buildSpellDeclaredPayload.ts`, `artifacts/living-character-sheet/utils/combat/resolveHitSaveDamage.ts`, `artifacts/living-character-sheet/utils/combat/resolveCombatAction.ts`, `artifacts/living-character-sheet/utils/combat/combatFeedback.ts`, `artifacts/living-character-sheet/utils/combat/spellMetadataPresentation.ts`, `artifacts/living-character-sheet/context/CharacterContext.tsx`, `artifacts/living-character-sheet/context/CombatContext.tsx`, `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`, `artifacts/living-character-sheet/tests/combat/buildSpellDeclaredPayload.test.mts`, `artifacts/living-character-sheet/tests/combat/spellMetadataPresentation.test.mts`, `artifacts/living-character-sheet/tests/combat/resolveCombatAction.safety.test.mts`
- Change: added additive structured condition-effect declaration for a bounded explicit spell set, returned per-target condition outcomes from combat resolution, applied local-authoritative condition outcomes through existing `ActiveCondition` lifecycle state, improved feedback for applied/blocked condition results, added movement blocking for speed-zero conditions, and aligned concentration-linked condition cleanup with concentration expiry.
- Conservative boundary: remote condition outcomes remain preview-only where mutation authority is unavailable; unsupported or ambiguous condition choices still degrade to explicit limitation text instead of inferred automation.

## 2026-04-28 Combat Depth Phase C4 (Reaction Automation Expansion)

- Files: `artifacts/living-character-sheet/types/combatReaction.ts`, `artifacts/living-character-sheet/types/combatResolution.ts`, `artifacts/living-character-sheet/utils/combat/buildDeclaredReaction.ts`, `artifacts/living-character-sheet/utils/combat/resolveCombatAction.ts`, `artifacts/living-character-sheet/utils/combat/combatFeedback.ts`, `artifacts/living-character-sheet/context/CombatContext.tsx`, `artifacts/living-character-sheet/components/attacks/CombatHUD.tsx`, `artifacts/living-character-sheet/components/attacks/ActionCard.tsx`, `artifacts/living-character-sheet/components/sheet/SpellsSection.tsx`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`, `artifacts/living-character-sheet/tests/combat/buildDeclaredReaction.test.mts`, `artifacts/living-character-sheet/tests/combat/resolveCombatAction.safety.test.mts`
- Change: added bounded structured reaction declaration support for a safe C4 subset (`opportunity_attack`, `shield`, `counterspell`, `readied_action`), wired declaration shaping into current reaction command entry points, and expanded resolver validation to enforce window/trigger/declaration compatibility where runtime context can prove mismatches.
- Consumption safety: reaction spend remains accepted-path only; new trigger/declaration mismatch rejects happen before economy mutation so ambiguous or mismatched reactions do not silently consume reaction state.
- Feedback: reaction outcomes now include explicit reaction-used lines with trigger context and resolved/partial status in shared summary formatting; rejection messaging now distinguishes trigger mismatch from declaration mismatch.
- Conservative boundary: no full reaction rules engine, no speculative trigger inference, and no server-authoritative remote reaction mutation expansion; unsupported reaction semantics continue to degrade to explicit limitations.

## 2026-04-28 Equipment and Weapon Integrity Phase

- Files: `artifacts/living-character-sheet/utils/equipment/equipmentSlotRules.ts`, `artifacts/living-character-sheet/context/CharacterContext.tsx`, `artifacts/living-character-sheet/utils/combat/weaponAttackProfile.ts`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`, `artifacts/living-character-sheet/tests/state/equipment-slot-rules.test.mts`, `artifacts/living-character-sheet/tests/combat/weaponAttackProfile.test.mts`
- Change: added a canonical equipment-slot normalization pass with explicit hand occupancy legality (two-handed weapons, one-handed weapons, shields) and wired it into inventory equip/hydration/update flows so impossible simultaneous hand states are auto-corrected deterministically.
- Scaling integrity: weapon attack cards now derive attack and damage modifiers from current ability/proficiency runtime state plus explicit item damage bonus, reducing stale static-damage drift between sheet display and combat resolution payloads.
- Conservative boundary: no full inventory-system redesign and no speculative tabletop simulation were introduced; unsupported weapon scaling semantics remain explicit and limited to currently modeled fields.

## 2026-04-29 Combat-Critical Inventory Readiness Phase

- Files: `artifacts/living-character-sheet/utils/combat/inventoryCombatReadiness.ts`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`, `artifacts/living-character-sheet/tests/combat/inventoryCombatReadiness.test.mts`
- Change: added a pure combat-readiness helper that derives bounded inventory warnings from the existing item model and appends them to attack card notes for linked inventory attacks.
- Readiness scope: equipped or linked weapon attacks now surface attunement verification notes for `Requires Attunement` items and ammunition warnings for ammo-dependent weapons, including an explicit missing-ammo note when no tracked ammunition consumable is present.
- Conservative boundary: no ammo-linking/consumption engine, no attuned-state workflow, and no encumbrance rules were introduced; warnings are advisory only and do not change combat authority or block attack usage.

## 2026-04-29 Combat Depth Phase C1 (Death Resolution and Edge Completion)

- Files: `artifacts/living-character-sheet/types/index.ts`, `artifacts/living-character-sheet/utils/combat/zeroHpLifecycle.ts`, `artifacts/living-character-sheet/context/CharacterContext.tsx`, `artifacts/living-character-sheet/app/(tabs)/sheet.tsx`, `artifacts/living-character-sheet/tests/combat/zeroHpLifecycle.test.mts`
- Change: extended the zero-HP lifecycle helper with explicit `dead` semantics and a deterministic zero-HP state classifier (`conscious` / `dying` / `stable` / `dead`), then wired the client-authoritative death-save flow and sheet banner to use that state directly.
- Resolution scope: three failed death saves now produce a first-class dead state that blocks further death-save/stabilize progression, while three successes or manual stabilize continue to produce a stable-at-0-HP state without widening combat authority.
- Conservative boundary: nat 1 / nat 20 roll automation remains intentionally unimplemented because the current sheet flow records only success/failure outcomes, not raw d20 death-save rolls; no resurrection workflow, spell automation, or networked state changes were introduced.

## 2026-04-28 Nested Locations Phase 3 (Quest Link Inheritance)

- Files: `artifacts/living-character-sheet/types/index.ts`, `artifacts/living-character-sheet/utils/dmNotesStorage.ts`, `artifacts/living-character-sheet/utils/locationHierarchy.ts`, `artifacts/living-character-sheet/components/notes/QuestsTab.tsx`, `artifacts/living-character-sheet/components/notes/LocationsTab.tsx`, `artifacts/living-character-sheet/app/dm-notes.tsx`, `artifacts/living-character-sheet/tests/state/location-hierarchy.test.mts`, `docs/feature-status.md`
- Change: completed additive quest-location inheritance support by introducing per-link mode metadata (`locationLinkModes`) and an effective-link resolver that keeps direct links authoritative while optionally propagating inherited links to descendants.
- UX: quest editing now supports mode toggling per linked location, quest cards annotate descendant-propagating links, and Notes/DM Notes location cards render direct and inherited quest pills distinctly.
- Data safety: DM notes quest normalization now sanitizes persisted mode maps to selected linked locations and valid mode values only.
- Conservative boundary: inheritance is explicit opt-in per quest-location link; default behavior remains direct-only and no authority moved out of existing quest/location client context paths.

## 2026-04-28 Combat Depth Phase C5 (Combat Authority Expansion)

- Files: `artifacts/api-server/src/routes/party.ts`, `artifacts/api-server/src/routes/party.remote-apply-route.test.ts`, `docs/feature-status.md`
- Change: expanded the server-authoritative remote outcome apply route so preview-only remote member/NPC outcomes can now apply bounded condition mutations (`apply_condition` / `remove_condition`) in addition to existing HP/tempHP consequences.
- Safety hardening: route validation now fail-closes targetType/authority mismatches and only accepts condition result statuses/effect-type combinations that are explicitly supported (`applied` with `apply_condition`, `removed` with `remove_condition`).
- Conservative boundary: remote authority remains limited to bounded damage and condition consequences; broader remote combat mutation semantics are still deferred.

## 2026-04-28 Product Phase P1 (Shared Notes Fidelity Pass)

- Files: `artifacts/living-character-sheet/utils/partyNotesMerge.ts`, `artifacts/living-character-sheet/app/party.tsx`, `artifacts/living-character-sheet/app/dm-party.tsx`, `artifacts/living-character-sheet/tests/state/party-note-merge-fidelity.test.mts`
- Change: replaced flat note-assignment acceptance merges with a fidelity-preserving merge path that keeps existing world-graph fields where payload data supports them (location parent hierarchy, quest location-link modes, person location tags).
- Safety behavior: merge path now emits explicit deferred warnings for unsupported/unsafe graph updates (invalid mode mappings, mode-without-link, unresolved parent references, cycle-safe parent reset) instead of silently dropping semantics.
- Payload context: DM note assignment now includes quest-linked location ancestors when related locations are included, improving parent-link resolvability during player acceptance without redesigning notes flows.
- Conservative boundary: this phase does not add parser replay support, does not introduce new graph semantics, and does not redesign the notes UI.

## 2026-04-29 Trust and Contract Stabilization (Phase A)

- Files: `lib/api-spec/openapi.yaml`, `artifacts/api-server/src/routes/ai/index.ts`, `artifacts/api-server/src/routes/ai/parser-contract.test.ts`, `artifacts/api-server/package.json`, `artifacts/living-character-sheet/utils/characterImportExport.ts`, `artifacts/living-character-sheet/app/characters.tsx`, `artifacts/living-character-sheet/tests/state/character-import-export-contract.test.mts`, `artifacts/living-character-sheet/package.json`
- Change: expanded OpenAPI from health-only coverage to high-use shipped party/AI endpoints, including explicit idempotency request/replay headers for the route set already wired through idempotency guards.
- Trust hardening: added deterministic parser normalization contract tests (quick-update deferred review and loot review defaults) and explicit api-server `test` script wiring so required route safety validation can run via workspace-standard command shape.
- Portability hardening: introduced focused character import/export helper tests for full snapshot import, bare-character fallback import, malformed JSON rejection, and portable export envelope shape; characters list export now uses the same portable snapshot assembly path as edit export.

## 2026-05-07 Party Member Sheet Click + Player Loot Send

- Files: `artifacts/living-character-sheet/app/party.tsx`, `artifacts/living-character-sheet/utils/partyItemTransfer.ts`, `artifacts/living-character-sheet/tests/state/party-item-transfer.test.mts`, `artifacts/api-server/src/routes/party.ts`, `docs/feature-status.md`
- Change: completed party-side member sheet access by making the full member card tap target route to `party-member`, and added a bounded player-to-player inventory send flow that reuses the existing party loot assignment channel with sender-side local inventory decrement/removal after successful assignment.
- Compatibility boundary: item sending is intentionally scoped to eligible unequipped inventory stacks to avoid expanding equip/slot authority paths in this slice; receiving still uses the existing claim flow.
- Event fidelity: loot assignment event text now differentiates DM-originated vs player-originated assignment sources.

## 2026-05-07 Combat Economy Authority Parity (Narrow Bounded Slice)

- Files: `artifacts/living-character-sheet/context/CombatContext.tsx`, `artifacts/living-character-sheet/utils/partyApi.ts`, `artifacts/api-server/src/routes/party.ts`, `artifacts/living-character-sheet/tests/smoke/party-combat-economy.smoke.spec.ts`
- Change: aligned party combat economy semantics between client resolver and server spend endpoint by introducing bounded slot-limit propagation for action/bonus-action spends, with fail-closed defaults when limits are absent.
- Bounded support: extra-slot handling is intentionally capped to a conservative maximum of 2 total action slots and 2 total bonus-action slots in party authoritative mode.
- Safety behavior: server spend updates now preserve monotonic used counts and prevent regressions/decrements when stale or lower limits are supplied, avoiding repeated-accept loops while preserving baseline 1/1 behavior.
- Conservative boundary: no remote mutation scope changes, no reaction/condition rule expansion, and no broad combat authority rewrite.

## 2026-04-29 Companion Combat Projection (Phase 1)

- Files: `artifacts/living-character-sheet/utils/partyApi.ts`, `artifacts/living-character-sheet/utils/combat/companionProjection.ts`, `artifacts/living-character-sheet/app/(tabs)/sheet.tsx`, `artifacts/api-server/src/routes/party.ts`, `artifacts/api-server/src/lib/partyRuntimeSchema.ts`, `artifacts/living-character-sheet/tests/state/character-import-export-contract.test.mts`, `artifacts/api-server/src/routes/party.remote-apply-route.test.ts`
- Change: added a projection-only companion combat path that maps companion records into existing combat NPC entries, with additive optional `projection` metadata (`combatantKind: "companion"`, companion and owner identifiers) carried through client contract, server normalization, and runtime snapshot typing.
- Authority boundary: no `targetType` expansion and no remote apply authority broadening; companions continue to participate as NPC targets within existing member/NPC combat authority constraints.
- Compatibility: this is additive-only and preserves existing NPC/monster projection flows; no destructive schema migration or legacy compatibility path removal was introduced.
- Conservative boundary: no authority-boundary shifts, no combat scope expansion, and no schema-destructive migration were introduced in this phase.

## 2026-04-29 Companion Combat Owner Interaction (Phase 2)

- Files: `artifacts/living-character-sheet/context/CombatContext.tsx`, `artifacts/living-character-sheet/utils/combat/companionCombatPresentation.ts`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`, `artifacts/living-character-sheet/components/attacks/ActionCard.tsx`, `artifacts/living-character-sheet/components/attacks/CombatHUD.tsx`, `artifacts/living-character-sheet/components/attacks/PartyMiniList.tsx`, `artifacts/living-character-sheet/app/dm-party.tsx`, `artifacts/living-character-sheet/tests/state/character-import-export-contract.test.mts`, `artifacts/api-server/src/routes/party.remote-apply-route.test.ts`
- Change: added an owner-controlled interaction layer for projected companions by surfacing companion ownership labels in combat UI and exposing a bounded "acting as" selector that maps companion actions through the existing player turn/economy model.
- Interaction boundary: no independent companion turns were added; selected companion actor context is presentation/metadata only while command authority remains member-owned and target handling remains member/npc.
- Safety boundary: no remote apply rule expansion and no `targetType` expansion; focused tests now assert companion classification visibility and continued rejection of unsupported target types.

## 2026-04-28 Product Phase P2 (Encounter Flow Unification)

- Files: `artifacts/living-character-sheet/utils/encounterSetupIntent.ts`, `artifacts/living-character-sheet/app/dm-monsters.tsx`, `artifacts/living-character-sheet/app/dm-party.tsx`, `artifacts/living-character-sheet/tests/state/encounter-setup-handoff.test.mts`
- Change: introduced lightweight transient encounter setup handoff carrier to guide DM workflow from monster selection → battle setup. When user selects monsters in dm-monsters and lacks active encounter, they can now click "Set Up Encounter in DM Party" to navigate directly to dm-party with staged monster selection, quantities, and dispositions pre-filled for review/confirmation before import.
- UX flow: dm-monsters now shows conditional "Add to Encounter" (when battle exists) and "Set Up Encounter in DM Party" (when battle missing) buttons. dm-party displays "Continuing Monster Setup" banner when handoff context is active, pre-selects target battle if known, and allows confirm/discard of staged imports.
- Handoff mechanism: lightweight module-scoped transient state (not persistent) survives brief screen navigation, auto-clears after successful import, explicit user discard, or staleness detection (>2 minutes). Includes 17 comprehensive tests covering state preservation, battle targeting, fallback behavior, and cleanup semantics.
- Authority boundary: no combat authority expansion; purely client-side UX orchestration and state carryover. Existing DM Monsters and DM Party flows remain unchanged when no handoff context exists.
- Conservative boundary: does not redesign encounter-builder, does not auto-generate encounters, does not mutate any battle state on navigation, preserves explicit handoff pattern with user review before any data import.

## 2026-04-28 Product Phase P3 (Party Events UX Upgrade)

- Files: `artifacts/living-character-sheet/app/party.tsx`, `artifacts/living-character-sheet/utils/partyEventHistory.ts`, `artifacts/living-character-sheet/tests/state/party-event-history.test.mts`
- Change: upgraded party event history readability and utility by introducing lightweight event view-model helpers (type/actor/combat filtering, important-event highlighting, date sectioning, and sparse-metadata-safe actor/message fallbacks) and wiring them into the existing Party Events surface.
- UX impact: event stream now supports practical live-play controls (event type filters, actor/source filters, combat-vs-general toggle, important-only toggle) plus quick focus presets (`Latest`, `Combat`, `Important`) and grouped cards for faster scanning during sessions.
- Safety behavior: fallback behavior is explicit when event metadata is sparse or legacy (unknown timestamps show placeholder time, actor/source resolves to `System` when absent, empty messages degrade to typed fallback labels).
- Authority boundary: no event storage, server route, or authority semantics changed; this is a client-only presentation/filtering layer over existing `combatState.eventLog` records.
- Conservative boundary: avoids dashboard/analytics expansion and keeps Party Events as a lightweight operational feed for active play.

## 2026-05-26 Product Phase P4 (Micro-consistency and Trust Polish)

- Files: `artifacts/living-character-sheet/utils/partyEventHistory.ts`, `artifacts/living-character-sheet/app/party.tsx`, `artifacts/living-character-sheet/app/dm-party.tsx`, `artifacts/living-character-sheet/tests/state/party-event-history.test.mts`
- Change: targeted view-layer trust and consistency fixes across the party/event surfaces. No event authority, storage, or server semantics changed.
- Trust fixes:
  - `resolveParticipantLabel` in `partyEventHistory.ts` now returns `"Source unavailable"` (instead of the raw UUID) for participant IDs that cannot be resolved to a name — prevents UUID leaking into player-visible event cards.
  - Empty turn participant IDs in `resolveBattleLogParticipantLabel` (DM Party) now render as `"—"` instead of `"none"`, matching natural language conventions.
  - DM Party Battle Log actor resolution fallback changed from `"Unknown"` → `"Source unavailable"` for the same consistency.
- Empty-state fixes:
  - Party Event Log now distinguishes "no events exist at all" (prompts that events appear during live sessions) from "events filtered to zero" (shows count of hidden events and a `Clear Filters` action inline).
  - DM Party Battle Log section now always renders when `combatState` is present (instead of only when `eventLog.length > 0`), showing a clear empty state when no events have been recorded yet.
- UX clarity fixes:
  - `"Latest"` preset button renamed to `"Reset"` and dynamically highlighted when any filter is active — removes ambiguity that "Latest" only showed recent events.
  - Filter section rows in Party Event Log now labelled `RELEVANCE`, `TYPE`, and `SOURCE` so users understand what each chip row controls.
  - `PartyEventHistoryView` now exposes `hasActiveFilters: boolean` and `totalUnfilteredCount: number` — used by the UI to provide accurate count indicators and smart empty-state behaviour.
- Tests: 4 new test cases added to `party-event-history.test.mts` (9 total, all passing): unresolvable actor label, `hasActiveFilters` false/true, `turn_advanced` message with unresolvable participant IDs.
- Conservative boundary: no authority boundary crossings; all changes are pure view-layer (rendering, label, fallback copy). No new broad systems added.

## 2026-05-07 Adventure / AI DM Phase 0 Scaffolding (Slices A-D + Docs Alignment)

- Files: `artifacts/living-character-sheet/app/_layout.tsx`, `artifacts/living-character-sheet/app/landing.tsx`, `artifacts/living-character-sheet/app/adventure/_layout.tsx`, `artifacts/living-character-sheet/app/adventure/index.tsx`, `artifacts/living-character-sheet/app/adventure/new.tsx`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/components/adventure/AdventureHeaderBackButton.tsx`, `artifacts/living-character-sheet/components/adventure/AiDmSessionAwarenessPlaceholderStrip.tsx`, `artifacts/living-character-sheet/utils/aiDmRouteDefs.ts`, `artifacts/living-character-sheet/types/aiDmContracts.ts`, `artifacts/living-character-sheet/types/aiDmStyle.ts`, `artifacts/living-character-sheet/types/aiDmJournal.ts`, `artifacts/living-character-sheet/types/aiDmPolicy.ts`, `artifacts/living-character-sheet/types/index.ts`, `docs/app-map.md`, `docs/feature-status.md`, `docs/migrations.md`
- Slice A: established Adventure route scaffolding and placeholder screens only.
- Slice B: added shared AI DM contract layer and export surface only.
- Slice C: added landing/home discoverability and narrow IA wiring for Adventure only.
- Slice D: added minimal session-awareness placeholder contracts/helpers/UI only.
- Docs alignment: canonical docs now explicitly reflect that Phase 0 exists and remains scaffold-only.
- Conservative boundary:
  - No AI DM runtime implementation.
  - No orchestration or tool-execution logic.
  - No persistence or active-session store.
  - No active-session behavior across supporting screens.
  - No combat, party, DM, or server authority changes.
- Current status: Adventure / AI DM Phase 0 is groundwork for future phases, not a runtime-complete feature.

## 2026-05-07 Adventure / AI DM Phase 1 (Slices 1-6, bounded one-off session shell)

- Files: `artifacts/living-character-sheet/app/adventure/new.tsx`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/components/adventure/session/AiDmOneOffSetupForm.tsx`, `artifacts/living-character-sheet/components/adventure/session/AiDmSessionFeedShell.tsx`, `artifacts/living-character-sheet/components/adventure/session/AiDmSessionInputComposer.tsx`, `artifacts/living-character-sheet/components/adventure/session/AiDmSessionQuickActionsRow.tsx`, `artifacts/living-character-sheet/components/adventure/session/AiDmCombatSubmodePanel.tsx`, `artifacts/living-character-sheet/components/adventure/session/AiDmSessionOutcomeShell.tsx`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSessionBootstrap.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSessionGuidance.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmSessionFeedScaffold.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffToolBridge.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffOutcomeScaffold.ts`, `artifacts/living-character-sheet/utils/aiDmRouteDefs.ts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-session-bootstrap.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-session-guidance.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-session-feed-scaffold.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-tool-bridge.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-combat-panel-bridge.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-outcome-scaffold.test.mts`, `docs/feature-status.md`, `docs/migrations.md`
- Slice 1-2: one-off setup bootstrap + active-session feed shell.
- Slice 3: deterministic guidance seed with user-guidance override and safe fallback generation.
- Slice 4: bounded one-off tool bridge (allowlist, policy mapping, fail-closed unsupported rejection).
- Slice 5: combat submode panel wired to existing PartyContext/partyApi authority paths only.
- Slice 6: outcome shell state for loot-hook and encounter-closure follow-up summaries (deterministic local reducer only).
- Validation:
  - Focused state tests for bootstrap/guidance/feed/tool-bridge/combat-panel/outcome-scaffold are passing.
  - `pnpm --filter @workspace/living-character-sheet run typecheck` passes.
  - `pnpm run validate:combat-baseline` passes.
- Conservative boundary:
  - No new API/server routes.
  - No AI DM persistent session store/orchestrator.
  - No authority-boundary migration between adventure shell and combat/party authorities.
  - No broad supporting-screen AI DM awareness rollout.

## 2026-05-07 Adventure / AI DM Phase 1 Slice 7 (Docs Convergence / Anti-Drift)

- Files: `docs/app-map.md`, `docs/feature-status.md`, `docs/migrations.md`
- Change: reconciled canonical docs language to reflect current Adventure reality as "Phase 1 bounded one-off shell" rather than "Phase 0 scaffold-only" wording.
- Clarification added:
  - Implemented: bounded local one-off setup/session shell (deterministic feed + tool bridge + combat panel hooks + outcome shell state).
  - Still intentionally deferred: persisted AI DM orchestration/runtime authority, broad cross-screen active-session awareness, and server-authoritative Adventure runtime.
- Conservative boundary: docs-only convergence; no runtime behavior, route authority, persistence, or API contract changes.

## 2026-05-07 Adventure / AI DM Phase 1 Follow-up (Structured Outcome Contract Hardening)

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmOneOffToolBridge.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffOutcomeScaffold.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-tool-bridge.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-outcome-scaffold.test.mts`, `docs/migrations.md`
- Change: one-off tool bridge now emits explicit `structuredResult.kind` values for quick-action outcomes, and session outcome reduction now consumes those structured kinds (with tool-name fallback for compatibility).
- Safety intent: avoid fragile string-coupling drift where outcome state depends on action-name inference rather than explicit bridge contract signals.
- Validation:
  - `pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/ai-dm-oneoff-tool-bridge.test.mts tests/state/ai-dm-oneoff-outcome-scaffold.test.mts tests/state/ai-dm-oneoff-combat-panel-bridge.test.mts` passes.
  - `pnpm --filter @workspace/living-character-sheet run typecheck` passes.
  - `pnpm run validate:combat-baseline` passes.
- Conservative boundary: no server/API route changes, no authority migration, no persisted Adventure runtime changes.

## 2026-05-07 Adventure / AI DM Phase 1 Follow-up (Route-Level Smoke Coverage)

- Files: `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Change: added a focused Playwright smoke spec for the one-off Adventure session route that verifies outcome-shell transitions (`Idle` -> `Loot Ready` -> `Encounter Closed`) via quick actions.
- Validation:
  - `pnpm --filter @workspace/living-character-sheet exec playwright test tests/smoke/adventure-oneoff-session.smoke.spec.ts --config playwright.smoke.config.ts` passes.
- Conservative boundary: test-only coverage addition; no runtime logic, authority, or API changes.

## 2026-05-07 Adventure Smoke Runner Standardization (Tag/Grep Path)

- Files: `artifacts/living-character-sheet/scripts/run-smoke.cjs`, `artifacts/living-character-sheet/package.json`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Change:
  - Smoke runner now forwards CLI args to Playwright so `pnpm run test:smoke -- --grep ...` behaves as expected.
  - Adventure smoke suite now uses a stable grep-friendly marker (`smoke:adventure`) in the suite title.
  - Added convenience script `test:smoke:adventure` for targeted Adventure route checks.
- Validation:
  - `pnpm --filter @workspace/living-character-sheet run test:smoke -- --grep "smoke:adventure"` passes.
  - `pnpm --filter @workspace/living-character-sheet run test:smoke:adventure` passes.
- Conservative boundary: test harness/script ergonomics only; no production runtime, authority, or API changes.

## 2026-05-07 Adventure / AI DM Phase 1 Slice 8 (Session Recap + Bounded Handoff Contract)

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmOneOffRecapScaffold.ts`, `artifacts/living-character-sheet/components/adventure/session/AiDmSessionOutcomeShell.tsx`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-recap-scaffold.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Change:
  - Added deterministic session recap builder and bounded handoff payload shape for one-off session closure.
  - Session route now computes recap/handoff only when outcome state is `encounter_closed`.
  - Outcome shell now renders recap lines and summarized handoff metadata after closure.
  - Adventure smoke test now verifies recap and handoff sections appear after `End Encounter`.
- Validation:
  - `pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/ai-dm-oneoff-recap-scaffold.test.mts tests/state/ai-dm-oneoff-outcome-scaffold.test.mts tests/state/ai-dm-oneoff-tool-bridge.test.mts` passes.
  - `pnpm --filter @workspace/living-character-sheet run typecheck` passes.
  - `pnpm --filter @workspace/living-character-sheet run test:smoke:adventure` passes.
- Conservative boundary:
  - No persistence backend/session storage added.
  - No server API or authority changes.
  - Handoff payload remains local deterministic contract scaffolding only.

## 2026-05-07 Adventure / AI DM Phase 1 Slice 9 (Local Review-and-Apply Gate)

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmOneOffRecapScaffold.ts`, `artifacts/living-character-sheet/components/adventure/session/AiDmSessionOutcomeShell.tsx`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-recap-scaffold.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Change:
  - Added deterministic `canApplyOneOffHandoff` gate requiring both encounter closure and explicit local approval.
  - Outcome shell now includes local review controls: `Approve Handoff` and gated `Apply Handoff (Deferred)`.
  - Session route tracks local approval state, resets it on session/outcome reset, and appends explicit feed notes for approve/apply actions.
  - Adventure smoke now verifies approval-required messaging and post-approval local state visibility.
- Validation:
  - `pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/ai-dm-oneoff-recap-scaffold.test.mts tests/state/ai-dm-oneoff-outcome-scaffold.test.mts tests/state/ai-dm-oneoff-tool-bridge.test.mts` passes.
  - `pnpm --filter @workspace/living-character-sheet run typecheck` passes.
  - `pnpm --filter @workspace/living-character-sheet run test:smoke:adventure` passes.
- Conservative boundary:
  - No backend/session persistence write path introduced.
  - Apply remains explicitly deferred/local-only.
  - No server authority or API contract changes.

## 2026-05-07 Next-Phase Milestone (Local Handoff Snapshot Export + Saved Sessions)

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmOneOffRecapScaffold.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSessionArchiveStorage.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/components/adventure/session/AiDmSessionOutcomeShell.tsx`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-recap-scaffold.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Change:
  - Added schema-versioned handoff payload contract (`oneoff-handoff.v1`).
  - Added AsyncStorage-backed local archive for approved/applied one-off handoff snapshots.
  - Session apply action now persists local snapshot (still deferred from any server-authoritative apply path).
  - Adventure Saved Sessions route now renders archived one-off snapshots and opens selected sessions with route params.
  - Adventure smoke now verifies save flow and visibility in Saved Sessions.
- Validation:
  - `pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/ai-dm-oneoff-recap-scaffold.test.mts tests/state/ai-dm-oneoff-outcome-scaffold.test.mts tests/state/ai-dm-oneoff-tool-bridge.test.mts` passes.
  - `pnpm --filter @workspace/living-character-sheet run typecheck` passes.
  - `pnpm --filter @workspace/living-character-sheet run test:smoke:adventure` passes.
- Conservative boundary:
  - Persistence is local client storage only.
  - No new server endpoints or remote orchestration behavior.
  - No authority-boundary migration; server apply remains explicitly deferred.

## 2026-05-07 Next-Phase Milestone Follow-up (Archive Management Controls)

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSessionArchiveStorage.ts`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Change:
  - Added archive deletion APIs (`deleteArchivedOneOffSession`, `clearArchivedOneOffSessions`).
  - Saved Sessions UI now supports `Open Session`, per-session `Delete`, and global `Clear Archive` actions.
  - Adventure smoke now verifies clear-archive action restores empty-state messaging.
- Validation:
  - `pnpm --filter @workspace/living-character-sheet run typecheck` passes.
  - `pnpm --filter @workspace/living-character-sheet run test:smoke:adventure` passes.
- Conservative boundary: local archive UX/storage only; no server routes, persistence backend changes, or authority migration.

## 2026-05-08 Adventure / AI DM Phase 2 Milestone 1 (Bounded Handoff Ingest + Submit Action)

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/api-server/src/routes/index.ts`, `artifacts/api-server/src/routes/adventure.handoff-route.test.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffHandoffApi.ts`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/app-map.md`, `docs/feature-status.md`, `docs/migrations.md`
- Change:
  - Added a dedicated API ingest endpoint at `/api/adventure/oneoff-handoffs` for schema-versioned `oneoff-handoff.v1` payload submission.
  - Added fail-closed request validation for archived handoff submission shape (handoff payload, recap lines, and client save timestamp).
  - Added idempotency-key route handling using existing API idempotency store/hash helpers for replay, in-progress, and payload-mismatch protections.
  - Added Saved Sessions submit action that posts archived handoff snapshots with a deterministic idempotency key and shows per-session submit status feedback.
  - Extended Adventure smoke flow to verify `Submit to Server` success visibility before archive clear.
- Validation:
  - `pnpm --filter @workspace/api-server exec tsx --test src/routes/adventure.handoff-route.test.ts`.
  - `pnpm --filter @workspace/living-character-sheet run test:smoke:adventure`.
- Conservative boundary:
  - Ingest is currently an acknowledgment bridge only; no adventure runtime orchestration migration was introduced.
  - No server-authoritative session engine, no cross-screen orchestration rollout, and no combat/party authority boundary changes.

## 2026-05-08 Adventure / AI DM Phase 2 Milestone 2 (Ingest + Submit Safety Hardening)

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/api-server/src/routes/adventure.handoff-route.test.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffHandoffApi.ts`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Change:
  - Added route-level helper hardening for one-off ingest idempotency handling with explicit replay, in-progress, and payload-mismatch response paths.
  - Added explicit invalid-payload fail-closed response contract helper for consistent route-level 400 response shape.
  - Expanded adventure handoff route tests to cover idempotent replay behavior, in-progress rejection, payload mismatch rejection, and invalid payload contract assertions.
  - Hardened client submit helper to parse structured and non-JSON error payloads safely, validate success response shape, and surface typed submit error categories.
  - Saved Sessions submit status now distinguishes normal success vs replay-acknowledged success and maps idempotency conflict categories to explicit user-visible messages.
  - Adventure smoke submit assertion now accepts either first-submit success wording or replay-acknowledged wording while keeping the same bounded flow.
- Conservative boundary:
  - No adventure runtime orchestration, no campaign/session persistence expansion, and no combat/party authority migration.
  - Changes remain scoped to ingest/submit reliability and route/client safety handling.

## 2026-05-08 Adventure / AI DM Phase 2 Milestone 2.1 (Endpoint Idempotency Coverage + Client Error-Code Cleanup)

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/api-server/src/routes/adventure.handoff-route.test.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffHandoffApi.ts`, `docs/migrations.md`
- Change:
  - Added true endpoint-level HTTP route tests for one-off handoff idempotency integration wiring, covering replay response + replay header and payload-mismatch rejection contract.
  - Added a narrow test-only idempotency start-function override hook in the adventure route module so endpoint tests can deterministically exercise idempotency branches without changing runtime authority behavior.
  - Removed unreachable client error-code union member `invalid_json_response` from one-off submit helper types to match actual parse/error behavior.
- Conservative boundary:
  - No endpoint contract expansion for normal success paths.
  - No orchestration, persistence authority, party arbitration, or combat authority changes.
  - Saved Sessions submit UX behavior remains stable.

## 2026-05-08 Adventure / AI DM Phase 2 Milestone 3 (Traceability Slice, Bounded)

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/api-server/src/routes/adventure.handoff-route.test.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffHandoffApi.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSubmitJournal.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSubmitJournalStorage.ts`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-submit-journal.test.mts`, `docs/migrations.md`
- Change:
  - Added additive ingest trace metadata (`ingestTraceId`) on one-off ingest success responses.
  - Added endpoint test assertions that verify trace metadata is present on normal 200 ingest responses.
  - Added local client-side one-off submit journal contract + AsyncStorage-backed append/read path for submit outcomes.
  - Saved Sessions submit flow now records local submit journal entries for submitted/replay/conflict/error outcomes and includes trace diagnostics in status text when available.
- Conservative boundary:
  - No server-authoritative adventure runtime orchestration.
  - No campaign persistence expansion.
  - No party/combat authority boundary movement.

## 2026-05-08 Adventure / AI DM Phase 2 Milestone 3 Follow-up (Traceability UX + Route Contract Coverage)

- Files: `artifacts/api-server/src/routes/adventure.handoff-route.test.ts`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `docs/migrations.md`
- Change:
  - Added endpoint-level in-progress idempotency contract assertion for one-off handoff ingest route (`idempotency_in_progress` 409 response shape).
  - Added a bounded Saved Sessions local diagnostics section that renders recent submit journal outcomes and optional trace ids.
  - Submit flow now refreshes local journal diagnostics after each recorded submit attempt outcome.
- Conservative boundary:
  - No authority or orchestration changes.
  - No server API surface expansion beyond previously added trace metadata.

## 2026-05-08 Adventure / AI DM Phase 2 Milestone 3.1 (Submit Journal Storage Safety Tests)

- Files: `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-submit-journal.test.mts`, `docs/migrations.md`
- Change:
  - Added malformed storage payload fallback test to ensure submit journal read path fails closed to an empty list.
  - Added append-path retention/order test to ensure local submit journal stays capped and keeps newest-first ordering.
- Conservative boundary:
  - Test-only storage safety coverage.
  - No orchestration, authority, API, or persistence-scope expansion.

## 2026-05-08 Adventure / AI DM Phase 2 Milestone 3.2 (Traceability UI Smoke Coverage)

- Files: `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Change:
  - Expanded Adventure smoke coverage to assert the `Recent Submit Journal` section is visible after submit.
  - Added a bounded assertion that at least one recent journal outcome line is rendered for the current one-off session id.
- Conservative boundary:
  - Test-only hardening for traceability UX stability.
  - No runtime orchestration, authority, API, or persistence behavior changes.

## 2026-05-08 Adventure / AI DM Phase 2 Milestone 3.3 (Submit Journal Readability Polish)

- Files: `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `docs/migrations.md`
- Change:
  - Refined `Recent Submit Journal` rendering from dense single-line strings to small structured rows (time/session/outcome + message + optional trace line).
  - Kept existing submit behavior and data semantics unchanged; this is presentation-only diagnostics polish.
- Conservative boundary:
  - No API changes.
  - No authority or orchestration changes.
  - No persistence scope changes.

## 2026-05-08 Adventure / AI DM Phase 2 Milestone 3.4 (Local Submit Journal Utility Actions)

- Files: `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSubmitJournalStorage.ts`, `docs/migrations.md`
- Change:
  - Added local-only `Copy Journal` and `Clear Journal` actions on the Recent Submit Journal section.
  - Added bounded local diagnostics status messages for copy/clear outcomes.
  - Clipboard copy is fail-soft (unsupported platform or copy failure surfaces a non-blocking status message).
  - Added storage utility helper to clear submit journal entries.
- Conservative boundary:
  - No API changes.
  - No authority/orchestration changes.
  - No persistence scope expansion.

## 2026-05-08 Adventure / AI DM Phase 4 (Diagnostics UX Consolidation, max 3 slices)

- Files: `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-submit-journal.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Slice 1 (Diagnostics panel consolidation):
  - Kept submit diagnostics in a single bounded panel block with consolidated status + utility controls while preserving existing submit behavior.
- Slice 2 (History visibility + bounded refresh):
  - Added local-only `Showing latest X entries.` indicator for recent submit journal visibility.
  - Added local-only `Last refreshed ...` status and manual `Refresh Journal` action to reload from existing local storage path.
  - Preserved existing copy/clear semantics; no persistence schema changes.
- Slice 3 (Focused diagnostics coverage):
  - Added storage-level clear-helper test coverage for submit journal persistence safety.
  - Expanded adventure smoke assertions for diagnostics utility actions (`Refresh Journal`, `Clear Journal`, empty-copy status flow) and history indicator visibility.
- Validation status:
  - Full validation commands intentionally not run in this phase per active user constraint.
- Conservative boundary:
  - No API changes.
  - No authority/orchestration boundary changes.
  - No persistence scope expansion.

## 2026-05-08 Adventure / AI DM Phase 5 (Diagnostics Reliability Hardening, max 3 slices)

- Files: `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSubmitJournalPresentation.ts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-submit-journal-presentation.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Slice 1 (stale-status reset hardening):
  - Added deterministic clearing of journal diagnostics status before unrelated archive/submit actions to prevent stale status carry-over.
- Slice 2 (timestamp and line presentation helper):
  - Added a bounded local presentation helper for submit-journal time, refreshed-at text, and copy-line formatting.
  - Updated Saved Sessions diagnostics UI to use the shared helper for consistent display/copy formatting paths.
- Slice 3 (focused diagnostics tests):
  - Added focused unit tests for submit-journal presentation helper output using injected formatter hooks for deterministic assertions.
  - Expanded smoke assertions to confirm stale refresh-status text clears after unrelated submit action, while preserving strict-safe selector usage.
- Validation status:
  - Full validation commands intentionally not run in this phase per active user constraint.
- Conservative boundary:
  - No API changes.
  - No authority/orchestration changes.
  - No persistence scope expansion.

## 2026-05-08 Adventure / AI DM Phase 6 (Diagnostics Ergonomics, max 3 slices)

- Files: `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSubmitJournalPresentation.ts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-submit-journal-presentation.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Slice 1 (outcome filters):
  - Added bounded local submit-journal outcome filters (`all`, `submitted`, `replay`, `failures`) for faster diagnostics scanning.
  - Updated diagnostics count text to show visible-vs-total entries under current filter.
- Slice 2 (trace visibility toggle):
  - Added local-only trace visibility toggle (`Show Trace IDs` / `Hide Trace IDs`) defaulting hidden for readability.
  - Toggle affects journal row trace rendering and copy payload trace inclusion.
- Slice 3 (focused tests):
  - Added unit coverage for bounded outcome filter helper behavior.
  - Expanded adventure smoke with one filter interaction path and one trace-toggle interaction path.
- Conservative boundary:
  - No API changes.
  - No authority/orchestration changes.
  - No persistence scope expansion.

## 2026-05-08 Adventure / AI DM Phase 7 (Diagnostics Export + Review Clarity, max 3 slices)

- Files: `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSubmitJournalPresentation.ts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-submit-journal-presentation.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Slice 1 (bounded export action):
  - Added local-only `Export Journal` action using a compact diagnostics payload for current filtered entries.
  - Export path is fail-soft: uses share sheet when available, then clipboard fallback when available.
- Slice 2 (empty-by-filter warning):
  - Added a clear diagnostics banner when entries exist overall but current filter hides all visible rows.
- Slice 3 (focused tests):
  - Added unit coverage for export payload shaping and hidden-by-filter notice helper behavior.
  - Expanded adventure smoke with a hidden-by-filter banner assertion path.
- Conservative boundary:
  - No API changes.
  - No authority/orchestration changes.
  - No persistence scope expansion.

## 2026-05-08 Adventure / AI DM Phase 8 (Diagnostics Preference Persistence, max 3 slices)

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSubmitJournalStorage.ts`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-submit-journal.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Slice 1 (bounded local preference persistence):
  - Added local storage helpers for diagnostics preferences (`outcomeFilter`, `showTraceIds`) with safe defaults.
- Slice 2 (deterministic restore with fail-closed fallback):
  - Saved Sessions now hydrates diagnostics preferences on load and persists preference changes after hydration.
  - Malformed preference payloads fail closed to default settings (`all`, trace hidden).
- Slice 3 (focused tests and smoke restore path):
  - Added state tests for preference malformed fallback and roundtrip persistence.
  - Expanded smoke flow to verify preference restore after navigating away and back to Saved Sessions.
- Conservative boundary:
  - No API changes.
  - No authority/orchestration changes.
  - Persistence remains bounded to local client settings only.

## 2026-05-08 Adventure / AI DM Phase 9 (Continuity Awareness Polish, max 3 slices)

- Files: `artifacts/living-character-sheet/app/adventure/index.tsx`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/migrations.md`
- Slice 1 (home diagnostics context badge):
  - Adventure home now detects local diagnostics context from existing archive/journal data and surfaces a bounded `Diagnostics Context Active` entry strip.
- Slice 2 (return-to-sessions quick action):
  - Added explicit `Return to Saved Sessions` quick action on Adventure home when diagnostics context is active.
  - Added deterministic same-route `Return to Saved Sessions` quick action at the top of Saved Sessions while diagnostics context is active.
- Slice 3 (smoke continuity coverage):
  - Expanded adventure smoke to verify home diagnostics context strip visibility and the return-to-sessions navigation path.
- Conservative boundary:
  - No API changes.
  - No authority/orchestration changes.
  - No persistence scope expansion beyond existing local scaffolding.

## 2026-05-08 Adventure / AI DM Phase 10 (One-Off Production Hardening, max 3 slices)

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSubmitJournalPresentation.ts`, `artifacts/living-character-sheet/app/adventure/sessions.tsx`, `artifacts/living-character-sheet/app/adventure/index.tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-submit-journal-presentation.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-submit-journal.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/feature-status.md`, `docs/migrations.md`
- Slice 1 (diagnostics action/status consistency):
  - Added shared empty-action status helper so copy/export status messages are deterministic for both empty-all and hidden-by-filter paths.
- Slice 2 (resilience hardening):
  - Added shared continuity-context derivation helper with safe handling for malformed/negative counts.
  - Added malformed-object preference fallback coverage (invalid enum/boolean fields fail closed to defaults).
- Slice 3 (final test/doc reconciliation):
  - Expanded smoke coverage for filtered-empty copy status semantics.
  - Updated feature status/migration docs to reflect bounded one-off hardening completion and retained deferred scope.
- Conservative boundary:
  - No API changes.
  - No server authority/orchestration expansion.
  - No persistence scope expansion beyond current local diagnostics/session scaffolding.

## 2026-05-08 Adventure / AI DM Phase 11 (Campaign Scaffold Foundation)

- Files: `artifacts/living-character-sheet/utils/adventure/aiDmCampaignSessionBootstrap.ts`, `artifacts/living-character-sheet/utils/aiDmRouteDefs.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmOneOffSessionGuidance.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmSessionFeedScaffold.ts`, `artifacts/living-character-sheet/app/adventure/new.tsx`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/state/ai-dm-campaign-session-bootstrap.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-route-defs.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-oneoff-session-guidance.test.mts`, `artifacts/living-character-sheet/tests/state/ai-dm-session-feed-scaffold.test.mts`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/app-map.md`, `docs/feature-status.md`, `docs/migrations.md`
- Slice 1 (campaign contract foundation):
  - Added deterministic local campaign scaffold session bootstrap helper.
  - Extended route/session params with additive campaign metadata fields (`campaignId`, `campaignLabel`, `chapterLabel`).
  - Added campaign scaffold guidance/feed seed helpers while preserving one-off APIs.
- Slice 2 (bounded campaign entry + session shell support):
  - New Adventure now includes `Start Campaign Scaffold (Phase 11)` entry path.
  - Session shell now recognizes `campaign_scaffold` mode and renders campaign metadata plus explicit bounded-mode messaging.
  - One-off handoff recap/apply remains one-off only.
- Slice 3 (coverage + docs reconciliation):
  - Added focused state tests for campaign bootstrap, route params, campaign guidance/feed seeds.
  - Extended adventure smoke for campaign scaffold entry and session-shell bounded-mode assertions.
  - Reconciled app-map/feature-status to reflect campaign scaffold foundation without claiming full orchestration.
- Conservative boundary:
  - No API/server route changes.
  - No server authority/orchestration migration.
  - Local scaffold-only campaign foundation; persisted campaign runtime/orchestration remains deferred.

## 2026-05-08 Adventure / AI DM Phase 12 (Campaign Scaffold Ingest Bridge + Continuity Expansion)

- Files: `artifacts/api-server/src/routes/adventure.ts`, `artifacts/api-server/src/routes/adventure.handoff-route.test.ts`, `artifacts/living-character-sheet/utils/adventure/aiDmCampaignScaffoldApi.ts`, `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`, `artifacts/living-character-sheet/tests/smoke/adventure-oneoff-session.smoke.spec.ts`, `docs/app-map.md`, `docs/feature-status.md`, `docs/migrations.md`
- Scope: continued both tracks requested (`1` + `2`):
  - `1` Added bounded server-side campaign scaffold ingest contract (`campaign-scaffold.v1`) with the same idempotency replay/conflict/in-progress safety model used by one-off ingest.
  - `2` Expanded client continuity path by adding campaign scaffold submit action/status directly in campaign scaffold session shell.
- Route/API details:
  - New endpoint: `POST /api/adventure/campaign-scaffolds`.
  - Request shape includes scaffold metadata (`campaignId`, `campaignLabel`, `chapterLabel`, `mode`, guidance source, entryCount/status) plus recap lines and client timestamp.
  - Success response includes additive ingest trace metadata for diagnostics.
- Validation coverage:
  - Added route-level tests for campaign scaffold parse/success and replay contract behavior.
  - Extended adventure smoke to assert campaign scaffold submit action and success/replay status visibility.
- Conservative boundary:
  - No server-authoritative campaign orchestration runtime introduced.
  - No combat/party authority migration.
  - Bridge is ingest acknowledgment + diagnostics traceability only.

## 2026-04-28 Test Harness Expansion (Smoke + Regression Safety Net)

- Files: `artifacts/living-character-sheet/tests/smoke/core-surfaces.smoke.spec.ts`, `artifacts/living-character-sheet/tests/smoke/party-events-and-quick-update.smoke.spec.ts`, `artifacts/living-character-sheet/tests/combat/resolveCombatAction.safety.test.mts`, `artifacts/living-character-sheet/package.json`
- Change: expanded automated smoke/regression coverage for core player flows and high-risk parser/events regressions without changing product behavior.
- Added smoke coverage:
  - Core player shell route boot and tab navigation (Character, Battle, Inventory, Notes) plus Party route open.
  - Party Events panel open and filter-toggle no-crash checks (`Combat`, `Important`, `Reset`).
  - Quick Update parse-preview-apply flow with deterministic parser response via Playwright route mocking (`/api/ai/parse-quest-update`).

  ## 2026-04-30 Real Table-Play Combat Verification Suite (Test-Only)

  - Files: `artifacts/living-character-sheet/playwright.combat-qa.config.ts`, `artifacts/living-character-sheet/scripts/run-combat-qa.cjs`, `artifacts/living-character-sheet/tests/combat-qa/combat-setup-navigation.combat-qa.spec.ts`, `artifacts/living-character-sheet/tests/combat-qa/combat-attack-feedback.combat-qa.spec.ts`, `artifacts/living-character-sheet/tests/combat/resolveCombatAction.safety.test.mts`, `artifacts/living-character-sheet/tests/combat/companionCombatPresentation.test.mts`, `artifacts/living-character-sheet/package.json`
  - Change: added a dedicated combat QA test harness and bounded deterministic test coverage for reachable battle UI flows, resolver duplicate-condition behavior, and companion combat presentation contracts.
  - Scope boundary: no combat behavior, rule authority, or UI flow semantics were changed; this entry records verification-only additions.
  - Manual QA note: party multi-user out-of-turn flow, DM/live companion projection interactions, and remote-apply warning surfacing in fully synchronized encounters still require manual validation where deterministic automation remains constrained.
- Added logic-level regression coverage:
  - `resolveCombatAction.safety.test.mts` now includes a condition lifecycle case ensuring `remove_condition` resolves to `removed` when the condition is active.
- Script ergonomics:
  - Added `test:state-regression` in living-character-sheet package for focused deterministic logic regressions.
  - Added `test:regression` as a combined state + smoke harness command.
- Validation commands:
  - `pnpm --filter @workspace/living-character-sheet run test:state-regression`
  - `pnpm --filter @workspace/living-character-sheet run test:smoke -- --grep "Core Surface Smoke|Party Events and Quick Update Smoke"`
  - `pnpm --filter @workspace/living-character-sheet run test:smoke`
  - `pnpm run typecheck`
- Conservative boundary: all changes are test-only and script-only; no architecture movement, no authority boundary changes, no production behavior modifications.

## 2026-04-28 Phase B2 (Player-Facing Death Save Controls)

- Files: `artifacts/living-character-sheet/utils/combat/zeroHpLifecycle.ts`, `artifacts/living-character-sheet/context/CharacterContext.tsx`, `artifacts/living-character-sheet/app/(tabs)/sheet.tsx`, `artifacts/living-character-sheet/tests/combat/zeroHpLifecycle.test.mts`
- Change: added explicit local-only death-save success/failure recording, bounded stabilization, explicit manual reset of death-save tracking, and a compact sheet-side 0 HP affordance for those actions.
- Recovery behavior: healing above 0 HP continues to clear unconscious and reset death-save tracking through the existing Phase B HP lifecycle path.
- Conservative boundary: no remote authority changes, no universal dying/death engine, and no automatic nat-1 / nat-20 death-save roll inference because no safe shared roll-input path exists yet.

## 2026-04-28 Phase B3 (Condition Lifecycle and Duration Readiness)

- Files: `artifacts/living-character-sheet/utils/combat/conditionDurationLifecycle.ts` (new), `artifacts/living-character-sheet/context/CharacterContext.tsx` (modified), `artifacts/living-character-sheet/tests/combat/conditionDurationLifecycle.test.mts` (new)
- Change: added pure helper module for condition duration initialization, normalization, decrement, and expiry checking. Enhanced `CharacterContext.tickConditions` to safely process all duration types (rounds, turns, untilShortRest, untilLongRest, encounter, concentration, manual, permanent) using new helpers. Improved `setConditionDuration` to use safe initialization logic. Added comprehensive test coverage for round-based countdown, rest-based removal, and duration lifecycle composition with 0 HP state.
- Duration processing: `tickConditions` now normalizes each condition's duration fields before processing, handles all supported duration types consistently, and only processes conditions when tick timing matches. Concentration-linked removal and rest-based removal remain unchanged and continue to work alongside duration-based expiry.
- Conservative boundary: no universal condition rules engine, no parser/AI automation of duration, no remote authority changes, no multiclass or spell-specific logic, no UI redesign (duration display only shown if already present in data).

## 2026-04-29 Combat Depth Phase C2.1 (Remote Recovery and Clarity Hardening)

- Files: `artifacts/living-character-sheet/types/combatOutcome.ts`, `artifacts/living-character-sheet/utils/combat/applyDamagePacket.ts`, `artifacts/living-character-sheet/utils/combat/resolveHitSaveDamage.ts`, `artifacts/api-server/src/routes/party.ts`, `artifacts/api-server/src/routes/party.remote-apply-route.test.ts`, `artifacts/living-character-sheet/context/CombatContext.tsx`, `artifacts/living-character-sheet/app/(tabs)/attacks.tsx`, `artifacts/living-character-sheet/tests/combat/resolveCombatAction.safety.test.mts`, `docs/feature-status.md`
- Change: added bounded remote healing outcome support for existing preview-only member/NPC apply paths with HP-cap clamping, surfaced explicit user-facing remote-apply failure warnings in combat UI, and added actor-switch confirmation when turn economy has already been spent.
- Condition duration decision: remote condition durations remain manual/DM-resolved in party combat surfaces; no remote duration automation model was introduced.
- Conservative boundary: no new combat authority categories, no `targetType` expansion, no companion-independent turns/economy, and no combat architecture rewrite.

## 2026-05-03 Combat Remote Authority Phase C6 Slice 1 (Batch Hardening)

- Files: `artifacts/api-server/src/routes/party.ts`, `artifacts/api-server/src/routes/party.remote-apply-route.test.ts`
- Change: hardened remote apply batch handling by adding deterministic target iteration ordering, per-target validation skip entries, and stronger command identity handling via payload hash conflict checks for replayed `commandId` values.
- Safety model: invalid targets are now explicitly skipped per-target while valid targets still apply; no cross-target transaction/rollback behavior was introduced.
- Conservative boundary: no mutation-category expansion, no new `targetType`, no companion authority expansion, and no combat engine architecture change.

## 2026-05-07 AI Parse Consistency Hardening Phase 1 (Deterministic Decode Controls)

- Files: `artifacts/api-server/src/routes/ai/index.ts`, `artifacts/living-character-sheet/app/landing.tsx`, `docs/feature-status.md`
- Change: added centralized deterministic AI decode controls (`AI_TEMPERATURE`, `AI_TOP_P`, optional `AI_SEED`) and applied them across ai route chat-completion calls (`parse-update`, `analyze-loot`, `generate-loot`, `parse-quest-reward`, `repair-import`, `level-up`, `recommend-feat`, `generate-class-features`, `parse-quest-update`, `npc-appearance`, `item-properties`).
- Validation: preserved route authority boundaries and idempotency flow; parser and idempotency safety tests pass after rollout.
- Conservative boundary: this phase does not change parser normalization schemas, review gating semantics, or client-side mechanics application. Post-parse repair/promotion and semantic dedupe are deferred to the next phase.

## 2026-05-07 AI Parse Consistency Hardening Phase 2 (Server Repair and Dedupe, Partial)

- Files: `artifacts/api-server/src/routes/ai/index.ts`, `docs/feature-status.md`
- Change: added an additive server-side loot normalization repair pass that merges duplicate items by category/name, dedupes semantically equivalent effects while retaining richer entries, dedupes additional-damage rows, and performs bounded notes-to-stat-bonus promotion for simple unstructured notes.
- Review safety: escalation now sets `needsReview` when notes include unresolved mechanical claims that were not converted into structured effects.
- Review safety extension: escalation now also preserves `needsReview` for contradictory mechanical claims in notes and unresolved low-confidence mechanical claims.
- Validation: `pnpm --filter @workspace/api-server exec tsx --test src/routes/ai/parser-contract.test.ts`, `pnpm --filter @workspace/api-server exec tsx --test src/routes/ai/idempotency-route-safety.test.ts`, and `pnpm run typecheck` pass after this slice.
- Conservative boundary: no idempotency wrapper behavior changes, no route contract shape changes, and no client merge/runtime authority changes in this phase.

## 2026-05-07 AI Parse Consistency Hardening Phase 3 (Client Apply Safety Slice 1)

- Files: `artifacts/living-character-sheet/app/(tabs)/quick-update.tsx`, `artifacts/living-character-sheet/utils/quickUpdateInventorySafety.ts`, `artifacts/living-character-sheet/tests/state/quick-update-inventory-safety.test.mts`, `docs/feature-status.md`
- Change: introduced a client-side inventory safety partition in quick-update apply flow so `needsReview` inventory deltas and low-confidence structured-mechanics deltas are not auto-applied in direct-apply paths.
- UX behavior: when direct-apply is blocked for review-required inventory deltas, quick-update now surfaces explicit review guidance instead of silently applying risky inventory changes.
- Validation: `pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/quick-update-inventory-safety.test.mts`, `pnpm --filter @workspace/api-server exec tsx --test src/routes/ai/parser-contract.test.ts`, `pnpm --filter @workspace/api-server exec tsx --test src/routes/ai/idempotency-route-safety.test.ts`, and `pnpm run typecheck` pass after this slice.
- Conservative boundary: no server authority movement, no loot-review contract changes, and no inventory schema changes.

## 2026-05-07 AI Parse Consistency Hardening Phase 3 (Client Apply Safety Slice 2)

- Files: `artifacts/living-character-sheet/utils/lootReviewMerge.ts`, `artifacts/living-character-sheet/app/loot-review.tsx`, `artifacts/living-character-sheet/tests/state/loot-review-merge-safety.test.mts`, `docs/feature-status.md`
- Change: extracted loot-review dedupe/merge logic into a reusable utility and added focused tests for mixed-confidence duplicate handling, `needsReview` retention, and source-tag precedence.
- Validation: `pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/loot-review-merge-safety.test.mts`, `pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/quick-update-inventory-safety.test.mts`, and `pnpm run typecheck` pass after this slice.
- Conservative boundary: utility extraction only; no route/schema authority changes and no behavioral expansion beyond existing merge semantics.

## 2026-05-09 NPC Creator Quest Tie-In (Structured UI with Context Linking)

- Files: `artifacts/living-character-sheet/app/dm-npc.tsx`, `artifacts/living-character-sheet/app/landing.tsx`, `artifacts/living-character-sheet/types/index.ts`
- Schema Change: `NPCState` now defines `questTags: string[]`, `peopleTags: string[]`, `locationTags: string[]`, `planeTags: string[]` arrays replacing the old freeform `quests: string` field. All tag fields are initialized as empty arrays in emptyNpc() and normalized on load via dmNpcStorage normalization functions.
- Data Migration: Old `quests` freeform text field is not migrated to tags (legacy data simply loads with empty tag arrays). Export text automatically adapts to show "Linked to N quest(s)" format. All legacy NPCs remain readable without breaking; data is augmented on first edit.
- UI Changes: Quest Tie-In tab now renders four checkbox selector sections (quests, people, locations, planes) pulling data from `useCharacter()` context. Custom checkbox UI uses Feather icons. Landing page NPC list displays tag counts in export summary.
- Conservative boundary: No changes to storage format or server schema; all changes are client-side UI and state normalization. Backward compatibility guaranteed: missing tag fields default to empty arrays on read.


## 2026-10-21 Audit Remediation Slice 1: Party Data Safety

- Files: `artifacts/api-server/src/routes/party.ts`, `artifacts/api-server/src/routes/party.sync-safety.test.ts` (new), `artifacts/api-server/package.json`, `docs/feature-status.md`, `docs/migrations.md`.
- Moved the existing member freshness/replay guard ahead of member inserts/updates and session activity writes. Rejection and replay return paths no longer mutate these rows.
- Changed member deduplication from name/class/maxHP/AC matching to member ID identity; no stored records are deleted or migrated. Different IDs representing accidental repeat registrations now remain visible rather than being silently merged.
- Authority boundary: API party routes only. No client contract, combat authority category, database schema, or legacy field changes.
- Validation: three new regression tests fail on baseline and pass on the patch; combined sync/remote-apply tests pass (27 tests). API typecheck passes. Workspace validation is blocked by existing client type errors; PostgreSQL integration checks require an unavailable local database.
- Deferred: transactional member/runtime commits and concurrent sync serialization; campaign persistence recovery; authentication/DM authorization and AI quotas.

## 2026-10-21 Audit Remediation Slice 2: Campaign Save Recovery

- Files: `artifacts/api-server/src/lib/campaignContinuationStore.ts`, `artifacts/api-server/src/lib/campaignContinuationStore.test.ts`, `artifacts/api-server/package.json`, `lib/db/src/schema/adventure.ts`, `lib/db/migrations/manual/20261021_campaign_timestamp_bigint.sql`, `docs/campaign-save-recovery.md`, `docs/feature-status.md`, `docs/migrations.md`.
- Cache selection now compares `clientSavedAt` after database reads and retains a newer fallback. Older save attempts cannot downgrade cached state; database writes remain unchanged.
- Required schema correction: widen `client_saved_at` from integer to bigint with Drizzle number mapping. The existing client sends `Date.now()` values, which exceed PostgreSQL integer range. Existing values and JSON numeric fields remain compatible. This narrow database change is necessary for the same snapshot-persistence boundary; no gameplay or orchestration authority is moved.
- Explicit operator migration and rollback procedure are documented in `docs/campaign-save-recovery.md`. No connected database was migrated. Keep bigint on application rollback to preserve valid timestamp data.
- Six store/schema tests cover outage/read races, old/new ordering, clone isolation and millisecond type mapping; four fail on baseline and all six pass on the patch.
- Deferred: durable fallback queue/retry, multi-worker conflict control, equal timestamp policy, deletion recovery and client-visible durability status.


## 2026-10-21 Audit Remediation Slice 3: Transactional Campaign Checkpoints

- Files: `artifacts/api-server/src/lib/commitCampaignCheckpoint.ts` and its tests (new), `src/lib/testing/checkpointDatabase.ts` (test double), `src/lib/aiIdempotencyStore.ts`, `src/lib/campaignContinuationStore.ts`, `src/routes/adventure.ts`, `src/routes/adventure.handoff-route.test.ts`, API package script, persistence/status/migration docs and engineering cautions.
- Added optional transaction executors to existing idempotency helpers and the existing database snapshot writer. Transaction-scoped errors fail closed; default AI helper behavior is retained. Checkpoint POST uses these existing primitives in one transaction; response emission happens only after commit.
- A rollback removes the new receipt and snapshot together. Lost commit acknowledgments replay the completed receipt. Persistence failures produce 503 with a retry message; the existing client already displays that message. No new client UI or database schema is introduced in this slice.
- Prerequisite: prior bigint timestamp migration and both existing snapshot/idempotency tables. This PR is stacked on the campaign-save-recovery branch. No connected database was modified.
- Validation: 80 focused tests pass; direct route invocation verifies rollback, retry and replay without sockets. A regression fails against the original route. API typecheck passes. Database boundaries are mocked; live PostgreSQL/HTTP integration and restart acceptance remain pending. Existing client type errors still block workspace baseline.
- Rollback: revert this slice while leaving bigint storage intact, noting that reverting restores unsafe memory-only save acknowledgments. Preserve the original checkpoint/replay tables and records.
- Deferred: cross-writer version checks, security/role authority, quotas, offline queue and legacy in-progress receipt recovery.


## 2026-10-21 Audit Remediation Slice 4: Campaign Checkpoint Compare-and-Swap

- Server files: campaign snapshot store and checkpoint transaction coordinator, adventure request/response handling, transactional test fixture and commit tests. Client files: session screen, continuation API adapter, focused API test and package command. Documentation: save/recovery guide, status, migration log and engineering caution.
- Request contract adds optional nullable `expectedSubmissionId`; missing/null means create-only, and a string conditionally replaces a matching server checkpoint. Update uses session ID plus token in one SQL predicate; missing rows cannot be recreated by stale updates. Conflict rolls back the receipt transaction. Replays remain replay-only.
- Existing server submission field now gets UUID-based identifiers. GET is durable-only because a cached client-clock-ordered snapshot cannot be a trustworthy compare-and-swap base. Failures return 503 instead of cached version data. No database schema change.
- Client and server must deploy together: older clients can create but cannot update existing checkpoints. Client preserves local work on 409 and requires reopening/review before retry; it does not adopt another writer's token automatically. This narrowly crosses the API/client contract boundary because otherwise updated sessions could no longer save after their first checkpoint.
- Validation: 87 server tests plus 3 client API tests pass. Five tests fail on prior conflict/ID logic. API typecheck passes. Client typecheck still has existing icon and Playwright Node-type errors. Mocked database tests do not establish real PostgreSQL lock behavior; full UI/two-device acceptance remains pending.
- Rollback: revert this client/server slice together; no schema rollback needed. Preserve earlier bigint and transactional save prerequisites. Removing this slice reopens lost-update risk.
- Deferred: authentication/DM permissions, automatic merge/offline queue, party transactional persistence, AI usage controls and workspace baseline errors.


## 2026-10-22 Validation Baseline Repair

- Files: client session screen (supported glyph only), client package scripts/dev dependency, client app/tooling TypeScript configs, combat safety test filename, lockfile, baseline/status docs, persistence guide and engineering caution.
- Replaced unsupported Feather `sword` with `crosshair`. Playwright config files are excluded from the Expo compilation and checked in an additional Node-aware TypeScript project; this avoids dropping their validation.
- Lockfile correction aligns the catalog/shared API client with already-locked React Query 5.100.10 instead of an incompatible catalog entry at 5.99.0. Added already-locked Node type dependency for tooling. All package records and transitive snapshots remain unchanged.
- Renamed combat safety `.mts` to `.cts` because this package is CommonJS. Test bytes/assertions are unchanged; the standard safety script invokes Node with the tsx loader directly. Other package references to this file were updated; historical migration entries retain their historical paths.
- Verified frozen install, root validation/combat baseline (workspace typecheck plus 24 tests), 90 focused API tests and 3 client API tests. No database schema, save-data or gameplay changes. Full browser/live PostgreSQL/Windows QA remains pending.
- Rollback: revert these files and rename the test back with its package scripts; that restores the prior validation blockers. No database rollback is involved.

## 2026-10-22 Party Disband Host Capability

- Added nullable `party_sessions.host_token_hash` and manual `20261022_party_host_token.sql`; existing rows stay null. Apply before the updated API because Drizzle reads include the new column. No connected database was migrated.
- Party creation issues a cryptographically random capability once, saves only its hash, and disables response caching. Disband rejects missing/wrong capabilities before deletions, including legacy sessions. No invite-code claim or role-flag bypass.
- Matching client stores the capability separately before creation succeeds and sends it on disband; all creation entry points already share this adapter. UI reports failures without disconnecting. Client/schema/API changes are jointly necessary for durable host proof; no gameplay authority moves.
- Rollout, limitations and rollback: `docs/party-host-permissions.md`. Keep the nullable column on rollback; reverting server code restores the old authorization hole. Existing party play remains supported, but legacy disband and old clients' disband are intentionally refused.
- Deferred: remaining party/DM authorization, campaign/AI access controls, recovery/device transfer and transactional deletion. Live database/browser/restart acceptance remains pending.
- Validation: workspace typecheck and 24 combat safety tests pass; 34 focused server tests (including 8 host tests) and 4 client host tests pass. The host route suite fails against the prior route implementation. Database and HTTP boundaries remain mocked. This run disabled pnpm dependency auto-install during scripts after the new worktree install stopped at an esbuild build-approval prompt; dependency policy files are unchanged.

## 2026-10-22 Party Member Ownership

- Added nullable `party_members.member_token_hash` with operator-run `20261022_party_member_token.sql`. Apply after the host-column migration and before the updated API. Existing rows remain unclaimed; no connected database was modified.
- New member enrollment issues UUID identity and a random token, stores its hash and ignores supplied IDs. Direct sync checks member proof before runtime/freshness work and updates only existing rows; leave accepts that member or original host. Public member projection and insert validation exclude hash metadata.
- API, client adapter, PartyContext, host-removal UI and demo seeding change together because server-issued proof must survive reload and all existing member writers must enroll. Gameplay resolution authority is unchanged. Legacy clients cannot sync/leave; legacy sessions require rejoining with new IDs. Existing encounter references are not reassigned. Prefer a new party at cutover.
- Client sends Authorization while preserving the JSON content type in the shared request wrapper. Revoked proof stops sync and is removed; transient failures retain it. Local leave still disconnects during network failures without guaranteeing remote deletion.
- Rollout/rollback: `docs/party-member-permissions.md`. Roll back API and client together, retaining nullable columns; reverting API restores the old unauthenticated write paths. Remaining party/DM actions, recovery, enrollment replay receipts and transactional member/runtime serialization remain deferred.
- Validation: workspace typecheck, 24 combat safety tests, 56 focused server tests and 12 client capability tests pass. Member regressions fail against the preceding routes. OpenAPI source parses and records bearer requirements; these paths use the hand-written client, with generated bindings left unchanged. PostgreSQL, HTTP, demo/browser and restart QA remain pending.

## 2026-10-22 DM History and Rollback Planning

- Added `docs/dm-history-and-rollback-spec.md` and linked it from the convergence plan, app map and status board. Covers durable per-command snapshots/events, coherent checkpoints and reviewed reversal across game domains.
- Documentation only: no schema migration, persistence change, runtime authority move or new undo button. Implement transactional history with the Phase 2 coordinator after audit fixes; inventory all manual/legacy writers before claiming coverage. Added `docs/audits/undo-snapshot-audit.md`, source inventory/probe evidence, and two read-only audit scripts. Three isolated probes characterize current unsafe undo behavior; no application regression suite or live storage checks were rerun. Rollback this change by reverting the audit/documentation commit.

## 2026-10-22 Local Undo Safety Containment

- Client-only H0a: removed partial snapshot restoration from MutationHistory and return `UndoUnavailable` without writes; preserved legacy records/markers. Quick Update/Log display the limitation, keep diagnostic records before loot handoff and label pending item review. Fixed newest-record ordering.
- Optional display-only `recordingStage` is additive. No database, authority or saved-character schema migration. Missing stage remains compatible. All existing MutationHistory undo is intentionally unavailable; separate spell/action refund flows are unchanged and unaudited by this slice.
- Six focused tests and three provider probes verify refusal without mutation; old provider fails the regression. Workspace typecheck and 24 combat safety tests pass. Updated probe writes new containment evidence, preserving the original baseline audit output.
- H0 is not complete: exact capture, lifecycle side effects, after-state/revision/dependency proof and transactional history are still required before safe undo can return. Scope/rollback: `docs/local-undo-containment.md`. Reverting restores the unsafe behavior; no data rollback is necessary.

## 2026-10-22 Snapshot Limited-Use Effect Maps

- Added optional `spellEffectUses` and `itemActionUses` to CharacterSnapshot. Remaining uses are nonnegative safe integers; zero is retained, missing legacy fields become empty maps, and present invalid values fail validation. No database migration, version bump, dependency or automatic stored-data rewrite.
- CharacterContext normal/reorder saves and load now preserve these maps. Shared snapshot normalization/import/export and Edit Character use the same validation; paste import delegates to the existing shared adapter. This is one client snapshot boundary, with no gameplay resolution or server authority move.
- Sixteen new codec/provider tests plus undo/compatibility/combat checks pass; fourteen initial regressions fail against previous code. Mocked React/persistence tests do not establish browser/disk behavior. Full checkpoints, autosave, concentration/reaction state, transactional history and usable undo remain deferred.
- Rollback the client contract/context/adapter/UI slice together; older code drops or resets the new counts. No database rollback. Details: `docs/snapshot-effect-usage.md`.

## 2026-10-22 Item Creation Audit

- Added `docs/audits/item-creation-api-audit.md`, API/client probe evidence and two reproducible audit scripts. Covers API/consumer validation, incompatible merges, dropped mechanics/metadata, misleading review/provenance, idempotency, persistence and reliability.
- No application code, dependency manifest, schema migration or authority change. Eleven actual API-boundary and four client-boundary probes characterize existing gaps; sixteen existing API contract tests pass. Live AI/storage/browser acceptance remains pending.
- Implementation gates are recorded in the audit. Rollback by reverting this audit-only commit; no data rollback required.


## Item reliability: client preservation and variant safety (2026-10-22)

- DM Item Creator now saves equipped/consumption effects, canonical mechanics and weapon fields to DM notes. Notes normalization and notes-modal edits preserve these additive fields; save failures are visible. Existing prose-only records cannot recover previously discarded mechanics.
- Proposal review uses the existing inventory stack identity; different categories, mechanics, stats, metadata and provenance stay separate. Inventory gains normalize before comparing against unequipped compatible stacks and retain weight/subtype/ability-modifier settings. Invalid integer counts and ambiguous name-only removals are skipped with status feedback. Signed removals remain supported when unambiguous.
- Client boundary only; no DB migration or new combat execution. Conservative identity may produce additional rows when metadata differs. Duplicate acceptance receipts, DM party generation/delivery adapters, API validation and reflection review remain separate follow-ups. No usable undo is enabled.
- Validation: actual storage/provider verification script `node --import tsx scripts/audits/verify-item-preservation.cjs` mocks React and AsyncStorage; three updated review tests (byte-identical temporary .cts copy for CommonJS compatibility). Workspace typecheck and combat baseline run separately. No device/browser or live storage acceptance tested. Historical item audit probes remain unchanged as baseline evidence.


## Item reliability: API creation validation and review containment (2026-10-22)

- Creation proposals now require nonempty names, positive safe-integer counts, finite nonnegative value/weight and bounded dice (1–100 dice, 2–1000 sides, optional integer modifier). Supplied invalid effects/counts/damage types fail normalization; malformed or missing loot lists cannot masquerade as successful empty loot. Creation limits: 100 items, 200 entries per nested array, 24 levels. Signed quick-update removals keep their separate compatibility contract.
- Same-name items only combine when their normalized identity metadata agrees; effects use semantic identity without generated IDs. Quantities remain summed within one API response; overlapping-photo client review retains its existing max policy. Differing notes/tags/provenance can deliberately produce separate rows. Overflow rejects the result. Value/weight/subtype and legacy attack/action bonus fields are preserved.
- Malformed mechanics envelopes/definition shapes are quarantined as an empty unsupported block with bounded raw review evidence. Model-provided verified status is downgraded, including admitted definition-level reviews. Structural checks are partial, not a full shared discriminated schema or proof of runtime support. Reflection/immunity/resistance claims require review even alongside a recognized stat bonus, including quick-update inventory proposals. Reflection execution remains unimplemented.
- Validation: 44 API tests (28 new validation/route tests plus 16 contract/idempotency tests), API typecheck, workspace typecheck and 24 combat safety tests pass. Model SDK transport is mocked and network forbidden in route regression; no live AI, database, browser or device acceptance. No dependency or DB migration. Historical audit probes remain baseline evidence. DM party draft/delivery preservation, duplicate acceptance receipts, full canonical schema/capability checking, AI request limits/auth and description generation remain open.


## Item reliability: DM loot draft and delivery preservation (2026-10-22)

- DM party generation now adapts validated proposal envelopes into the existing full `inventoryItem` assignment snapshot instead of clearing effects, mechanics, weapon stats, weight and subtype. Draft reconstruction retains supplied fields and preserves canonical-only data without inventing legacy weapon defaults. Zero values and false proficiency/ability-modifier settings survive. Manual weapon edits now travel as actual combat fields rather than prose alone.
- Both selected-player and per-player assignments send the same adapter output. Snapshot name/count/category/value/notes/images agree with the transport fields; legacy currency/component/junk categories map to supported inventory categories. Map image replacement/removal and portable URI checks are retained. The existing player snapshot claim path/addItem receives the data without a server contract change. Snapshot claims create inventory rows through addItem, as existing full-item transfers do; this is not a new auto-stacking policy.
- Flagged/low-confidence items and unverified canonical blocks require explicit DM review acknowledgement before assigning. Effects and descriptions are shown; acknowledgement is draft-local, resets on content edits, does not promote verified status and retains a warning in delivered notes. Category/weapon controls linked to existing structured effects are read-only; the adapter also rejects conflicting programmatic edits. Metadata/count/target edits remain supported. General canonical effect editing is deferred.
- Client orchestration boundary only. No server authorization, database schema, claim receipt, combat execution or undo change. Existing server assignment route passes full snapshots through; it does not deeply validate them or establish exactly-once inventory commits. Lost-response/claim-before-local-save recovery and durable acceptance receipts remain open. API description URL/stale-response fixes and complete shared schemas remain audit follow-ups.
- Validation: 11 new draft/serialization tests, 5 existing transfer tests (temporary byte-identical .cts copy), 44 API contract/validation/idempotency tests, storage/provider verification scripts, workspace typecheck and 24 combat safety tests. The delivery provider probe exercises proposal→draft→JSON→actual addItem with mocked React; it does not run server/DB/browser/device claim acceptance. No live AI calls. Revert this client slice together to roll back; already delivered snapshots retain their existing wire format, while older DM code strips rich data again.


## 2026-10-22 Implementation log and scope reconciliation

- Added `docs/implementation-log.md` and the original audit reconstruction. Backfilled PRs #1–#15 separately from U01–U17/I01–I20, retained the unresolved original-count provenance, and distinguished containment, partial fixes and pending rollout.
- Linked log from app map/status/agent entry points. Corrected the historical resource-undo summary to show current MutationHistory containment rather than claim usable rollback.
- No schema/data migration, dependency or application behavior change. Operator reports of table setup remain distinct from unverified host/member column rollout and live save/restart acceptance. Coverage, links and whitespace checked; workspace typecheck and the unchanged 24-test combat baseline rerun. Full historical suites were not rerun for this documentation change; their results remain attributed to their PRs. Revert this documentation/process slice to roll back the log, without changing game state.


## 2026-10-22 O02-A1: DM note-authoring authorization

- Returned to original finding O02. Mapped all 33 party handlers; protected only DM note assignment creation in this bounded pass. Loot assignment creation also serves player transfers and is deliberately unchanged. O02 remains partial; O05 and recipient/other mutation/read gaps remain open.
- Server checks the persisted original-host capability before session activity updates, expired cleanup, member reads or runtime hydration. Body DM flags/tokens are not proof. Origin is stamped DM by the server. Client uses the existing stored host token and retains it on failures. Existing DM error UI reports denial.
- No new database migration; prior host column and matching client/API required. Old clients, legacy unclaimed parties and watching devices without host proof fail closed for note creation. OpenAPI documents bearer proof; current hand-written client is updated, generic/generated schema convergence remains deferred.
- Eleven new route tests plus three new host-client tests; 87 focused server/client tests and 24 combat tests pass with workspace typecheck and frozen install. Nine route tests fail against the old source, including eight denial cases. DB/storage/HTTP boundaries are mocked; no live PostgreSQL/browser/mobile acceptance. Route map, rollback limits and exact pass files are linked from the implementation log.


## 2026-10-22 O02-A2: note recipient authorization

- Accept/decline require live exact-party/member capability proof before activity/expiry/runtime work. Host substitution and caller IDs/flags are not credentials; existing target and transition checks remain. O02 is still partial: map now has six proof-gated handlers and 22 open mutation handlers.
- Matching hand-written client uses persisted member proof, merges JSON headers and returns the typed response. Credentials survive transport errors and are removed on explicit member-access rejection. No UI screen or automatic retry changed.
- No new migration; existing host/member columns and matching API/client required. Legacy players rejoin; old clients fail closed. Server acknowledgement/local journal saving remains nontransactional, with public read and concurrency gaps still open. See permission map and implementation-log pass record for validation and files.
