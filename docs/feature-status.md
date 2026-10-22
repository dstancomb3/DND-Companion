# Feature Status: Character Companion (Post Phase 8 Reconciliation)

This is the canonical status board for the current codebase.
It separates what is finished, partial, intentionally limited, and still deferred.

## Finished

- Workspace validation baseline:
  - Root typecheck passes with pnpm run typecheck.
  - Combat safety validation command exists and runs from root script.
- Adventure / AI DM foundation and bounded one-off shell:
  - Adventure is now a first-class landing entry with a dedicated route shell under `app/adventure/`.
  - Adventure Home, New Adventure, Saved Sessions, and active-session one-off shell routes exist and are wired for bounded local runtime behavior.
  - Shared AI DM contract files exist for session state, runtime snapshot summaries, style config, journal structures, and confirmation-policy semantics.
  - Bounded session-awareness context now persists active-session metadata locally and powers reusable strip UI (`AI DM Active`, `Return to Session`, `End Session`) on key supporting screens (Sheet, Quick Update, Party, Landing, Adventure Home).
- Combat authority hardening:
  - Explicit target authority metadata in combat resolution outputs.
  - Local apply path is double-gated for applied_local authority.
- Progression and rules rollout (Phase 6):
  - Deterministic multiclass guardrails.
  - Resource/action unlock derivation in progression flow.
  - Homebrew registry validation hardening.
  - Defense/immunity editing and portability support in character flows.
- State/sync/mutation hardening (Phase 7):
  - Resource undo roundtrip implemented.
  - AI queue idempotency key + dedupe behavior implemented.
  - Party sync stale snapshot rejection implemented (stale_member_snapshot).
  - Condition immunities included in party sync/runtime paths.
- Deferred-item implementation pass:
  - Server-side AI idempotency storage and replay handling implemented for parse-update, analyze-loot, and parse-quest-update.
  - Server-side remote combat outcome apply endpoint implemented for preview-only remote member/NPC targets.
- Corrective hardening checkpoint:
  - Remote apply path now enforces fail-closed source-member and turn-ownership proof checks before applying outcomes.
  - AI idempotency route handling now degrades safely when persistence infrastructure is unavailable while preserving replay/conflict/in-progress semantics.
  - Focused api-server route-level safety tests were added for remote apply and AI idempotency behavior.
- Combat authority expansion (bounded C5):
  - Remote apply path now supports bounded preview-only condition apply/remove consequences in addition to HP/tempHP damage where authority reason and target type can be proven.
  - Route validation remains fail-closed and only accepts supported condition statuses (`applied` / `removed`) with compatible effect types.
- Combat clarity hardening (bounded C2.1):
  - Remote apply now accepts bounded preview-only healing deltas for existing member/NPC targets with HP-cap clamping, parallel to current damage consequences.
  - Combat UI now surfaces explicit remote-apply failure warning state instead of debug-only failure notes.
  - Party combat actor switching now warns before context changes when any turn economy has already been spent.
  - Remote condition durations remain explicitly manual/DM-resolved in current party combat UX.
  - Party economy spend path now supports bounded extra action/bonus-action slots (up to 2 total) so client resolver totals and server spend-state remain aligned in supported extra-slot scenarios.
- Combat depth expansion (bounded C3 – Condition Engine):
  - Additive structured condition-effect declaration added for a bounded explicit spell set (`buildSpellDeclaredPayload`).
  - Per-target condition resolution outcomes returned from combat resolution and applied through existing `ActiveCondition` lifecycle state where local authority permits.
  - Movement blocked by speed-zero conditions (`movement_blocked_by_condition` reject code) without new rule engine.
  - Concentration-linked condition cleanup aligned with concentration expiry.
  - Persistent action-feedback banner (success/error) added to combat UI replacing transient-alert-only outcome reporting.
  - Unsupported or ambiguous condition choices degrade to explicit limitation text; remote condition apply remains preview-only where mutation authority is unavailable.
- Product/performance parked tracks (Phase 8):
  - Monster compendium stale-cache-first and in-flight refresh semantics made explicit.
  - DM Monsters surface shows cache status and supports explicit refresh.
