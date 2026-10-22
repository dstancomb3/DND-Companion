# App Map: Character Companion

This is the canonical, code-grounded map of the repo after Phases 1-8.
Use this first to locate authority boundaries before editing.

## Top-Level Domains

- Client app: artifacts/living-character-sheet/
- API server: artifacts/api-server/
- Shared libraries: lib/
- Data: data/
- Scripts: scripts/
- Overrides: customData/overrides/

## Authority Boundaries

- UI and local UX orchestration: artifacts/living-character-sheet/
- Server route authority and conflict checks: artifacts/api-server/src/routes/
- Schema/API contract authority: lib/api-zod/ and lib/api-spec/openapi.yaml
- Persistence adapters: lib/db/

## High-Use Client Contexts

- Character and progression: artifacts/living-character-sheet/context/CharacterContext.tsx
- Combat outcomes and local authority gating: artifacts/living-character-sheet/context/CombatContext.tsx
- Party session/member sync: artifacts/living-character-sheet/context/PartyContext.tsx
- Deferred AI replay and retry queue: artifacts/living-character-sheet/context/SyncContext.tsx
- Mutation history and undo/redo: artifacts/living-character-sheet/context/MutationHistoryContext.tsx

## Key Product Surfaces

- Character flows: app/characters.tsx, app/create-character.tsx, app/edit-character.tsx
- Sheet and combat-facing UI: app/(tabs)/sheet.tsx and components/sheet/
- Quick update and AI parse/apply: app/(tabs)/quick-update.tsx
- Party and events: app/party.tsx, app/party-events.tsx, app/dm-party.tsx
- DM tools: app/dm-item.tsx, app/dm-monsters.tsx, app/dm-npc.tsx, app/dm-notes.tsx
- Adventure / AI DM Phase 1 (bounded one-off shell):
  - Landing IA entry: artifacts/living-character-sheet/app/landing.tsx
  - Adventure route shell: artifacts/living-character-sheet/app/adventure/_layout.tsx
  - Adventure home: artifacts/living-character-sheet/app/adventure/index.tsx
  - New adventure one-off setup route: artifacts/living-character-sheet/app/adventure/new.tsx
  - Saved sessions scaffold route: artifacts/living-character-sheet/app/adventure/sessions.tsx
  - Active one-off session shell route: artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx
  - Shared route defs: artifacts/living-character-sheet/utils/aiDmRouteDefs.ts
  - One-off setup/session helpers: artifacts/living-character-sheet/utils/adventure/aiDmOneOffSessionBootstrap.ts, artifacts/living-character-sheet/utils/adventure/aiDmOneOffSessionGuidance.ts, artifacts/living-character-sheet/utils/adventure/aiDmSessionFeedScaffold.ts, artifacts/living-character-sheet/utils/adventure/aiDmOneOffToolBridge.ts, artifacts/living-character-sheet/utils/adventure/aiDmOneOffOutcomeScaffold.ts
  - Campaign scaffold foundation helpers (bounded Phase 11): artifacts/living-character-sheet/utils/adventure/aiDmCampaignSessionBootstrap.ts
  - One-off handoff submit helper: artifacts/living-character-sheet/utils/adventure/aiDmOneOffHandoffApi.ts
  - Campaign scaffold submit helper: artifacts/living-character-sheet/utils/adventure/aiDmCampaignScaffoldApi.ts
  - Campaign continuation submit helper: artifacts/living-character-sheet/utils/adventure/aiDmCampaignContinuationApi.ts
  - One-off session UI shell components: artifacts/living-character-sheet/components/adventure/session/AiDmOneOffSetupForm.tsx, artifacts/living-character-sheet/components/adventure/session/AiDmSessionFeedShell.tsx, artifacts/living-character-sheet/components/adventure/session/AiDmSessionInputComposer.tsx, artifacts/living-character-sheet/components/adventure/session/AiDmSessionQuickActionsRow.tsx, artifacts/living-character-sheet/components/adventure/session/AiDmCombatSubmodePanel.tsx, artifacts/living-character-sheet/components/adventure/session/AiDmSessionOutcomeShell.tsx
  - Shared AI DM contracts: artifacts/living-character-sheet/types/aiDmContracts.ts, artifacts/living-character-sheet/types/aiDmStyle.ts, artifacts/living-character-sheet/types/aiDmJournal.ts, artifacts/living-character-sheet/types/aiDmPolicy.ts
  - Session-awareness placeholder UI: artifacts/living-character-sheet/components/adventure/

## Adventure / AI DM Current Boundary

- Current Adventure includes a bounded local one-off session shell (setup, deterministic feed, quick actions, bounded combat panel hooks, and local outcome shell state).
- Current Adventure also includes a bounded campaign scaffold session contract path (deterministic local campaign session metadata and campaign scaffold feed seed) without server orchestration authority.
- Current Adventure now also includes bounded campaign scaffold ingest submission from the session shell to a dedicated campaign scaffold ingest endpoint, with idempotency safety and no orchestration authority migration.
- Current Adventure now also includes a bounded campaign continuation ingest endpoint contract (`campaign-continuation.v1`) with endpoint-scoped idempotency protections and no runtime-orchestration authority migration.
- Adventure now also includes server-backed campaign continuation snapshot persistence with in-process fallback when the table or database is unavailable; this preserves the existing continuation submit/read contract without broad orchestration migration.
- Adventure still does not provide persisted AI DM session orchestration, server AI runtime authority, or broad supporting-screen runtime integration.

