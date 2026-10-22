# DND Companion: AI DM + Deterministic Combat Convergence Plan

**Status:** Proposed implementation plan, not a completion claim  
**Repository:** `dstancomb3/DND-Companion`  
**Baseline:** `main`, commit `03a9153cf7a02e50669051a7fa820c9e597e26a6` (inspected 2026-10-21)  
**Suggested repo location:** `docs/ai-dm-combat-convergence-plan.md`  
**Change policy:** Read-only plan. No source modifications are authorized by this document alone.

## 1. Executive decision

**Do not rewrite the application.** Preserve existing character sheets, DM tools, party join/sync, loot generation and review, notes/quest/location systems, combat UI, typed mechanics, and existing server safety controls. Build a shared, deterministic action-and-effects runtime behind existing screens and bridge the AI DM into that runtime through validated tool commands. Deliver it in reversible vertical slices, each with end-to-end acceptance tests.

**Order of work:** (0) baseline and safety; (1) stuck-roll/session reliability; (2) authoritative session turn orchestration; (3) combat execution and multiplayer convergence; (4) effect triggers and advanced interactions; (5) world-state and campaign continuity; (6) usability and production hardening. Do not postpone UI or tests until the end.

## 2. Evidence and limits

### Confirmed from repository inspection

- Client: `artifacts/living-character-sheet/`; server: `artifacts/api-server/`; shared API/database: `lib/`.
- Canonical docs: `docs/app-map.md`, `docs/feature-status.md`, `docs/combat-runtime.md`, `docs/mechanics-convergence.md`, `docs/adventure-dm-session-runtime-spec.md`, `docs/migrations.md`.
- Existing client combat: `context/CombatContext.tsx`, `utils/combat/resolveCombatAction.ts`, `utils/combat/applyDamagePacket.ts`, `utils/combat/resolveHitSaveDamage.ts`, `types/combatResolution.ts`, `types/combatOutcome.ts`, `types/combatReaction.ts`.
- Existing typed mechanics: `types/mechanics/effects.ts`, `rules/engine.ts`, `rules/registry.ts`, `rules/compiler.ts`, `utils/mechanics/`.
- Existing adventure: `app/adventure/session/[sessionId].tsx`, `utils/adventure/aiDmCampaignRuntimeApi.ts`, `utils/adventure/aiDmOneOffToolBridge.ts`, `utils/adventure/campaignEncounterRuntime.ts`, `components/adventure/session/`.
- Existing server routes: `src/routes/adventure.ts`, `src/routes/party.ts`, `src/routes/ai/index.ts`; persistence: `src/lib/campaignContinuationStore.ts`, `lib/db/src/schema/adventure.ts`.
- Current docs explicitly describe split client/server combat authority and partial campaign orchestration. The one-off tool bridge returns queued/descriptive results for some actions instead of independently committing authoritative changes.
- `applyDamagePacket.ts` processes typed damage, immunity, resistance, temporary HP and healing; it is not a generalized event-trigger/reflection engine.

### Not established by this audit

No full local install, typecheck, test suite, browser/mobile session, database migration, security penetration test, or reproducible roll-stall trace was run. The root docs may lag newer code; reconcile source and tests before changing status. All proposed file changes below require owner-level confirmation during implementation.

## 3. Product contract and non-negotiable behaviors

1. A player can operate through existing structured screens, natural language, or both. Neither is mandatory.
2. A human DM and an AI DM use the same canonical character and game state, with explicit permissions and session roles.
3. The AI DM narrates, improvises, maintains world intent, and proposes tool calls. It cannot directly invent authoritative HP, inventory, resources, roll outcomes, or rule effects in prose.
4. Mechanics, rolls, turn economy, effects, inventory mutations, and multiplayer consequences are validated, resolved and committed deterministically.
5. Player actions are open-ended. Suggested choices are optional and never limit freeform actions.
6. All required rolls appear as actionable prompts in the active session UI, with explicit pending/expired/completed states; narrative resumes only after the authoritative result.
7. During combat, attacks, spells, consumables, resources, targets, conditions and feedback are accessible within the session, without switching to the full character sheet.
8. Session continuity survives reload, retry, reconnection and device refresh without duplicate effects.
9. Canonical and custom loot share the same reviewed typed-effect pipeline. Unsupported mechanics remain visible and inert until explicitly reviewed, never silently approximated.
10. Optional future 'Show me' scene art is non-blocking and derives from persisted scene identity, not ad hoc re-description. It is not on the critical path of this plan.