- Notes world graph / locations:
  - Locations support explicit parent-child containment via `parentLocationId` with cycle-safe normalization for legacy flat payloads.
  - Notes and DM Notes location surfaces render nested ordering and support parent assignment during create/edit.
  - Parser/apply supports explicit location containment relationships (`contained_in` / `contains_location`) and routes them into location authority.
  - Quest-location links support explicit per-location inheritance mode (`direct_only` vs `inherit_to_descendants`) with effective direct/inherited rendering on Notes and DM Notes location surfaces.
  - Focused hierarchy tests cover parent inference, cycle safety, and breadcrumb/tree ordering.
- Combat reaction automation (bounded C4):
  - Structured declared reaction metadata now exists for a bounded safe set (`opportunity_attack`, `shield`, `counterspell`, `readied_action`).
  - Resolver now validates reaction window id, expiry, trigger compatibility, and declared-reaction compatibility where pending-window context can prove mismatch.
  - Reaction feedback now explicitly reports reaction used, trigger context, and resolved vs partially resolved outcomes in shared summaries.
- Equipment and weapon integrity:
  - Canonical slot-based equip legality now normalizes impossible simultaneous hand states (two-handed, one-handed, shield combinations) in runtime inventory authority paths.
  - Generated weapon attack profiles now derive to-hit and damage modifiers from current ability/proficiency runtime state plus explicit item damage bonus, reducing stale static-modifier drift.
  - Focused tests now cover slot legality normalization and weapon attack profile scaling math.
- Character creation gear groundwork:
  - Shared creation-gear foundation now exists for class-based starting wealth rules, official-item draft generation, and additive background/race auto-gear mapping where current support is explicit.
  - Character creation now seeds safe auto-granted background gear into initial snapshot inventory where the mapping is already encoded.
  - DM NPC storage now preserves an additive inventory field with legacy-safe read normalization, preparing later DM gear-picker UI without changing current NPC editor flow.
- Character creation gear complete support + UI step:
  - Starting-gear support now covers all classes and backgrounds used in create-character, including class strict packages, class-based free-choice budgets, and curated presets.
  - Create Character wizard now includes a dedicated Starting Gear step with mode selection (`strict`, `preset`, `free`) and class-budget constrained free-item selection.
  - Final review now surfaces resolved starting gear mode, selected items, and resulting starting currency from the loadout builder.
- Party member visibility and item handoff UX:
  - Party member cards now support full-card tap navigation to member-sheet details (not only name-link taps), with shared route helpers and fallback handling.
  - Party members can now send eligible unequipped inventory items directly to another live member using the existing party loot-assignment channel, with local sender inventory decrement/removal on success.
  - Loot assignment event text now reflects DM vs player-originated sends to avoid misleading session history messaging.

## Partially Complete

- Adventure / AI DM one-off runtime (Phase 1, Slice 1+2 — Live AI Input):
  - One-off session entry (new.tsx) now includes a session-type selector (Campaign vs One-Off) with persistent UI state.
  - One-off session entry now shows a `startInCombat` toggle when One-Off mode is selected.
  - One-off session entry now generates a stable one-off sessionId and navigates to the session route with `mode: "one_off"` and optional `startInCombat` intent.
  - One-off session runtime now calls `handleCampaignRuntimeTurn()` for player input (live AI call) instead of stub execution.
  - One-off session runtime now unconditionally builds inventory, hostile actors, and known actor context summaries for the AI prompt (removed `isCampaignScaffold` ternary guards).
  - One-off feed opening now renders a narrative scene opener paragraph instead of echoing raw setup/context guidance text.
  - One-off new-session bootstrap now force-resets stale party combat state and suppresses snapshot visibility until player conversation starts, preventing prior-encounter carry-over on fresh sessions.
  - During active one-off encounters, session UI now surfaces reusable combat cards (attacks, action/bonus-action cards, consumables) plus resource cards directly in the session route.
  - Slice 3+ (quick actions, post-turn processing, session completion) remain deferred.
