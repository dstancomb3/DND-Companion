# AGENTS.md: Canonical Agent Operating Guide

Use this file as the root, canonical guide for safe edits in this repository.

## Before Coding

- Read:
  - .github/copilot-instructions.md
  - docs/app-map.md
  - docs/feature-status.md
  - docs/migrations.md
  - docs/implementation-log.md
- Map the exact module and authority boundary before editing.
- Check whether the area is stable, partial, intentionally limited, or deferred.

## During Coding

- Prefer narrow, reversible edits.
- Do not move authority boundaries without explicit justification.
- Preserve compatibility paths in migration zones unless a migration is explicitly completed and documented.
- Avoid claiming completion for partial systems.

## After Coding

- Summarize changed files and risks.
- State what remains deferred.
- Update docs/feature-status.md and docs/migrations.md when system status changes.

## Current Validation Baseline

- pnpm run typecheck
- pnpm run validate:combat-baseline
- When touching remote apply authority or AI idempotency routes, run:
  - pnpm --filter @workspace/api-server exec tsx --test src/routes/party.remote-apply-route.test.ts
  - pnpm --filter @workspace/api-server exec tsx --test src/routes/ai/idempotency-route-safety.test.ts
- Add focused targeted tests for touched paths when making behavior-sensitive changes.

## Current Deferred Priorities (Honest Backlog)

1. Roll out DB schema provisioning for server-side AI idempotency records in all environments.
2. Complete combat remote-authority apply path beyond current HP/tempHP remote outcome support.
3. Remaining schema convergence/cutover cleanup.

## Note for Instruction Copies

Files under .github/instructions/ mirror this guidance for instruction loading.
When they drift from root docs, root docs are authoritative and both copies should be reconciled in the same change.

## Implementation Scope and Audit Tracking

Use [the implementation log](docs/implementation-log.md) before selecting work.
State the finding IDs and authority boundary, and update the finding status and
PR history with validation/rollout limits in the same implementation change.
Keep original findings separate from later undo/item audits. Containment is not
feature completion; merged is not deployed. Preserve REC-01 until the original
numbered audit is recovered rather than inventing a 15-item completion count.
