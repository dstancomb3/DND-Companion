# Adventure / AI DM Full Implementation Plan

## Current State
- **Phase 24 Complete**: Encounter gate override lifecycle with 5-minute expiry and explicit revoke controls.
- **One-off sessions**: Full local runtime with deterministic feed, tool bridge, combat panel integration, outcome state, and approved handoff submission.
- **Campaign scaffold**: Local archive storage, campaign continuation ingest bridge with idempotency, snapshot read endpoint, and live turn endpoint wiring.
- **Encounter gating**: 24 phases of deterministic gating, completion matching, confirmation workflow, and override safety.

## Remaining Work: Phases 25-35+

---

## Phase 25: AI Idempotency DB Provisioning + Verification (Environment Rollout)

**Goal**: Make AI idempotency storage durable and verifiable across all deployed environments.

**Files**:
- `lib/db/src/schema/ai.ts` (verify existing schema)
- `artifacts/api-server/src/lib/aiIdempotencyStore.ts` (verify existing implementation)
- `docs/deployment.md` (new: add environment provisioning checklist)
- `scripts/provision-ai-idempotency.sh` (new: automated provisioning script)

**Change**:
- Document explicit DB migration command for all environments: `pnpm --filter @workspace/db run push`
- Add automated verification helper that confirms `ai_idempotency_records` table exists and has correct schema
- Create deployment runbook with pre/post migration validation steps
- Add startup health-check in api-server that warns if idempotency table is missing

**Conservative boundary**:
- No schema changes to existing `ai_idempotency_records` table
- No modifications to idempotency hash or conflict-detection logic
- Verification-only, no auto-repair or data mutation

**Acceptance Criteria**:
- All environments can run `pnpm --filter @workspace/db run push` successfully
- api-server startup reports table health in logs
- AI routes function with and without idempotency table (graceful degradation)
- Deployment guide documented and tested in staging

---

## Phase 26: Live AI Turn Response + Session Continuation Bridge (Client Slice)

**Goal**: Wire active campaign sessions to request live AI DM responses mid-session with graceful fallback.

**Files**:
- `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx` (expand)
- `artifacts/living-character-sheet/utils/adventure/aiDmCampaignRuntimeApi.ts` (expand with response streaming)
- `artifacts/living-character-sheet/components/adventure/session/AiDmSessionInputComposer.tsx` (add request pending state)
- `artifacts/living-character-sheet/components/adventure/session/AiDmSessionFeedShell.tsx` (add streaming entry rendering)

**Change**:
- Add persistent request-pending UI state that disables input composer while awaiting AI response
- Wire input composer submit to call live-turn endpoint with current feed context and player input
- Add bounded streaming/polling support so UI updates as feed entries arrive
- Add explicit "waiting for DM..." placeholder entry during request in-flight
- Add graceful timeout (30s) with manual retry option if response stalls
- Add roll-request auto-injection if live turn returns encounter intent with required rolls

**Conservative boundary**:
- No session state persistence changes; responses stored in local feed archive only
- No server-side orchestration logic; endpoint remains request-response contract
- Live turn still optional; one-off sessions and pre-recorded campaigns unaffected

**Acceptance Criteria**:
- Input composer disables during request and re-enables on response
- Streaming entry appears as feed item without page jump
- Timeout triggers explicit "Connection lost" message with retry button
- Encounter intents from live turn trigger roll-request injection as in campaign scaffold flow
- No typecheck errors; smoke test passes

---

## Phase 27: Campaign Session Server-Side Persistence Foundation

**Goal**: Add durable server-side campaign session metadata storage and checkpoint recall without changing orchestration authority.

**Files**:
- `lib/db/src/schema/adventure.ts` (new: campaign_sessions, campaign_checkpoints tables)
- `artifacts/api-server/src/routes/adventure.ts` (expand)
- `artifacts/api-server/src/routes/adventure.handoff-route.test.ts` (expand)

**Change**:
- Add `campaign_sessions` table: `{ sessionId, campaignId, title, difficulty, stylePreset, guidance, createdAt, updatedAt, status }`
- Add `campaign_checkpoints` table: `{ checkpointId, sessionId, checkpointIndex, entries, pendingChoices, progressSummary, continuityStatus, createdAt }`
- Add server endpoint `POST /api/adventure/campaign-sessions` to create/upsert session metadata with idempotency
- Add server endpoint `GET /api/adventure/campaign-sessions/:sessionId` to retrieve session metadata and current checkpoint
- Add server endpoint `GET /api/adventure/campaign-sessions/:sessionId/checkpoints/:checkpointIndex` to retrieve specific checkpoint
- No orchestration logic; endpoints are passive storage/retrieve only

