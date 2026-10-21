
# Repo Engineering Rules: Character Companion

This file is the authoritative engineering ruleset for this repo. All agents and contributors must follow these rules to avoid breaking critical boundaries, corrupting data, or regressing architecture convergence.

## Research-Before-Edit Workflow

- **Always read**: This file, `docs/app-map.md`, `docs/feature-status.md`, and `AGENTS.md` before making any change.
- **Map the code**: Identify the real module, context, or route you intend to change. Do not guess based on filenames or old docs.
- **Verify authority**: Determine which layer (client, server, adapter, schema, context) is authoritative for the logic you are touching. Do not move or duplicate authority without explicit justification.
- **Check migration/cutover state**: If the area is in migration or cutover (see `docs/mechanics-convergence.md`, `docs/migrations.md`), do not make broad changes. Work incrementally and document all edits.
- **Respect legacy/converged boundaries**: Do not erase legacy compatibility fields or code unless the migration is fully complete and documented.

## Safe Edit Principles

- **Never break authority boundaries**: Do not move logic between client/server, context, or adapter layers without deep research and explicit documentation.
- **No over-broad rewrites**: Prefer small, targeted edits. Large refactors are forbidden unless explicitly justified and reviewed.
- **No silent data overwrites**: All data migrations, schema changes, or normalization edits must be explicit and documented in `docs/migrations.md`.
- **No duplicate systems**: If a feature exists in any form, extend or migrate it—never fork or duplicate logic.
- **Preserve partial/migrating systems**: If a system is in active migration, do not flatten or "finish" it without confirming all edge cases and legacy compatibility.

## Repo-Specific Cautions

- **Combat, quest, and party systems** are partial or in flux. Do not claim completion or erase stubs unless code and docs both confirm full implementation.
- **Schema convergence** is ongoing. Do not assume all data is unified; check Zod schemas, OpenAPI, and migration scripts.
- **Adapters and normalization**: Boundaries may be fuzzy. Document any changes to adapter logic or data flow.
- **Legacy compatibility**: Some fields and data formats are still required for old data. Do not remove without migration plan.
- **UI/UX**: Mobile-first and session-speed are critical. Do not introduce UI regressions or slowdowns.

## How to Distinguish Stable vs. Migration Zones

- **Stable**: Marked as such in `docs/feature-status.md` and code is not in active migration.
- **Migration/Partial**: Marked as partial, in-progress, or under migration in docs. Code may have both legacy and new logic side-by-side.
- **Planned**: Not yet implemented, or only stubbed.

## How to Work Safely in Mixed Legacy/Converged Areas

- Always check for both legacy and new code paths.
- Do not remove legacy logic unless all consumers are migrated.
- Document all edits and migration steps in `docs/migrations.md`.

## How to Avoid Breaking the Repo

- Never edit more than one authority boundary in a single PR unless absolutely necessary.
- Always run and test both client and server after changes.
- List all risks and affected modules in your PR or agent summary.

## For Future Agents

- If code or docs are ambiguous, call it out explicitly in your summary and do not guess.
- When in doubt, prefer conservative, reversible edits.
- Always update this file if you discover new repo-specific risks or patterns.