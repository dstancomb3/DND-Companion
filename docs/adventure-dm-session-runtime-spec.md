# Adventure DM Session Runtime Spec

Status: Draft for implementation
Date: 2026-05-07
Owner: Adventure runtime track

## 1. Goal

Deliver a playable session loop where a player can:

- start a session from an encounter intent,
- receive an immediate DM opening scene,
- make freeform choices each turn,
- get evolving options and challenges,
- continue the story with continuity across turns and reloads.

This spec defines how the system should behave like a practical table DM loop while staying inside current repo authority boundaries.

## 2. Product Requirement (User-Visible)

The player flow must be:

1. "I want this kind of encounter."
2. "Start session."
3. DM opens with scene, challenge, and options.
4. Player acts.
5. DM reacts with consequences, escalates or shifts pressure, and offers next options.
6. Repeat.

The player should not need to manually stitch together setup steps to get first playable story beats.

## 3. DM Runtime Principles

The runtime must follow these operating principles:

- Prep and run situations, not scripted plots.
- Preserve player agency: choices must change what happens next.
- Keep a stable scene loop: frame, intent, adjudicate, consequence, options.
- Keep pressure moving: each turn should reveal, escalate, or reposition.
- Keep continuity explicit: unresolved hooks, clocks, threats, and NPC goals persist.
- Keep mechanics honest: when uncertain and rules-relevant, resolve with checks/saves/attacks.

## 4. Scope and Non-Goals

In scope for full implementation:

- encounter intent capture and kickoff,
- DM scene generation loop,
- challenge pacing and clocks,
- continuity state persistence and reload,
- structured options plus freeform action,
- bounded mechanical adjudication for common actions.

Out of scope for this implementation plan:

- full global campaign management UI redesign,
- complete 5e rules automation for every edge case,
- replacing existing combat authority models in one pass,
- destructive schema migrations.

## 5. Session Lifecycle

### 5.1 Start

Input fields:

- campaign name,
- chapter label,
- encounter intent,
- difficulty,
- style.

On start, system creates session state and immediately runs kickoff turn.

Kickoff turn output must include:

- opening scene text,
- immediate challenge or tension,
- 2-3 concrete options,
- open-ended fallback: "or do something else".

### 5.2 Turn Loop

Each turn executes this state machine:

1. Accept player intent.
2. Classify action type.
3. Decide adjudication mode.
4. Compute outcome and state updates.
5. Narrate consequence.
6. Offer next options.
7. Persist turn artifact.

### 5.3 Continuation

Session can be resumed by session id.

Resume must restore:

- latest scene state,
- active threats,
- progress clocks,
- unresolved hooks,
- recent transcript,
- challenge status.

## 6. Runtime Data Model (Authoritative Server State)

Adventure session runtime state should be additive and explicit:

- sessionMeta: sessionId, campaignId, campaignLabel, chapterLabel, difficulty, style.
- premise: encounterIntent, initialConstraints.
- sceneState: location, objective, currentTension, sceneTags.
- pressureState: one or more clocks with thresholds and triggers.
- actorState: key NPC intents and dispositions.
- challengeState: active challenge type, stakes, failure costs.
- continuityState: unresolved hooks and remembered consequences.
- transcriptState: bounded recent turns plus compressed summary.
- telemetryState: trace ids, turn count, timing, model metadata.

## 7. Turn Contracts

### 7.1 Player Turn Request

Minimum request shape:

- sessionId,
- playerInput,
- recentEntries,
- optional declaredActionContext.

### 7.2 DM Turn Response

Response shape must include:

- dmText,
- choices: 2-3 concise actionable options,
- challenge: current obstacle with stakes,
- stateTags,
- pressureUpdate,
- continuityUpdate,
- outcomeType.

### 7.3 Valid Choice Rules

Each choice must be:

- concretely actionable in one turn,
- meaningfully distinct from siblings,
- tied to current scene and stakes,
- no fake options that collapse to same outcome.

## 8. Adjudication Strategy

### 8.1 Mode Selection

Action resolves in one mode:

- free success for trivial or uncontested actions,
- ability check,
- saving throw,
- attack or damage path,
- contested resolution.

### 8.2 Bounded Mechanics

Initial implementation should support high-frequency mechanics:

- perception, stealth, persuasion, intimidation, investigation,
- simple attack and save outcomes,
- environmental hazard checks,
- basic condition application and expiry markers.