**Conservative boundary**:
- No server-side AI runtime or turn orchestration
- No automatic checkpoint creation; client drives what snapshots when
- No session-state detection or active-session enforcement

**Acceptance Criteria**:
- Campaign session can be saved on server with POST endpoint
- Session metadata and checkpoints can be retrieved on reconnect
- Idempotency protects duplicate session creation attempts
- Focused route tests cover create, retrieve, and duplicate scenarios
- No typecheck errors

---

## Phase 28: Campaign Session Client Persistence + Server Sync

**Goal**: Sync campaign sessions between local archive and server storage, with conflict-safe resumption.

**Files**:
- `artifacts/living-character-sheet/utils/adventure/aiDmCampaignSessionStorage.ts` (expand)
- `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx` (expand)
- `artifacts/living-character-sheet/app/adventure/sessions.tsx` (expand)
- `artifacts/living-character-sheet/utils/adventure/aiDmCampaignSessionSync.ts` (new)

**Change**:
- Add helper `syncCampaignSessionToServer()` that submits local session metadata + latest checkpoint
- Add helper `fetchCampaignSessionFromServer()` that retrieves server metadata and optional checkpoint
- Wire campaign session route to auto-sync on entry if `campaignId` is provided (optional server persistence)
- Wire Saved Sessions to support both local-only and server-backed session display
- Add conflict-safe resume logic: local checkpoint takes precedence; server checkpoint used only on cold start
- Add explicit "Sync to Server" button in session menu for manual persistence intent

**Conservative boundary**:
- Local archive remains authoritative for in-session state
- No automatic push/pull; sync only on explicit action or session entry
- No conflict resolution beyond "local wins" for active sessions
- Server sync is opt-in, not mandatory

**Acceptance Criteria**:
- Session can be synced to server from session route
- Saved Sessions shows both local and server-backed sessions
- Resume from server checkpoint works and matches local archive behavior
- Local edits do not overwrite server checkpoint without explicit sync
- No typecheck errors; focused tests cover sync scenarios

---

## Phase 29: Session Awareness + Cross-Screen Active Session Detection

**Goal**: Detect active adventure sessions and surface resumption/awareness UI on supporting screens.

**Files**:
- `artifacts/living-character-sheet/context/AdventureSessionContext.tsx` (new)
- `artifacts/living-character-sheet/app/(tabs)/sheet.tsx` (expand)
- `artifacts/living-character-sheet/app/(tabs)/quick-update.tsx` (expand)
- `artifacts/living-character-sheet/app/party.tsx` (expand)
- `artifacts/living-character-sheet/components/adventure/AdventureSessionAwarenessCard.tsx` (expand)

**Change**:
- Add `AdventureSessionContext` that tracks active session id, checkpoint index, and last-activity timestamp
- Wire context to persist active session to local storage on every change
- Add startup check in app root to hydrate active session from storage
- Add awareness card to sheet/quick-update/party screens when active session exists
- Awareness card shows: session title, checkpoint count, last active time, "Resume" button
- Resume button routes to active session with no state loss
- Add explicit "End Session" action to close active session from any screen

**Conservative boundary**:
- Awareness is read-only display; no automatic session continuation
- End session only clears local tracking, not server state
- No cross-screen mutation enforcements based on session state

**Acceptance Criteria**:
- Active session persists across app restart
- Sheet/quick-update/party screens show awareness card when session active
- Resume button routes to correct session with current checkpoint
- End session clears active session tracking
- No typecheck errors; smoke test passes

---

## Phase 30: Remote Mutation Authority Expansion + Condition Effects (Preview)

**Goal**: Extend remote apply path to handle condition-effect mutations safely (preview-only).

**Files**:
- `artifacts/api-server/src/routes/party.ts` (expand remote-apply path)
- `artifacts/api-server/src/routes/party.remote-apply-route.test.ts` (expand)
- `artifacts/living-character-sheet/context/CombatContext.tsx` (expand)
- `artifacts/living-character-sheet/utils/combat/resolveHitSaveDamage.ts` (expand)