## 4. Target architecture

```text
Player UI / Human DM UI / Natural-language player input
             |                 |
             +---- Intent / Command Adapter ----+
                                                |
AI DM narrative planner --> Proposed tool calls |
                                                v
                                    Command validation + authorization
                                                |
                                    Session orchestrator / state machine
                                                |
                     +--------------------------+-----------------------+
                     |                          |                       |
               Roll service               Combat/effects          World mutation
                     |                          |                       |
                     +--------------------------+-----------------------+
                                                |
                              Atomic authoritative commit + event log
                                                |
                               Versioned projections / subscriptions
                                                |
                        UI rendering + AI DM narration from results
```

**Authority rule:** one command has one authority owner. The client may present a preview but may not independently commit an outcome that the server owns. For offline/local sessions, use an explicitly designated local authority adapter with the same command/result contracts; do not silently switch authority mid-turn. A human DM override must be a logged, permission-checked command, not a direct state edit bypass.

### 4.1 Proposed shared contracts (additive)

- `GameCommand`: `commandId`, `idempotencyKey`, `sessionId`, `actorId`, `initiatorRole`, `expectedStateVersion`, `kind`, `payload`, `createdAt`.
- `CommandResult`: `status` (`accepted`, `rejected`, `needs_input`, `conflict`), `reasonCode`, `stateVersion`, `events`, `pendingPrompt`, `presentation`, `traceId`.
- `SessionState`: `sessionId`, `mode`, `authorityMode`, `phase`, `turnIndex`, `sceneId`, `encounterId?`, `pendingPromptIds`, `version`.
- `RollRequest`: stable `rollId`, actor/owner, dice formula, modifier provenance, DC/contest context if applicable, roll visibility, expiration/cancellation rules, and `stateVersion`.
- `GameEvent`: stable event ID, causation/correlation IDs, source/target, typed payload, ordering, resulting state version.
- `EffectSpec`: existing union retained and extended only with versioned trigger/condition/source semantics where tests prove a gap.
- `NarrativeTurn`: player intent, adjudication decision, command results, canonical scene updates, DM text, optional suggested choices, and checkpoint metadata.

**Contract location decision:** inspect existing `types/`, `lib/api-zod/`, `lib/api-spec/openapi.yaml`, and `lib/db/` first. Prefer one source of truth plus generated clients, not hand-maintained parallel TypeScript/Zod/OpenAPI definitions.

## 5. Session state machine and roll handshake

Suggested phases: `initializing -> awaiting_player -> interpreting -> awaiting_roll | awaiting_confirmation | resolving -> narrating -> awaiting_player`, with substate `combat_active` and terminal `completed` / recoverable `failed`. Persist phase and pending prompts before returning responses to the UI.

**Roll protocol:**

1. AI DM requests a mechanically meaningful check or combat engine requires a save/attack; server validates actor, rule and timing.
2. Server creates and persists one `RollRequest` with stable ID and expected state version, then returns `needs_input`.
3. Session UI renders an obvious roll card (stat, reason, actor, roll button, optional DM authority path); composer cannot imply completion while roll is pending.
4. Player submits `rollId` and command ID; authoritative roll service computes/verifies result according to declared trust policy and records it once.
5. Engine resolves consequence; state commits once; AI DM receives result and narrates. Refresh/retry rehydrates the same pending roll, never a duplicate.
6. Cancel/expire/DM override is explicit, permissioned and audit logged. Never use a silent timeout to fabricate a roll.

**Critical regression:** start a one-off session, prompt Perception, close/reopen, submit roll, receive narrated consequence, continue freely. Repeat with initiative and a saving throw, including two concurrent players and duplicate submissions.

## 6. Combat and effects semantics

### 6.1 Resolve pipeline

`validate command -> verify actor/turn/target -> reserve economy -> determine attack/save -> open reaction window(s) -> roll -> build typed damage/effect packets -> apply replacement/prevention/modifier effects -> apply HP/tempHP and conditions -> queue triggered effects -> resolve bounded trigger chain -> commit once -> publish result`.

