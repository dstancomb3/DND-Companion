# Runtime validation baseline

## 2026-10-22 baseline repair

Validated on Linux with Node 24.19.0 and pnpm 11.25.0. Windows/Node 20 execution
and browser/mobile testing remain separate acceptance steps.

- `pnpm install --frozen-lockfile`: passes without resolving a new dependency graph.
- `pnpm run validate:combat-baseline`: passes, including the root workspace
  typecheck and all 24 existing combat safety tests.
- 90 focused API/store/contract tests: pass via `node --import tsx --test`, with
  database boundaries mocked and HTTP endpoint tests excluded.
- 3 checkpoint client API tests: pass via `node --import tsx --test
  tests/state/campaign-checkpoint-api.test.mts` in the client workspace.

The root workspace typecheck now checks both Expo app code and the two Playwright
configuration files. Playwright configs are excluded from the Expo project and
checked separately with `tsconfig.playwright.json` and an explicit Node type
dependency. This keeps the Node-specific configuration check separate from the
Expo compiler settings.

The unsupported Feather `sword` glyph in Encounter Actions was replaced with the
supported `crosshair` glyph. No gameplay behavior changed.

The combat safety file was renamed from `.mts` to `.cts` to match the app's
CommonJS package. Its contents, assertions and test count are unchanged. The
baseline script invokes Node's test runner with the tsx loader directly, avoiding
the tsx CLI's IPC socket and the ESM-to-CommonJS named-export failure.

The lockfile's React Query catalog claimed `^5.100.10` but recorded `5.99.0`, while
the app already recorded `5.100.10`. The catalog and shared API client's importer
now agree on the already-locked `5.100.10` version. The only additional importer
entry is the client's explicit Node type dependency, also already locked. Package
resolution records and transitive snapshots are unchanged; no new package
versions were introduced by this repair.

## Not established by these checks

This is not a full release gate. Real PostgreSQL transaction/concurrency tests,
checkpoint save/reload and server-restart QA, HTTP/browser smoke tests, full
combat QA, and mobile layout validation remain pending. The user's successful
database table setup does not establish those gameplay/persistence results.

No database migration or connected database write was performed during this
baseline repair. The runtime authority map and roll-stall diagnosis from the
convergence plan are still separate work.


## T01-PG1: scoped CI and PostgreSQL acceptance (2026-10-24)

[PR #35](https://github.com/dstancomb3/DND-Companion/pull/35) adds the Party lifecycle
PostgreSQL workflow. [Run 40112334408](https://github.com/dstancomb3/DND-Companion/actions/runs/40112334408)
passed a frozen install under Node 20.20.2/pnpm 10.33.0, all workspace typechecks
(including integration sources), 24 combat baseline tests, 613 scoped regressions,
eight safety guards and 11 actual PostgreSQL 16.15 HTTP/lifecycle checks using two
API processes. All PG tests executed with zero skips and schema cleanup logged.

This supersedes earlier pending statements for that lifecycle scope, not campaign
checkpoint/crash/restart, full combat/AI DM, browser/mobile/Windows acceptance or
all repository tests. The workflow is not itself a configured branch-protection
rule. Test DB setup is automatic in CI; no user database or cloud setup is needed.