**Change**:
- Extend remote-apply endpoint to accept bounded condition-effect mutations: `apply_condition`, `remove_condition` (in addition to existing `damage`, `healing`)
- Add server-side validation: condition authority must match party combat context, target must be current battle member/NPC, effect must be recognized
- Add client support for resolving condition effects through remote-apply path (preserving preview-only for non-local members)
- Update CombatContext to route condition consequences through remote-apply when target is remote
- Add focused route tests covering condition-effect application, removal, and edge cases (stale battle, missing condition, etc.)

**Conservative boundary**:
- Condition mutations remain preview-only until server-authoritative condition store exists
- No new condition types or effect behaviors
- No condition duration override or immunity changes
- Remote apply scope remains bounded to recognized effect types

**Acceptance Criteria**:
- Remote-apply endpoint accepts condition-effect mutations
- Server validates condition authority and target context
- Client routes condition consequences through remote-apply for remote targets
- Focused tests cover apply, remove, and error scenarios
- No typecheck errors; combat safety validation passes

---

## Phase 31: Campaign Narration Authority + DM Control Affordances

**Goal**: Add explicit DM-authored narration segments and player-action boundary controls without full orchestration.

**Files**:
- `artifacts/living-character-sheet/types/aiDmContracts.ts` (expand)
- `artifacts/living-character-sheet/utils/adventure/aiDmSessionFeedScaffold.ts` (expand)
- `artifacts/api-server/src/routes/adventure.ts` (expand)
- `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx` (expand)

**Change**:
- Add bounded narration segment contract: `{ type: 'narration', text, authoredBy, authoredAt, consumedAt? }`
- Add bounded player-action boundary contract: `{ type: 'action_boundary', reason, requiredConsent?, enforceUntilMs? }`
- Update feed scaffold to support narration segments alongside existing entry types
- Add DM-facing "Add Narration" button in session that accepts free-form text and injects narration segment into feed
- Add player-action boundary injection in session UI (blocks non-DM input until boundary consumed or timeout)
- Wire quick-action button suppression when action boundary is active
- Add accessibility labels and screen reader support for narration and boundary state

**Conservative boundary**:
- Narration is display-only; no automatic or triggered narration
- Action boundaries are local UI control only; no server enforcement
- No broad DM permission model; assumes single-device local play
- Backward compatible with existing feed structures

**Acceptance Criteria**:
- DM can inject narration segments from session UI
- Narration displays as feed item with authorship metadata
- Action boundaries suppress quick actions and input composer
- Boundary timeout automatically clears if specified
- Accessibility tests pass; screen readers announce narration and boundaries
- No typecheck errors

---

## Phase 32: AI Completion Diagnostics + Session Recovery Helpers

**Goal**: Surface AI request completion status and provide recovery paths for stalled sessions.

**Files**:
- `artifacts/living-character-sheet/utils/adventure/aiDmSessionDiagnostics.ts` (new)
- `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx` (expand)
- `artifacts/living-character-sheet/components/adventure/session/AiDmSessionDiagnosticsPanel.tsx` (new)

**Change**:
- Add helper `deriveSessionDiagnosticsStatus()` that returns: last-request-time, request-count, idempotency-key-reuse-count, stall-duration, pending-state
- Add helper `suggestRecoveryAction()` that recommends: retry, refresh-checkpoint, skip-encounter, abandon-session based on stall duration and state
- Add developer-visible diagnostics panel in session route (hidden by default, toggle in options)
- Diagnostics panel shows: request count, idempotency stats, stall timer, suggested recovery action
- Add "Retry Request" button for in-flight requests that exceed timeout
- Add "Refresh Checkpoint" button to re-hydrate session state from server
- Add "Skip Encounter" button to allow DM to manually advance gate without AI response

**Conservative boundary**:
- Diagnostics are read-only display; no automatic corrections
- Recovery actions are DM-explicit; no silent retry or rollback
- No session mutation beyond what recovery actions explicitly perform
- Diagnostics only visible in dev/options mode

**Acceptance Criteria**:
- Diagnostics panel displays accurate session state when enabled
- Recovery actions execute and update session state correctly
- "Skip Encounter" updates gate visibility and unblocks narration
- Stall detection triggers at configured thresholds (30s, 60s)
- No typecheck errors; focused tests cover diagnostic derivation

---

## Phase 33: Full Remote Mutation Authority Model (Preview + Commit)

**Goal**: Establish server-authoritative remote mutation with client-side preview and explicit commit flow.

