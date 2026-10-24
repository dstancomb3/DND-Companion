# Isolated PostgreSQL lifecycle checks

This is test infrastructure for T01 and O02 lifecycle acceptance, not cloud hosting
or a production database migration. GitHub Actions provisions PostgreSQL 16 and
runs the current TypeScript server in two separate processes. No account secrets,
AI provider keys or user database URL are used by the workflow.

The runner requires RUN_POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing at
loopback PostgreSQL database dnd_companion_ci, with no query/fragment options.
It never reads .env or falls back to DATABASE_URL. It creates one random dnd_it_
schema, exports party table DDL from the repository's Drizzle model, scopes foreign
keys and all child connections to that schema, and removes that schema on exit.
It does not create/drop the database, alter public tables or run schema push.
An abrupt process/machine kill can leave an isolated schema; the CI service itself
is disposable. Local users may remove only their recorded dnd_it_ schema afterward.

The suite uses real HTTP against independent API worker processes and durable SQL
assertions. It covers companion preservation, admission/leave/recovery, replay,
first-row concurrency, both queued admission/departure orders and competing host
recovery. Real row-lock waits are observed through pg_stat_activity. Triggers force
runtime-write, member-delete and deferred-commit failure to check rollback. Locks
can produce 409 serialization conflicts; explicit retries are made only after
checking committed membership, never hidden inside application code.

The suite also checks a warmed second worker sees a detachment committed elsewhere.
That regression exposed the cached combat-state GET; that route now reads durable
state and current members without publishing an in-flight cached projection.
Other cached mutation paths and public read authorization are not completed here.

Commands from project root:
- pnpm run test:party-postgres-guards checks refusal of unsafe/missing targets.
- pnpm run test:party-postgres requires an already running disposable local PG
  server plus the two explicit environment variables above.
- GitHub's Party lifecycle PostgreSQL workflow supplies that server automatically,
  alongside frozen install, typechecks, combat baseline and scoped route/client tests.

PostgreSQL suite execution is required for this CI job to pass; it is never skipped
because a database URL is absent. The check is not automatically a branch-protection
rule. Initial CI execution and PostgreSQL results are recorded in the implementation
log; writing a workflow is not evidence that it ran successfully.

These tests do not establish browser/mobile rendering, AI behavior, all mutation
races, production PG configuration, durable rollback/undo, crash recovery or complete
party authorization. Cloud setup and the reported icon-font issue remain paused/open.


## First verified execution

[CI run 40112334408](https://github.com/dstancomb3/DND-Companion/actions/runs/40112334408)
passed with Node 20.20.2, pnpm 10.33.0 and PostgreSQL 16.15. All 11 real database
tests passed with zero skips; logs confirm the random schema was removed.
The same job passed workspace typechecks, 24 combat tests, 613 scoped regressions
and eight runner guards. The first attempt caught an optional IPC-disconnect type
error in the new worker, corrected before this successful run. This validates
the tested lifecycle/failure orders, not every possible scheduling interleaving.
