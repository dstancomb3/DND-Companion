# Campaign save recovery and durable checkpoint acknowledgment

## Behavior

Campaign snapshots already carry `clientSavedAt` as a numeric millisecond timestamp.
The database column must be `bigint`, read through Drizzle's number mode. Existing
32-bit integer columns cannot hold `Date.now()` values. Widening preserves old
values and the JSON number contract.

When a database read returns an older snapshot than the in-process fallback, the
store now returns the newer fallback. The comparison occurs after the awaited
database read, so a save during that read is also protected. An older save attempt
does not replace a newer cached snapshot. A newer database snapshot still wins.

Checkpoint POSTs now bypass memory-only success: the snapshot and keyed replay
receipt commit in the same PostgreSQL transaction. A failed transaction returns
503 `campaign_checkpoint_unavailable` with `Retry-After: 3`; the existing client
shows the failure message and retains its session state for manual retry. No
success is sent before the transaction resolves. Snapshot, receipt-completion,
and commit failures are not swallowed. Retrying the same key after rollback can
commit; retrying after a lost commit acknowledgment returns the prior receipt.

## Deployment

1. Back up the intended database and confirm both campaign_continuation_snapshots
   and ai_idempotency_records exist. Keyed checkpoint requests now fail closed if
   either table is unavailable. Provision through the reviewed Drizzle workflow.
2. Review and run `lib/db/migrations/manual/20261021_campaign_timestamp_bigint.sql`
   against that database, before restarting or deploying application workers. The
   script is operator-run, not an automatic migration runner. A five-second lock
   timeout fails the transaction instead of waiting indefinitely. Provision a
   missing table through the existing reviewed Drizzle schema workflow first.
3. Verify `client_saved_at` is `bigint` in `information_schema.columns`.
4. Save and reopen a campaign using a current millisecond timestamp, then verify
   that the row exists and its numeric timestamp matches. Only then restart and
   verify the saved snapshot survives. The new checkpoint POST returns 200 only after database transaction commit;
   verify its matching completed idempotency receipt as well.

No migration was applied to a connected or production database during this work.

## Limits

The compatibility store's memory fallback still exists for reads and legacy
callers, but the checkpoint POST no longer acknowledges it as a durable save.
Pre-upgrade memory-only data is not automatically flushed and can disappear on
restart; resubmit it while the old process is still running before deployment.
There is no offline outbox or automatic client retry. Checkpoint submissions
without an idempotency key are durable but do not gain replay deduplication.

Existing unconditional snapshot upserts still need version/conflict controls for
competing writers. Timestamp comparison is not server-authoritative versioning;
clock skew and equal-timestamp conflicts remain open. Failed deletes and cached
deleted-row reconciliation are unchanged. Legacy processing receipts are not
silently cleared; investigate those individually or wait for existing expiration.

## Rollback

Revert the durable-checkpoint commit if needed and leave the widened column in place.
Doing so restores memory-only success acknowledgments and non-atomic receipts.
Do not narrow it back to integer once millisecond timestamps exist. Restoring the
old reader also restores the cache rollback bug. No saved records are removed by
this migration.

## Validation

Run the focused API `test:campaign-persistence` command. Tests exercise actual
store functions with mocked database boundaries, including outage recovery,
out-of-order cache updates, in-flight reads, cloning, newer durable data, and the
Drizzle timestamp mapping. Live PostgreSQL migration and restart testing remain
deployment acceptance steps.

Focused validation passed: 80 tests across campaign persistence, member sync
guards, remote-apply safety, AI parser/idempotency contracts, non-HTTP adventure contracts, and transactional checkpoint/retry behavior. HTTP endpoint tests were excluded because this environment
cannot bind test sockets; PostgreSQL integration was not run.

Shared-library build and API typecheck pass. Client typecheck still reports the
pre-existing unsupported Feather `sword` icon and missing Node types/`__dirname`
in Playwright configs. The full combat-baseline gate therefore remains blocked.