**Files**:
- `artifacts/api-server/src/routes/party.ts` (redesign remote-apply)
- `artifacts/api-server/src/lib/partyRuntimeSchema.ts` (expand)
- `artifacts/api-server/src/routes/party.remote-apply-route.test.ts` (expand significantly)
- `artifacts/living-character-sheet/context/CombatContext.tsx` (expand)
- `artifacts/living-character-sheet/utils/combat/resolveHitSaveDamage.ts` (expand)

**Change**:
- Redesign remote-apply endpoint to support two-phase flow: `{ phase: 'preview' | 'commit', mutations: [...] }`
- Preview phase: resolve mutations, return authority verdict (`can_apply_remote`, `preview_only`, `denied_reason`), but do NOT mutate state
- Commit phase: apply mutations only if source member context and turn ownership still valid (fail-closed)
- Add bounded mutation scope: HP/tempHP damage, healing, condition add/remove, temporary ability score mods (not permanent rests)
- Update CombatContext preview path to submit preview-phase requests, display verdicts, then request explicit commit before applying
- Add client confirmation UI: "Apply [mutation] to [target]?" with authority disclaimer
- Add server logging of all remote mutation intents for audit trail

**Conservative boundary**:
- No automatic mutation application; all remote changes require explicit review + confirmation
- No new condition types or effect semantics beyond Phase 30
- No server-side combat orchestration; mutations remain reactive to client requests
- Preview verdicts are advisory; actual commit validation is final authority

**Acceptance Criteria**:
- Preview requests return accurate authority verdicts
- Mutations are not applied during preview phase
- Commit phase validates turn ownership and source context before applying
- Client requires explicit confirmation for all remote mutations
- Comprehensive remote-apply tests cover preview, commit, and denial scenarios
- Audit logging captures all remote mutation attempts

---

## Phase 34: Campaign Session Orchestration Contracts + Server Handoff

**Goal**: Define comprehensive campaign session orchestration contract and deferred-handoff flow for server ingestion.

**Files**:
- `artifacts/living-character-sheet/types/aiDmContracts.ts` (expand campaign orchestration contract)
- `artifacts/api-server/src/routes/adventure.ts` (expand with campaign-orchestration endpoint)
- `artifacts/api-server/src/routes/adventure.handoff-route.test.ts` (expand)
- `docs/adventure-orchestration-contract.md` (new)

**Change**:
- Define complete campaign orchestration export contract: `campaign-orchestration.v1` with session metadata, full feed history, encounter-gate state, confirmation audit trail, override metadata, and final summary
- Add server endpoint `POST /api/adventure/campaign-orchestration` to ingest campaign orchestration payload with full idempotency and conflict-safe semantics
- Payload validation: required fields, schema version, feed integrity, gate state consistency
- Add server response: accepted with checkpoint index, or conflict/validation error with recovery suggestions
- Client-side helper `exportCampaignOrchestration()` to build payload from session state
- Client-side helper `validateOrchestrationPayload()` to detect drift before submission
- Add session UI "Export & Handoff" button that builds and submits orchestration payload
- Add status display: submitted, awaiting-processing, failed (with retry option)

**Conservative boundary**:
- No server-side orchestration logic; orchestration is passive record-keeping only
- No AI processing or resumption scheduling; handoff is data archival only
- Backward compatible with existing campaign-scaffold and continuation contracts
- Orchestration payload is append-only; no session state overwrites

**Acceptance Criteria**:
- Orchestration contract captures full session state accurately
- Server endpoint validates and accepts payload with idempotency
- Client builds and validates payload before submission
- Session UI shows handoff status and allows retry on failure
- Comprehensive tests cover payload validation and conflict scenarios
- No typecheck errors

---

## Phase 35: Server-Side AI Turn Orchestration + Campaign Runtime Authority

**Goal**: Implement server-side AI turn generation with bounded orchestration authority.

**Files**:
- `artifacts/api-server/src/routes/adventure.ts` (expand with orchestration logic)
- `artifacts/api-server/src/lib/aiDmOrchestration.ts` (new)
- `artifacts/api-server/src/routes/adventure.orchestration-route.test.ts` (new)
- `artifacts/living-character-sheet/utils/adventure/aiDmCampaignRuntimeApi.ts` (update)