## Key Server Routes and Libraries

- AI parsing routes: artifacts/api-server/src/routes/ai/index.ts
- Adventure one-off, campaign scaffold, and campaign continuation ingest routes: artifacts/api-server/src/routes/adventure.ts
- Adventure campaign continuation snapshot read route (`GET /api/adventure/campaign-continuations/:sessionId`): artifacts/api-server/src/routes/adventure.ts
- Adventure live campaign runtime turn route (`POST /api/adventure/campaign-runtime/turn`): artifacts/api-server/src/routes/adventure.ts
- Adventure campaign continuation snapshot store: artifacts/api-server/src/lib/campaignContinuationStore.ts
- AI idempotency boundary helpers: artifacts/api-server/src/lib/aiIdempotencyStore.ts, artifacts/api-server/src/lib/aiIdempotencyHash.ts
- Party sync/conflict handling: artifacts/api-server/src/routes/party.ts
- Member sync guard: artifacts/api-server/src/lib/partySyncGuard.ts
- Party runtime normalization: artifacts/api-server/src/lib/partyRuntimeSchema.ts
- Adventure continuation snapshot schema: lib/db/src/schema/adventure.ts

## Focused API Server Safety Tests

- Remote apply authority/safety tests: artifacts/api-server/src/routes/party.remote-apply-route.test.ts
- AI idempotency route safety tests: artifacts/api-server/src/routes/ai/idempotency-route-safety.test.ts

## Notable Phase 6-8 Surfaces

- Progression/rules derivation and guardrails:
  - artifacts/living-character-sheet/data/progression/engine.ts
  - artifacts/living-character-sheet/rules/engine.ts
  - artifacts/living-character-sheet/rules/registry.ts
- State/sync hardening and replay safety:
  - artifacts/living-character-sheet/utils/aiQueue.ts
  - artifacts/living-character-sheet/utils/mutationUndo.ts
  - artifacts/living-character-sheet/utils/partyApi.ts
- Monster compendium cache/performance hardening:
  - artifacts/living-character-sheet/utils/monsterApi.ts
  - artifacts/living-character-sheet/app/dm-monsters.tsx

## Migration and Partial Zones

- Combat runtime remains conservative/partial for remote mutation authority.
- Quest graph workflows are implemented with deferred-review paths, not full end-to-end automation.
- Schema convergence and legacy compatibility remain in progress.

See docs/feature-status.md and docs/migrations.md for completion state and deferred backlog.

## Proposed Runtime Convergence Plan

See [AI DM + Deterministic Combat Convergence Plan](ai-dm-combat-convergence-plan.md) for the proposed staged roadmap, authority invariants, durable roll handshake, and fire-immunity/reflection acceptance fixture. This is planning guidance, not a shipped-feature claim. After audit fixes, start with Phase 0 baseline/authority mapping and Phase 1.1 roll-stall diagnosis before gameplay changes.

## Party host capability (disband only)

- Server credential hashing: `artifacts/api-server/src/lib/partyHostToken.ts`; route checks remain in `routes/party.ts`.
- Shared client creation/disband adapter: `artifacts/living-character-sheet/utils/partyHostApi.ts`, wired through `utils/partyApi.ts`.
- Schema rollout and remaining authorization gaps: [Party host permissions](party-host-permissions.md).

## Party member capabilities (direct sync and leave)

- Server enrollment and proof checks: `artifacts/api-server/src/routes/party.ts`, reusing `src/lib/partyHostToken.ts` cryptography.
- Client enrollment/credential adapter: `artifacts/living-character-sheet/utils/partyMemberApi.ts`, connected through `utils/partyApi.ts` and `context/PartyContext.tsx`.
- Required cutover and remaining indirect write paths: [Party member permissions](party-member-permissions.md).

## Planned DM history and rollback

See [DM history, snapshots and rollback](dm-history-and-rollback-spec.md) for the planned cross-domain history contract and Phase 2 integration. Existing local mutation undo remains limited; no shared restore control is implemented by this documentation change.

## Local history undo containment

`utils/mutationUndoSafety.ts` refuses unverified MutationHistory reversals. Quick Update/Log show the limitation; complete capture and guarded undo remain planned. See [local undo containment](local-undo-containment.md) before re-enabling a path.

## Limited-use snapshot coverage

`utils/mechanics/snapshotEffectUsage.ts` validates limited-use count maps at the existing character snapshot boundary. Context save/load and import/export preserve these maps; this is partial snapshot coverage. See [snapshot usage coverage](snapshot-effect-usage.md).

## Item creation API reliability

See [item creation audit](audits/item-creation-api-audit.md) for the actual proposal→draft/review→store/inventory paths, field-preservation gaps and prioritized fixes. Item Designer's description API and functional item application are separate authority boundaries today.


## DM loot draft preservation

`artifacts/living-character-sheet/utils/dmLootDraft.ts` adapts generated proposals and DM edits into the existing full inventory snapshot carried by party loot assignments. `app/dm-party.tsx` uses it for both assignment modes. Player claims already accept that snapshot in `app/party.tsx`; durable claim/save receipts and complete schema validation remain separate audit work.


## Implementation history and active audit scope

Read [Implementation log](implementation-log.md) before choosing the next slice. It maps merged PRs to the recovered original findings and the separate undo/item audits, records partial/contained work and rollout limits, and preserves the unresolved original audit count.