- Combat runtime:
  - Local authority path is stronger and safer.
  - Remote preview outcomes can now be applied through a server authority endpoint with fail-closed actor/turn guards for bounded damage and condition consequences, but full runtime centralization remains partial.
  - Companion combat integration now has a projection-only Phase 1 path (companions map into existing combat NPC entries with additive metadata), while companion-specific authority/turn semantics remain intentionally deferred.
  - Companion Phase 2 now adds owner-visible labels and a bounded acting-as interaction layer that routes through existing player turn economy; companions still do not have independent turn authority.
- Quest graph system:
  - Parsing and deferred-review workflows are implemented.
  - Some operation types remain intentionally deferred to manual review paths.
- Adventure / AI DM one-off runtime (Phase 1, bounded):
  - One-off setup now includes title, optional guidance, style/difficulty, and start-in-combat intent.
  - Active one-off session route now supports deterministic feed seeding, player input ack flow, quick-action tool bridge wiring, combat submode panel hooks, outcome-shell state for loot/encounter closure, deterministic recap/handoff payload scaffolding after encounter closure, and a local approval gate before deferred handoff apply actions.
  - Approved handoff payloads can now be saved locally with a schema-versioned export shape and surfaced on the Adventure Saved Sessions route.
  - Campaign scaffold sessions now create and update a local resumable archive entry, including current feed entries and pending choices, and Saved Sessions can reopen that local campaign state.
  - Bounded Phase 2 bridge now exists: Saved Sessions can submit archived `oneoff-handoff.v1` payloads to a dedicated server ingest endpoint with idempotency-key handling and fail-closed payload validation.
  - Phase 10 production hardening pass completed for one-off diagnostics continuity: consistent filtered-empty action statuses, continuity-context detection guards, and resilient local preference fallback coverage.
  - Phase 11 campaign foundation now includes bounded campaign scaffold session entry, additive campaign route/session metadata contract fields, and deterministic campaign scaffold feed seed in the local session shell.
  - Phase 12 adds a bounded campaign scaffold ingest bridge (`campaign-scaffold.v1`) with idempotency protections plus campaign session-shell submit UX/status path.
  - Phase 13 server slice (in progress) adds a bounded campaign continuation ingest bridge (`campaign-continuation.v1`) with endpoint-scoped idempotency replay/conflict/in-progress safety parity.
  - Phase 13 client slice (in progress) adds campaign session-shell continuation checkpoint submit UX/status path against the bounded continuation ingest bridge.
  - Phase 13 resume/read slice (in progress) adds a bounded campaign continuation snapshot read endpoint and campaign session-shell hydration/refresh status path.
  - Phase 13 live-turn slice (in progress) adds a bounded campaign runtime AI turn endpoint and campaign input wiring so campaign sessions can request live DM responses in-session.
  - Phase 27 server persistence slice now adds DB-backed campaign continuation snapshot persistence with in-memory fallback when the table or database is unavailable, preserving the existing continuation contract and read-back UX.
  - Phase 14 encounter-intent hardening (in progress) now adds deterministic encounter-intent key fallback normalization, active-battle reuse, duplicate hostile NPC spawn guards, and pending-resolution gating for narration-blocked encounter turns.
  - Phase 15 encounter-intent integration gating coverage (in progress) now adds focused integration-style runtime tests for party-missing/no-members paths, active-battle reuse, duplicate hostile-NPC skip, and initiative roll-request creation when narration is blocked.
  - Phase 16 encounter gate visibility (in progress) now adds deterministic pending-reason and required-roll progress instrumentation in campaign session UI plus focused gate-state tests for pending/blocked/cleared transitions.
  - Phase 17 completion-aware encounter gating (in progress) now evaluates required-roll resolution against live party combat-state responses so narration remains blocked until all targeted members answer required prompts, with explicit resolved/unresolved gate progress.
  - Phase 18 completion-matching robustness (in progress) now requires exact battle + target-set alignment for required-roll resolution, handles duplicate same-stat requests without false positives, and surfaces compact gate-health reasons when completion cannot yet be evaluated authoritatively.
  - Phase 19 stale-context recovery + timeout observability now adds bounded battle-context recomputation for stale encounter-gate references, stable gate-health reason codes, and compact 30s/90s active-gate timing instrumentation without introducing any auto-unblock behavior.
  - Phase 20 multi-battle deterministic selection + membership churn safety (in progress) now adds multi-battle candidate ranking with stable tie-breaks, membership-churn policy modes (`locked_targets` vs `live_targets`), bounded recovery recomputation for target-set changes, and metadata observability without altering fail-closed gate semantics.
  - Phase 21 confirmation-aware gate clear + narration unblock (in progress) now keeps `cleared` encounter gates active until explicit DM confirmation, adds compact refresh/confirm controls in the session gate card, and prevents implicit narration unblock when prompt completion first reaches 100%.
  - Phase 22 confirmation audit trail + safe reopen (in progress) now records explicit local confirmation metadata (`confirmedAtMs`, `confirmedBy`, `confirmationSource`) and fail-closed reopens gates when post-confirm combat updates reintroduce unresolved required prompts.
  - Phase 23 locked-target override acknowledge path (in progress) now adds an explicit local DM override action for locked-target missing/stale-member edge cases, with additive override audit metadata and mandatory reset on new encounter gate contexts.
  - Phase 24 override safety window + explicit revoke (in progress) now adds bounded override expiry, explicit revoke controls, and restore-to-fail-closed semantics when an override ages out or is revoked.
  - Phase 30 campaign adjudication roll bridge (in progress) now adds additive adjudication request metadata on campaign turn responses and session-side roll-request creation so uncertain lore/identification/perception outcomes can require explicit party checks.
  - Phase 31 compendium-backed encounter source bridge (in progress) now adds additive encounter source metadata (`hostileCreatureSourceType`/`hostileCreatureSourceId`) so combat NPC spawning and duplicate detection can prefer canonical monster identity over name-only matching.
  - Phase 32 canonical hostile-actor continuity bridge (in progress) now adds source-aware hostile actor identity capture and turn-context continuity hints (`CURRENT HOSTILE ACTORS`, `KNOWN ENCOUNTER ACTORS`) so narration can stay aligned with spawned combat actors across turns.
  - Phase 33 narrative consistency guardrails + validation coverage (in progress) now aligns encounter intent against canonical hostile actor context on the server (source-aware backfill by canonical identity) and adds focused route/runtime tests for canonical actor parsing, alignment, source-aware duplicate matching, and orchestration identity reporting.
  - Phase 29 awareness rollout (in progress) now adds local active-session persistence helpers plus reusable awareness-strip coverage and explicit `End Session` clear flow on key supporting screens and Adventure entry surfaces.
  - Current implementation remains local deterministic scaffolding and bounded existing API usage only; no persisted AI DM session runtime/orchestration has been introduced.