**Change**:
- Add `aiDmOrchestration` helper that accepts current session context and generates next AI turn response
- Response generation: resolve pending encounter gates, generate narration, determine next action (roll request, new narration, etc.), encode into turn response contract
- Wire live-turn endpoint to use orchestration helper (instead of generic client-proxied AI call)
- Add bounded orchestration authority: sessions with explicit orchestration=true flag, validation of session metadata and campaign context
- Add deterministic seed handling so same input + seed produces reproducible output
- Add timeout (30s) with graceful degradation: return partial response or fallback narration if generation stalls
- Add comprehensive logging of all AI turn generation: input context, generation time, output summary

**Conservative boundary**:
- No server state mutation beyond turn response generation
- No automatic session progression; client drives when to request next turn
- No multi-session orchestration or cross-session context
- AI model selection and parameters remain client-configurable

**Acceptance Criteria**:
- Orchestration helper generates plausible turn responses for given context
- Live-turn endpoint uses orchestration and returns in-spec response
- Timeout triggers graceful degradation with fallback response
- Seed-based reproducibility works correctly
- Comprehensive tests cover successful generation, timeout, and edge cases
- No typecheck errors

---

## Phase 36: Campaign Session Resumption + Progressive Handoff

**Goal**: Support full campaign session resumption from checkpoint and multi-session handoff chains.

**Files**:
- `artifacts/living-character-sheet/app/adventure/sessions.tsx` (expand)
- `artifacts/living-character-sheet/utils/adventure/aiDmSessionResumption.ts` (new)
- `artifacts/api-server/src/routes/adventure.ts` (expand)

**Change**:
- Add "Resume from Server" flow: fetch session metadata + latest checkpoint, restore feed state, resume at last pending choice
- Add checkpoint selection UI: allow player to resume from any prior checkpoint instead of latest
- Add "Save Checkpoint" affordance in session UI: explicit checkpoint creation without ending session
- Add multi-session chain display in Saved Sessions: show parent → child relationships if campaign spans multiple session records
- Add "End and Handoff to New Session" workflow: submit orchestration payload, then create linked child session
- Add resume metadata tracking: `resumedFromSessionId`, `resumeCheckpointIndex`, `resumedAtMs` for audit trail

**Conservative boundary**:
- Checkpoints are isolated snapshots; no cross-checkpoint state merges
- No automatic resumption; all resumes are explicit player action
- No session forking or branching; linear parent-child chain only
- No server-side session linking enforcements; metadata is advisory

**Acceptance Criteria**:
- Sessions can be resumed from any available checkpoint
- Checkpoint UI accurately shows available restore points
- Multi-session chain is displayed and navigable from Saved Sessions
- Resume metadata is captured and persists correctly
- No typecheck errors; smoke tests pass

---

## Phase 37: Full Adventure Awareness + Landing Integration

**Goal**: Integrate adventure sessions into landing page and main navigation as first-class feature.

**Files**:
- `artifacts/living-character-sheet/app/landing.tsx` (expand)
- `artifacts/living-character-sheet/app/(tabs)/_layout.tsx` (update if needed)
- `artifacts/living-character-sheet/components/adventure/AdventureSessionCard.tsx` (expand)

**Change**:
- Add "Active Adventures" section on landing page showing current session with thumbnail
- Add quick-resume button from landing to active session
- Add "Recent Adventures" section showing last 5 sessions with date/checkpoint info
- Add navigation indicator in tab bar if active session exists (e.g., badge or highlight)
- Add landing-to-adventure transition animation for visual continuity
- Update landing subtitle to reflect adventure as first-class entry point

**Conservative boundary**:
- No changes to character creation or existing DM tools
- Adventure entry remains independent; no mandatory involvement
- Navigation changes are UI-only; no authority shifts

**Acceptance Criteria**:
- Landing displays active adventure card with resume button
- Recent adventures list is accurate and navigable
- Tab navigation shows active session indicator
- Transition animations are smooth and accessible
- No typecheck errors; smoke tests pass

---

## Phase 38: Production Hardening + Observability

**Goal**: Add comprehensive logging, monitoring, and error recovery for production deployment.

**Files**:
- `artifacts/api-server/src/lib/aiDmObservability.ts` (new)
- `artifacts/api-server/src/routes/adventure.ts` (expand logging)
- `artifacts/living-character-sheet/utils/adventure/aiDmSessionDebug.ts` (expand)

**Change**:
- Add structured logging for all AI DM routes: request in, processing steps, response out, errors
- Add metrics collection: request count, response time, error rate, idempotency hit rate
- Add client-side error boundary for adventure routes with fallback UI and error reporting
- Add server-side error recovery: retry logic for transient failures, circuit breaker for persistent failures
- Add explicit error categories: client-error, server-error, network-error, timeout, validation-error
- Add user-facing error messages that distinguish between recoverable and fatal states