Order is a **proposed processing architecture**, not an assertion of universal D&D 5e precedence. Implement actual 2014/2024 edition profiles explicitly, with rules citations/fixture references and clearly labeled homebrew extensions. In particular, reaction timing, simultaneous effects, rounding, critical dice, and resistance/vulnerability must be specified per supported ruleset.

### 6.2 Typed effect vocabulary

Reuse `types/mechanics/effects.ts` and the existing rules registry/compiler. Add only required primitives such as `on_damage_attempted`, `on_damage_applied`, `on_hit`, `on_save_failed`, `on_turn_start`, `on_turn_end`, and `on_condition_changed`, plus predicates for damage type, source, target tags, range, equipped/attuned state, charges, and owner. Each effect carries origin, version, activation conditions, priority/timing, stacking semantics and unsupported/review state.

**No combinatorial item-versus-monster matrix.** An item or feature declares general triggers and conditions; the engine resolves them against typed events.

### 6.3 Mandatory reflection fixture

A creature casts Fireball at a player wearing a custom item that grants fire immunity and reflects `1d8 fire` to the damage source when a qualifying fire-damage event occurs. Expected behavior:

- Resolve Fireball's area, targets and Dexterity saving throws per the selected edition; distinguish spell caster, spell effect, and actual damage source.
- Apply the item's fire immunity to the wearer's fire damage. Other targets resolve independently.
- Evaluate the custom reflection trigger against its **explicit authored semantics**: e.g. `on_fire_damage_attempted` versus `on_fire_damage_applied`. Immunity may eliminate applied damage; whether reflection still fires depends on the item definition, not AI intuition.
- If trigger matches, roll `1d8`, target the recorded source, and process that packet under normal fire defenses.
- Prevent unbounded reflection loops using origin-chain IDs, per-effect trigger caps and cycle detection; do not globally disable legitimate chained reactions.
- Return an explainable event trace showing each saving throw, immunity, reflection trigger, die roll, damage application and suppression decision.

**Additional fixtures:** mixed slashing/fire attack; target immune only to fire; resistance and vulnerability; temp HP; critical hits; damage type substitution; concentration save; reaction window expiry; conditions and durations; multiple targets; defeated source; extra actions; repeat command; stale state; local vs remote authority; save-on-half; advantage/disadvantage; unsupported effect review.

## 7. Phased implementation slices

### Phase 0: Reconcile baseline and protect working app

**P0.1 Repository inventory.** Read `AGENTS.md`, `.github/copilot-instructions.md`, canonical docs, current tests, relevant routes and contexts. Generate dependency map and a concrete owner table for every state mutation. Identify current edition/ruleset assumptions. **Deliverable:** `docs/runtime-authority-map.md`.

**P0.2 Establish green baseline.** Run root typecheck, combat baseline, API route tests, adventure smoke, and targeted tests. Record pass/fail, reproducible failures, and environment prerequisites; never relabel existing failures as regressions. **Deliverable:** `docs/runtime-baseline.md`.

**P0.3 Safety and rollback.** Create a feature branch (suggested `feat/runtime-convergence`), feature flags for new orchestrator/effects, schema migration/rollback notes, and test fixtures from real existing characters. No destructive migration or UI replacement. **Gate:** known baseline and a switchable fallback.

### Phase 1: Fix the playable one-off loop and stuck-roll failure

**P1.1 Trace the roll stall.** Instrument client/session/party API with a shared correlation ID, inspect `campaignEncounterRuntime.ts`, `partyApi.ts`, `app/adventure/session/[sessionId].tsx`, `AiDmSessionInputComposer.tsx`, roll request/response lifecycle and existing tests. Capture exact state transition where UI waits but no roll card appears.

**P1.2 Implement durable pending roll.** Introduce stable roll request IDs, persist prompt before awaiting player, render session roll cards, rehydrate on reopen, guard duplicates and stale replies, and present retry/recovery errors. Avoid introducing a separate competing dice authority.

**P1.3 Prove one-off start-to-finish.** Opening narration -> freeform action -> roll -> consequence -> optional choices -> encounter -> combat -> rewards/loot review -> closing recap -> saved session. Explicitly define what 'finish' means, including manual DM review and unsupported mechanics.

**Acceptance:** no invisible roll prompts; no narrative advancement before required result; no duplicate roll/application on retry; combat accessible in session; clean mobile UI; save/resume works. **Gate:** automated and manual one-off E2E pass.

### Phase 2: One authoritative session orchestrator

