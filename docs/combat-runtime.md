# Combat Runtime: Current State (Reconciled)

This is the current, conservative combat runtime status after Phases 1-8.

## What Is Implemented

- Combat resolution safety tests exist and are runnable via root validation scripts.
- Authority metadata is explicit in combat outcome paths for local apply decisions.
- Local apply paths are guarded by authority checks to prevent unsafe remote mutation.
- Preview-only remote member/NPC outcomes have a server apply path for HP/tempHP consequences with fail-closed source-member/turn-ownership guards.

## What Is Partial

- Full remote-authority apply path is not complete.
- Combat authority is still split across client contexts and server party/combat state routes.
- Runtime centralization is partial; do not claim a fully unified combat engine yet.

## Intentionally Limited

- Remote members and NPC outcomes remain conservative where mutation authority is not fully available.
- No broad architecture rewrite was introduced during Phases 1-8.

## Deferred Follow-Up

1. Complete remote-authority mutation apply path safely.
2. Continue convergence of combat authority boundaries without regressing current safety guards.

## Validation Commands

- pnpm run typecheck
- pnpm run validate:combat-baseline