**Conservative boundary**:
- Logging is observational only; no auto-corrections beyond retry
- Error recovery does not change session state or create divergences
- Metrics collection is diagnostic; no automatic scaling or throttling

**Acceptance Criteria**:
- All AI DM routes emit structured logs
- Error scenarios produce user-friendly messages
- Metrics can be queried from server logs
- Client error boundary catches and reports adventure errors
- No typecheck errors

---

## Phase 39: DM Companion Mobile Support (Optional Stretch)

**Goal**: Optimize adventure session UX for mobile DM concurrent play.

**Files**:
- `artifacts/living-character-sheet/components/adventure/session/AiDmSessionFeedShell.tsx` (optimize)
- `artifacts/living-character-sheet/components/adventure/AdventureSessionCard.tsx` (optimize)

**Change**:
- Add responsive layout: feed and actions stack vertically on mobile
- Add swipe gestures: left/right to navigate feed, up to show/hide narration panel
- Add persistent DM action bar: always accessible, collapsible to minimize screen real estate
- Add dark theme optimizations for extended play sessions
- Add battery-saver mode: reduced animations and refresh rates

**Conservative boundary**:
- No changes to core session logic or orchestration
- UI/UX optimization only
- Mobile support is additive; desktop experience unchanged

**Acceptance Criteria**:
- Feed displays correctly on mobile (320px - 480px widths)
- Swipe gestures work reliably and feel natural
- DM action bar is always accessible without scrolling
- Dark theme reduces eye strain
- Smoke tests pass on mobile viewport

---

## Phase 40: Campaign Graph Visualization (Optional Stretch)

**Goal**: Provide visual campaign progression tracking and encounter graph display.

**Files**:
- `artifacts/living-character-sheet/components/adventure/CampaignGraphVisualization.tsx` (new)
- `artifacts/living-character-sheet/app/adventure/sessions.tsx` (expand)

**Change**:
- Add campaign graph component: displays encounters as nodes, progression as edges
- Add filtering: filter by encounter type, status, difficulty
- Add click navigation: tap node to jump to checkpoint
- Add interactive legend: encounter symbols, status indicators
- Add export as image for campaign documentation

**Conservative boundary**:
- Visualization is read-only; no edits or mutations through graph UI
- Graph data is derived from session state; no new data sources
- Graph is optional feature; main session flows unaffected

**Acceptance Criteria**:
- Graph renders correctly for sample campaigns
- Node filtering works and updates graph
- Click navigation jumps to correct checkpoint
- Export produces readable image
- No typecheck errors

---

## Success Criteria for Full Implementation

1. **End-to-End Workflow**: DM can start a campaign, run encounters with live AI responses, resolve encounter gates, save checkpoints, resume from any checkpoint, and export for archival.
2. **Session Persistence**: All sessions persist on server and locally; resume works across app restarts and devices.
3. **Server Authority**: AI turn generation is server-driven; client orchestration exists but defers to server for narration and encounter direction.
4. **Error Recovery**: Stalled or failed sessions have clear recovery paths; diagnostics and manual overrides prevent dead-ends.
5. **Production Ready**: Comprehensive logging, monitoring, error boundaries, and user-friendly error messages.
6. **Accessibility**: Screen reader support, high-contrast mode, keyboard navigation, motion-reduction options.
7. **Performance**: Session operations complete in <2s; streaming responses show progress; no UI blocking.
8. **Testing**: All phases have comprehensive unit + integration tests; smoke tests cover full workflows.

---

## Estimated Timeline

- **Phases 25-28** (DB + Sync): 2-3 weeks
- **Phases 29-32** (Session Awareness + Diagnostics): 2-3 weeks
- **Phases 33-35** (Remote Authority + Orchestration): 3-4 weeks
- **Phases 36-37** (Resumption + Integration): 2 weeks
- **Phases 38-40** (Hardening + Polish): 2-3 weeks

**Total**: ~12-16 weeks to full production implementation (assuming parallel work on UI and server paths).

---

## Current Blockers (Pre-Phase 25)

- [ ] Confirm AI idempotency table exists in all staging environments
- [ ] Verify existing live-turn endpoint is wired and tested
- [ ] Confirm campaign continuation snapshot read endpoint is stable
- [ ] Review and approve Phase 25 diagnostics approach with team