**P2.1 Define command/turn contracts.** Add Zod schemas and generated API contracts; use existing `POST /api/adventure/campaign-runtime/turn` as compatibility adapter until replacement is proven. Establish source-of-truth session version, authority mode and structured errors.

**P2.2 Build turn transaction coordinator.** Separate `interpret -> propose -> validate -> resolve -> commit -> narrate`. AI output is a proposal; only committed events can change character/party/world state. Handle multi-intent utterances atomically where possible, otherwise explicitly stage/confirm each step.

**P2.3 Tool bridge conversion.** Map existing `session.*`, `combat.*`, `outcome.*` operations to actual typed handlers. Replace misleading `status: applied` for queued-only operations with `pending`/`needs_input`/committed semantics. Add authorization, schema validation, idempotency and telemetry.

**P2.4 Recovery and concurrency.** Session-level optimistic concurrency, duplicate turn handling, crash recovery, resumable pending actions and deterministic replay. Separate model retry from game mutation retry.

**Acceptance:** AI DM cannot mutate state through text; each command has one commit or explicit rejection; two devices cannot double-apply; model failure after commit can regenerate narration from event log without rerolling.

### Phase 3: Combat authority convergence

**P3.1 Authority owner matrix.** Document each existing action path: `CombatContext.tsx`, `resolveCombatAction.ts`, `party.ts`, remote outcome apply, NPC and companion projections. Determine which runs local-only and which must be server-owned in multiplayer.

**P3.2 Shared resolution core.** Extract pure, deterministic mechanics from client utilities without rewriting algorithms prematurely. Explicitly inject dice/RNG, time and state snapshot; avoid `Date.now()`/unseeded randomness in the pure resolver. Keep UI adapters compatible.

**P3.3 Server commit adapter.** Extend bounded remote apply only after existing source-member/turn ownership proof and stale-state checks pass. Commit all supported HP/tempHP/conditions/resources/economy as one versioned operation; no cross-client optimistic double commit.

**P3.4 Session combat integration.** Reuse `AttackCard`, `ActionCard`, `ResourceRow`, target selectors and `AiDmCombatSubmodePanel`. Implement a responsive session combat tab/section, persistent target selection, readable outcomes, and return to narrative at the correct story beat.

**Acceptance:** identical command and snapshot produce identical results; local/remote paths agree; server rejects unauthorized actions; two clients converge after reload; no character-sheet hopping for core combat.

### Phase 4: Generalized effects and complex homebrew

**P4.1 Inventory effect audit.** Map `types/mechanics/*`, `rules/*`, `utils/mechanics/*`, `useEquippedEffects`, item creation/loot review, `itemMechanicsBoundary.ts`, `mechanicsReviewCoercion.ts`. Preserve supported effect definitions and review workflows.

**P4.2 Event-trigger evaluator.** Add typed triggers, conditions, stacking and lifecycle phases; bound event recursion and surface provenance. Unsupported effects must remain inert with an actionable review explanation.

**P4.3 Authoring pipeline.** Both manual item editor and AI loot parsing output the same validated effect representation. Provide friendly UI fields for trigger, damage type, dice, target and exception rules; advanced custom effects require review rather than JSON entry.

**P4.4 Rule fixtures.** Add deterministic golden tests including fire immunity/reflection and mixed damage. Include property-based or randomized invariant tests for no negative HP/temp HP, finite trigger resolution, single spend and idempotency.

**Acceptance:** custom fire-reflection example works from item creation through equip, Fireball encounter, combat outcome and narrated explanation; no special-case item-name code.

### Phase 5: World-state, campaign continuity and AI DM quality

**P5.1 Canonical world graph.** Reuse notes, quests, people, places and existing location containment. Define scene/NPC/relationship/quest mutation commands with review/permission policy. Persist both world facts and uncertainty, not merely a transcript.

**P5.2 Context assembly.** On session creation, seed from character, backstory, party, gear, spells, conditions, quests and known world. For later turns retrieve bounded relevant state plus recent events and summaries; do not resend unbounded snapshots.

**P5.3 Adaptive DM loop.** Maintain scene objective, stakes, NPC motives, unresolved hooks and pressure. AI proposes 2-3 meaningful optional choices while always accepting freeform actions. Choices must not all map to the same outcome. Resolve actions using rules when necessary, and narrate only after results.