- DM NPC gear picker rollout (Phase 4, bounded):
  - DM NPC editor now includes a dedicated Gear tab wired to shared creation gear helpers for strict/preset loadout selection.
  - Selected DM gear loadouts now synchronize into NPC inventory state through existing additive inventory compatibility paths.
  - Free-choice picker controls are now implemented with item-level +/- quantity selection and live inventory synchronization.
  - Free-choice class budgets are now advisory-only in both create-character and DM NPC creation flows (not hard enforcement).
  - DM NPC editor now includes an optional Quest Tie-In tab while retaining the existing Secrets tab.
  - NPC creator now supports structured quest/people/location/plane linking via questTags, peopleTags, locationTags, and planeTags arrays (Task 5 complete).
  - Quest Tie-In tab now displays checkbox selectors for quests, people, locations, and planes from CharacterContext data arrays.
  - Custom checkbox UI with Feather icons provides theme-aware selection feedback.
  - Summary export text now shows linked count: "Linked to N quest(s)", "Linked to N person/people", etc.
  - Landing page NPC list updated to display quest/people/location/plane link counts.
  - Full backward compatibility maintained: legacy NPCs without tag fields normalize to empty arrays on load.
  - Gear randomization now supports load presets (`light`, `moderate`, `heavy`, `encumbered`) with estimated weight caps in free-choice mode.
  - Gear catalog now supports rarity metadata and max-rarity filtering (`Common` through `Artifact`) in DM NPC free-choice mode.
  - Randomized free-choice picks now honor active category, max-rarity, and load preset constraints.
  - Strict/preset randomization now supports package-plus-bonus loot: selected class package is retained and rarity-capped bonus items are appended based on load preset target.
  - Load preset randomization now scales loot volume (`light` sparse through `encumbered` high-volume) and max rarity now directly constrains random bonus item tiers.
