# Campaign save recovery: bounded persistence fix

## Behavior

Campaign snapshots already carry `clientSavedAt` as a numeric millisecond timestamp.
The database column must be `bigint`, read through Drizzle's number mode. Existing
32-bit integer columns cannot hold `Date.now()` values. Widening preserves old
values and the JSON number contract.

When a database read returns an older snapshot than the in-process fallback, the
store now returns the newer fallback. The comparison occurs after the awaited
database read, so a save during that read is also protected. An older save attempt
does not replace a newer cached snapshot. A newer database snapshot still wins.

## Deployment

1. Back up the intended database and confirm the table exists.
2. Review and run `lib/db/migrations/manual/20261021_campaign_timestamp_bigint.sql`
   against that database, before restarting or deploying application workers. The
   script is operator-run, not an automatic migration runner. A five-second lock
   timeout fails the transaction instead of waiting indefinitely. Provision a
   missing table through the existing reviewed Drizzle schema workflow first.
3. Verify `client_saved_at` is `bigint` in `information_schema.columns`.
4. Save and reopen a campaign using a current millisecond timestamp, then verify
   that the row exists and its numeric timestamp matches. Only then restart and
   verify the saved snapshot survives. A 200 ingest response alone does not prove
   durability while the existing fallback behavior remains in place.

No migration was applied to a connected or production database during this work.

## Limits

This is not a durable outbox. Memory-only saves still disappear on process loss,
are not shared between workers, and are not automatically flushed on recovery.
Resubmit the current snapshot while the database is healthy to persist it before
restarting. Existing unconditional database upserts still need version/conflict
control for competing writers. Timestamp comparison is a compatibility measure,
not server-authoritative versioning; clock skew and equal-timestamp conflicts
remain open. Failed deletes and deleted-row cache reconciliation are unchanged.

## Rollback

Revert the application commit if needed and leave the widened column in place.
Do not narrow it back to integer once millisecond timestamps exist. Restoring the
old reader also restores the cache rollback bug. No saved records are removed by
this migration.

## Validation

Run the focused API `test:campaign-persistence` command. Tests exercise actual
store functions with mocked database boundaries, including outage recovery,
out-of-order cache updates, in-flight reads, cloning, newer durable data, and the
Drizzle timestamp mapping. Live PostgreSQL migration and restart testing remain
deployment acceptance steps.

Focused validation passed: 71 tests across campaign persistence, member sync
guards, remote-apply safety, AI parser/idempotency contracts, and non-HTTP
adventure contracts. HTTP endpoint tests were excluded because this environment
cannot bind test sockets; PostgreSQL integration was not run.

Shared-library build and API typecheck pass. Client typecheck still reports the
pre-existing unsupported Feather `sword` icon and missing Node types/`__dirname`
in Playwright configs. The full combat-baseline gate therefore remains blocked.