**P5.4 Persistence.** Reconcile `campaignContinuationStore.ts`, archive storage and existing continuation endpoints. Define which persisted record is authoritative; checkpoints and event log support recovery. Never silently overwrite a newer state with an older local archive.

**Acceptance:** decisions change future world state; loot/quest/relationship updates survive reload; campaign resumes without contradictions attributable to missing persisted state; AI DM returns seamlessly from combat.

### Phase 6: UX, observability, hardening and release

**P6.1 Player-facing UI cleanup.** Hide internal trace IDs, route/debug labels and technical diagnostics from the play feed; expose them in developer diagnostics. Provide clear action/roll cards, waiting states, error recovery and readable combat summary.

**P6.2 Operational safeguards.** Versioned schemas, rate/size limits, model output validation, model timeout/retry policy, privacy-safe telemetry, cost/latency tracking, audit history and permission checks for all AI/human DM actions.

**P6.3 Compatibility.** Migration fixtures for old characters/items/sessions, downgrade/rollback plan, staged rollout with flags, cross-device tests, accessibility and mobile layout QA.

**P6.4 Optional visual scene hook.** Define a non-blocking scene snapshot/asset reference API for future 'Show me' generation, but do not build image generation before the runtime is stable.

**Acceptance:** all critical paths pass; no silent data loss or duplicate mutation; rollback rehearsed; performance and usability thresholds recorded and met.

## 8. File impact map (anticipated, verify before editing)

| File or module | Why it matters | Intended action |
|---|---|---|
| `docs/app-map.md`, `docs/feature-status.md`, `docs/migrations.md` | Canonical architecture/status | Update after each verified slice |
| `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx` | Session feed, input, combat/roll orchestration | Refactor incrementally; preserve screens |
| `components/adventure/session/*` | Feed, composer, combat, quick actions | Add roll/confirmation/pending UI |
| `utils/adventure/aiDmOneOffToolBridge.ts` | Current descriptive/queued tool bridge | Replace with command adapter |
| `utils/adventure/aiDmCampaignRuntimeApi.ts` | Turn response contract | Extend with typed pending actions/results |
| `utils/adventure/campaignEncounterRuntime.ts` | Encounter and roll gating | Fix durable roll lifecycle |
| `context/CombatContext.tsx` | Existing combat state and UI interface | Retain as projection/adapter, reduce duplicate authority |
| `utils/combat/resolveCombatAction.ts` | Action resolution and economy | Extract pure core as needed |
| `utils/combat/applyDamagePacket.ts` | Damage math and typed packet breakdown | Reuse; wrap in event/effect pipeline |
| `types/mechanics/*`, `rules/*` | Typed effect semantics and compilation | Extend versioned trigger vocabulary |
| `artifacts/api-server/src/routes/adventure.ts` | AI DM runtime and continuation endpoints | Introduce authoritative turn orchestration |
| `artifacts/api-server/src/routes/party.ts` | Party combat authority | Converge remote commit, preserve guards |
| `artifacts/api-server/src/routes/ai/index.ts` | AI parsing/loot/quest | Route reviewed mutations through same commands |
| `artifacts/api-server/src/lib/campaignContinuationStore.ts` | Session continuity persistence | Reconcile with event/snapshot authority |
| `lib/api-spec/openapi.yaml`, `lib/api-zod/`, `lib/db/src/schema/*` | Contracts and persistence | Additive versioned schemas, migrations |
| `utils/partyApi.ts`, `context/PartyContext.tsx`, `context/SyncContext.tsx` | Sync, rolls, idempotency | Add version and replay-safe projections |

## 9. Validation strategy and CI gates

**Existing commands to run first:**

```bash
pnpm run typecheck
pnpm run validate:combat-baseline
pnpm --filter @workspace/api-server exec tsx --test src/routes/party.remote-apply-route.test.ts
pnpm --filter @workspace/api-server exec tsx --test src/routes/ai/idempotency-route-safety.test.ts
pnpm --filter @workspace/api-server exec tsx --test src/routes/adventure.handoff-route.test.ts
pnpm --filter @workspace/living-character-sheet run test:smoke:adventure
```

Confirm script availability and required environment before relying on a command; record skips transparently. Add a **new E2E fixture suite** with: one-off opening; check and roll; initiative; combat; Fireball immunity/reflection; reward and inventory apply; save/resume; stale command; duplicate command; disconnect/reconnect; AI model failure after authoritative commit; two-player conflict; human DM override; legacy data migration.