- Schema convergence:
  - Ongoing between legacy/open5e formats and converged schemas/contracts.
- AI parse consistency hardening:
  - Phase 1 deterministic decode controls are now centralized for AI routes to reduce run-to-run response variability.
  - Phase 2 server repair/dedupe is partially implemented for loot normalization (duplicate item merge, semantic effect dedupe, and bounded notes-to-stat-bonus promotion).
  - Phase 2 now also includes additive review quality gates for contradictory mechanical-note claims and unresolved low-confidence mechanical claims.
  - Client apply hardening has started: quick-update now blocks auto-application of inventory changes flagged `needsReview` or low-confidence structured mechanics, with explicit review messaging.
  - Loot-review merge safety coverage now validates mixed-confidence dedupe behavior (confidence precedence, `needsReview` retention, and source-tag preference) in focused state tests.
  - Full mismatch policy rollout remains in-progress.

## Intentionally Limited (By Design Right Now)

- No broad CRDT/realtime collaboration architecture.
- No destructive migration pass removing all legacy compatibility fields.
- No broad rewrite of persistence architecture for AI replay acknowledgments.
- No live AI-driven DM orchestration runtime yet.
- No server-authoritative campaign orchestration runtime yet.
- No server-authoritative Adventure session orchestration or persistence yet (current awareness persistence is local-device only).
- No universal supporting-screen Adventure-awareness rollout yet; current coverage is intentionally bounded to key screens.

## Adventure / AI DM Phase 1 Bounded (What Exists vs. What Does Not)

- Implemented now:
  - Adventure information architecture and route/screen shells.
  - One-off setup and active-session bounded local runtime shell (deterministic feed, tool bridge, combat submode panel hooks, outcome shell state).
  - Shared AI DM contract/export surface for future slices.
  - Landing discoverability and uniform top-arrow Adventure subpage navigation.
  - Bounded local session-awareness persistence/helper surface with reusable strip integration on key supporting screens.
- Not implemented yet:
  - Live AI narration/orchestration engine and persistent session runtime.
  - Session creation/runtime persistence.
  - Universal session-awareness adoption across all supporting screens.
  - Broad tool execution/mutation application driven by a server-authoritative Adventure runtime.
- Trust boundary:
  - Current Adventure should be treated as bounded local one-off shell functionality plus scaffolding, not a full AI DM gameplay system.

## Truly Deferred / Future

- Production rollout for AI idempotency table provisioning in all environments (run db push migration).
- Full remote mutation authority completion beyond damage/temp-hp apply (broader effect types and reconciliation paths).
- Remaining schema/data convergence cleanup where legacy formats are still required.
- Any larger product/performance initiatives outside the targeted Phases 1-8 scope.

## Trustworthy Final Backlog (Short)

1. Roll out DB schema change for `ai_idempotency_records` in deployed environments.
2. Complete combat remote-authority apply model beyond current HP/tempHP remote outcome path.
3. Continue schema convergence cutover with explicit migration notes and compatibility checks.

## Recommended Validation Commands

- pnpm run typecheck
- pnpm run validate:combat-baseline
- Focused api-server route safety tests:
  - pnpm --filter @workspace/api-server exec tsx --test src/routes/party.remote-apply-route.test.ts
  - pnpm --filter @workspace/api-server exec tsx --test src/routes/ai/idempotency-route-safety.test.ts
- Focused state/cache tests:
  - pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/mutation-sync-hardening.test.mts
  - pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/monster-cache-plan.test.mts