### 8.3 Failure and Cost

Failed actions must still move play forward with cost:

- new complication,
- resource loss,
- position worsened,
- clock advanced.

No hard dead-end failures unless party defeat conditions are met.

## 9. Challenge and Pacing Engine

Challenge pacing must enforce momentum:

- every 1-2 turns: new information or stronger signal,
- every 3-5 turns: escalation, twist, or countdown event,
- at milestones: checkpoint summaries and chapter beat prompts.

Pressure clocks:

- 4-6 segment clocks for immediate scene threats,
- 6-8 segment clocks for chapter-level arcs.

Clock updates must be deterministic from turn outcomes, not random narration drift.

## 10. UI Behavior Requirements

Adventure new screen:

- capture encounter intent in plain language,
- start button launches immediately into playable session.

Session screen:

- show current challenge and active pressure,
- show DM response and choices clearly,
- keep freeform input always available,
- show continuity/checkpoint status,
- support refresh/resume without losing context.

Mobile constraints:

- no clipping,
- no horizontal overflow,
- touch targets stay large enough,
- long text blocks collapse or paginate safely.

## 11. API Surface

Existing endpoints to retain:

- POST /api/adventure/campaign-runtime/turn
- POST /api/adventure/campaign-continuations
- GET /api/adventure/campaign-continuations/:sessionId

Proposed additive endpoints:

- POST /api/adventure/campaign-runtime/start
- GET /api/adventure/campaign-runtime/:sessionId
- POST /api/adventure/campaign-runtime/:sessionId/choice
- POST /api/adventure/campaign-runtime/:sessionId/checkpoint

All new routes must remain under adventure route authority and preserve current idempotency patterns where applicable.

## 12. Safety and Quality Guardrails

Runtime guardrails:

- structured response validation for every AI turn,
- fallback response on malformed model output,
- bounded transcript windows and summarization,
- explicit error codes for user-visible failures,
- trace ids on all runtime turn responses.

Narrative guardrails:

- no forced predetermined path,
- no contradictory continuity state,
- no repeated identical option sets across consecutive turns unless intentionally marked.

## 13. Full Implementation Plan

Phase A: Session start and kickoff hardening

- add runtime start endpoint with encounter intent intake,
- generate guaranteed opening scene plus challenge/options,
- persist initial runtime state.

Phase B: Structured turn engine

- add mode classifier and bounded adjudication path,
- add challenge and pressure state updates,
- return structured dm turn contracts.

Phase C: Continuity and resume model

- persist full runtime state snapshots,
- implement deterministic resume endpoint,
- hydrate session UI on load and refresh.

Phase D: Choice-driven UX and pacing

- render explicit choice actions in session UI,
- add one-click choice submission,
- enforce pacing policy with escalation cadence.

Phase E: Rules-depth expansion

- extend adjudication to more mechanical cases,
- integrate existing combat authority hooks safely,
- improve condition and resource consequence fidelity.

Phase F: Validation and release hardening

- add focused route and state tests,
- expand smoke to include start -> kickoff -> multi-turn -> resume,
- verify performance and mobile usability.

## 14. Validation Matrix

Required validation gates:

- pnpm run typecheck
- pnpm run validate:combat-baseline
- pnpm --filter @workspace/api-server exec tsx --test src/routes/adventure.handoff-route.test.ts
- focused living-character-sheet state tests for runtime helpers
- pnpm --filter @workspace/living-character-sheet run test:smoke:adventure

New tests to add:

- kickoff contract test,
- turn classifier and adjudication mode tests,
- pressure clock progression tests,
- resume fidelity tests,
- choice distinctness regression tests.

## 15. Definition of Done

This runtime is done when:

- player can start from encounter intent and get immediate playable opening,
- each turn returns consequence plus options plus active challenge,
- continuity survives reload and resume,
- choices are meaningful and alter state,
- tests and validation gates pass,
- docs reflect shipped boundaries and deferred items.

## 16. Open Questions

- How much dice visibility should be explicit in player UI versus narrated?
- Should choice buttons be advisory only or strict action templates?
- Which mechanical domains are mandatory in first adjudication release versus later?
- What chapter completion condition transitions runtime to next chapter safely?

## 17. Immediate Next Step

Implement Phase A as the first code pass:

- dedicated runtime start contract,
- guaranteed kickoff DM opening turn,
- persisted initial runtime snapshot,
- smoke coverage for start-to-first-choice path.