For each slice require: failing regression test first (when fixing bug), unit/contract test, UI interaction test, no new type errors, security/authority negative test, status-doc update, and explicit rollback steps. No 'implemented' claim from typecheck alone.

## 10. Cross-cutting invariants

- **Exactly-once effects at the authority boundary:** duplicate `idempotencyKey` with same payload returns prior result; changed payload conflicts.
- **Versioned writes:** stale `expectedStateVersion` rejects or rebases through explicit policy; never silently overwrites.
- **One roll, one result:** persisted roll ID cannot resolve twice; retries return original outcome.
- **No narration-as-truth:** narrative is generated from committed events; proposed consequences do not become game state by being described.
- **No invisible prompts:** every `needs_input` state is visible, recoverable and linked to its owner.
- **Bounded trigger chains:** detect cycles, apply documented trigger caps, preserve valid nested reactions.
- **Authority isolation:** client previews cannot mutate remote entities; DM override is logged and authorized.
- **Compatibility:** legacy items/characters/sessions load through adapters until verified cutover.
- **Explainability:** every combat result identifies source, rule/effect, rolls, target and state delta.
- **Agency:** AI suggestions never replace freeform player intent.

## 11. Delivery cadence and definition of done

Each slice should be small enough for one focused PR or reviewable series, with a clear demo and reversible changes. Do not batch Phase 1 through Phase 4 into one rewrite. After each PR, provide: touched files, before/after behavior, tests run and results, screenshots for UI changes, authority implications, remaining limitations, and next recommended slice.

**Release-ready means:** a fresh character can start a one-off adventure; freeform actions lead to validated rolls and deterministic combat; homebrew typed effects resolve without AI guessing; rewards and world changes commit once; a multiplayer session rejects unauthorized mutations; refresh/resume retains continuity; player UI remains clean; and existing character, DM and party features still work.

## 12. First implementation assignment (ready to hand to Codex)

**Task:** Execute **Phase 0 only**, then prepare **Phase 1.1** as a reproducible diagnosis. Do not change gameplay code until the baseline and the roll-stall path are mapped.

1. Read `AGENTS.md`, `.github/copilot-instructions.md`, `docs/app-map.md`, `docs/feature-status.md`, `docs/migrations.md`, this plan and the existing adventure runtime spec.
2. Map authoritative owners for session, roll, combat, party, inventory, and AI tool execution. Show call graph for player intent -> roll request -> UI prompt -> roll response -> outcome -> AI narration.
3. Run available baseline checks, report exact pass/fail/skips and relevant environment constraints.
4. Locate the most likely roll-stall breakpoints with file/line references; add diagnostic instrumentation or a minimal failing test only if warranted and safe.
5. Propose the smallest Phase 1.2 patch with affected files, contracts, test cases, UI implications, rollback and acceptance criteria.
6. Stop for review before broad refactors or schema migrations. Do not claim the bug is fixed unless reproduced and verified.

**Non-goals for first assignment:** no new combat engine, no new UI redesign, no image generation, no destructive migration, no bypass of party authority guards.

## 13. Risks and decisions requiring explicit review

1. **D&D edition:** select supported 2014/2024 profiles and clarify licensed/SRD source scope; do not blend incompatible rules.
2. **Roll trust:** server RNG, player-submitted physical dice, or human-DM verified results require explicit trust modes.
3. **Local/offline mode:** decide when local authority is allowed and how conflicts reconcile with server sessions.
4. **Trigger wording:** 'when targeted by fire', 'when taking fire damage', and 'when fire damage is attempted' have different semantics.
5. **Partial multi-action intents:** decide transaction boundaries for 'drink potion and jump'.
6. **Human DM override:** permission, visibility, and audit requirements.
7. **AI model failure:** commit must not depend on successful narration; retry narration without repeating mechanics.
8. **Migration and rollout:** preserve existing save data and old item effect definitions through versioned adapters.

## 14. Source references

- `docs/feature-status.md`
- `docs/combat-runtime.md`
- `docs/mechanics-convergence.md`
- `docs/app-map.md`
- `docs/adventure-dm-session-runtime-spec.md`
- `AGENTS.md`
- Source paths in Sections 2 and 8; repository snapshot commit above.