- Focused api-server idempotency test:
  - pnpm --filter @workspace/api-server exec tsx --test src/lib/aiIdempotencyStore.test.ts

## 2026-10-21 Audit Remediation: Party Data Safety

- Member sync now evaluates stale timestamps, timestamp collisions, and replay decisions before writing member records or activity timestamps. Rejected snapshots no longer overwrite HP, temporary HP, AC, or conditions.
- Party member deduplication uses stable member IDs. Separate IDs with identical names/classes/combat stats retain separate roster entries and runtime state. Existing duplicate registrations under different IDs remain visible; identity reconciliation requires an explicit workflow.
- Three new regression tests cover route-level no-write rejection and preservation of separate member combat state. These and the existing sync/remote-apply tests pass (27 tests); all three new tests fail against the original implementation. Added sync tests to the API test script.
- API typecheck passes. Workspace typecheck remains blocked by existing client Feather icon and Playwright Node-type errors. A frozen install fails because the existing client manifest and lockfile disagree. Database integration tests require a running PostgreSQL instance, which was unavailable here.
- This slice does not make member and runtime writes transactional or solve simultaneous-request races. Party authentication/DM permissions, AI usage controls, and campaign fallback recovery remain outstanding audit items.

## 2026-10-21 Audit Remediation: Campaign Snapshot Persistence

- Campaign snapshot reads preserve a newer in-process fallback instead of replacing it with older durable data after an outage or an in-flight read. Older incoming saves no longer downgrade the cache.
- `campaign_continuation_snapshots.client_saved_at` is now declared as PostgreSQL bigint in numeric Drizzle mode, allowing the client's epoch-millisecond timestamps without a JSON contract change. Existing databases require the explicit widening migration before this schema correction is effective.
- Rollout, rollback and limitations: [Campaign save recovery](campaign-save-recovery.md). Six focused store/schema tests were added; four fail against baseline and all six pass after the patch.
- Remaining: memory fallback is still process-local and non-durable, there is no automatic flush, database writes still need version/conflict controls, and clock-skew/equal-timestamp conflict policy remains deferred. This is not full campaign continuity or runtime orchestration.


## 2026-10-21 Audit Remediation: Durable Checkpoint Acknowledgment

- Campaign checkpoint POST now commits the snapshot and keyed replay receipt in one transaction before returning 200. On persistence failure it returns retryable 503; it no longer accepts a memory-only fallback as a successful checkpoint. Existing client submission error handling displays the returned message.
- Same-key retries remain possible after rollback; a committed receipt handles acknowledgment loss without rewriting the snapshot. Keyed requests require the idempotency table. Other AI routes keep their existing best-effort behavior.
- API typecheck and 80 focused mocked-boundary/contract tests pass. The route regression fails against the original route (200 instead of 503). Live PostgreSQL, restart, and multi-worker integration testing remain required. Existing client typecheck blockers remain unchanged.
- Remaining: stale competing snapshot writes, authenticated ownership/DM authority, AI quotas, and rollout of the required database schema. This does not implement a durable client outbox or full campaign runtime.


## 2026-10-21 Audit Remediation: Checkpoint Conflict Protection

- Campaign checkpoint HTTP writes now compare the expected prior server submission ID atomically at the database boundary. Missing/null expected token is create-only; stale or deleted versions return 409 without a new receipt or snapshot. Client clock skew does not grant write priority.
- Server IDs now include UUIDs to avoid same-millisecond version collisions. Version-token reads require the database and return 503 on failure.
- Session client retains a session-scoped base token, includes it on submit, updates it from its own save response, and preserves local work on conflict. No silent token refresh/retry or automatic merge. Older clients cannot overwrite existing checkpoints without adopting the new contract.
- 87 focused server tests and 3 client API tests pass. Five new conflict/ID regressions fail on the preceding implementation. API typecheck passes; the same existing client errors still prevent a green workspace baseline. Full React UI, PostgreSQL locking, and two-device QA remain pending.
- No new schema migration. Authorization/DM roles, AI quotas, party write atomicity and green-baseline repair remain audit work; this is not the planned new combat engine.
