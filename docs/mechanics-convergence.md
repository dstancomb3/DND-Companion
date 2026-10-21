# Mechanics and Schema Convergence (Reconciled)

This document tracks the remaining convergence work after Phases 1-8.

## Current Reality

- Converged mechanics and progression paths advanced in Phase 6.
- Party/sync/runtime schema surfaces were hardened in Phase 7.
- Monster compendium product/performance paths were hardened in Phase 8.

## Still In Progress

- Full legacy field retirement is not complete.
- Some adapter boundaries remain mixed across scripts, client utilities, and server routes.
- Open5e and compatibility pathways are still needed for existing data flows.

## Intentionally Limited

- No destructive migration pass was performed to force full convergence.
- No speculative broad rewrite was introduced beyond targeted hardening.

## Deferred Convergence Backlog

1. Continue explicit schema cutover with compatibility verification at each step.
2. Remove legacy compatibility fields only when all consumers are migrated and documented.
3. Keep docs/migrations.md updated for each migration/cutover step.

## Related Canonical Docs

- docs/feature-status.md
- docs/app-map.md
- docs/migrations.md
