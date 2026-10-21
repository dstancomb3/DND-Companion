# Architecture Overview: Character Companion (Reconciled)

This document summarizes the real architecture after Phases 1-8.
It focuses on authority boundaries and known limits, not aspirational systems.

## Runtime Architecture

- Client app authority:
  - artifacts/living-character-sheet/
  - Context orchestration in context/ and UI flows in app/
- API authority:
  - artifacts/api-server/src/routes/
  - Party sync conflict and stale snapshot handling in routes/party.ts
- Schema/contract authority:
  - lib/api-zod/
  - lib/api-spec/openapi.yaml

## Stabilized Through Phases 1-8

- Validation baseline and combat safety command path.
- Combat outcome authority hardening for local apply gating.
- Progression/rules rollout with deterministic guardrails.
- State/sync/mutation hardening including queue idempotency and stale snapshot rejection.
- Monster compendium cache/performance hardening with explicit cache metadata.

## Intentionally Conservative Boundaries

- Remote combat mutation authority remains partial.
- AI replay dedupe is implemented on both client queue semantics and server-side durable idempotency for key AI routes; deployed environments still require DB schema provisioning rollout.
- Schema/data convergence continues to preserve compatibility fields.

## Canonical Status and Backlog

- Canonical module map: docs/app-map.md
- Canonical feature status and short backlog: docs/feature-status.md
- Migration and cutover log: docs/migrations.md

## Practical Validation

- pnpm run typecheck
- pnpm run validate:combat-baseline
- Focused state tests when touching sync/cache logic:
  - pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/mutation-sync-hardening.test.mts
  - pnpm --filter @workspace/living-character-sheet exec tsx --test tests/state/monster-cache-plan.test.mts
