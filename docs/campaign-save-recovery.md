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

## Checkpoint conflict contract

Checkpoint writes use the existing server-issued `submissionId` as a compare-and-
swap token. The request includes `expectedSubmissionId`: null (or omitted for
legacy clients) means create only; a string means replace exactly that existing
server checkpoint. The database performs either an insert-on-conflict-do-nothing
or an update conditioned on both session ID and submission ID. This avoids a
read-then-write race and does not rely on device clocks. Missing/deleted rows and
stale tokens return 409 `campaign_checkpoint_conflict`; the transaction rolls
back its receipt reservation along with the rejected write. Committed same-key
replays still return the original response without rewriting newer state.

New server checkpoint IDs use UUIDs rather than millisecond-only identifiers.
GET reads used for version tokens are database-only. Database outages return 503,
not a cached token or a false not-found result. Compatibility cache helpers still
exist, but are not the checkpoint HTTP authority path.

The session client loads the base token before saving, sends it unchanged, and
advances it only to the token returned by its own successful save. A conflict
preserves local work and does not silently adopt the competing checkpoint token,
merge, or retry. Reopen and review the latest checkpoint before resubmission.
Save completion no longer triggers a background read that could adopt another
device's token unnoticed. Fetch results from a previous session cannot supply the
active session's base token.

Deploy client and server together. Older clients can create a checkpoint, but
updates without a base token are intentionally rejected instead of silently
overwriting it. This is a required compatibility tightening. Tokens are not
credentials and do not replace authentication or DM permissions.

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

The compatibility writer still has an unconditional upsert, but the checkpoint
HTTP path now uses compare-and-swap. No automatic merge, outbox or role-based
access model is added. Existing anonymous callers with a current token are still
able to write; authorization remains a separate audit task. Failed deletes and
cached deleted-row reconciliation outside the durable API path are unchanged.
Legacy processing receipts are not silently cleared.

## Rollback

Revert client and server conflict-guard changes together if needed. This removes
stale-write protection, so avoid concurrent checkpoint edits after rollback. No
schema change is introduced by the version-token guard.


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

Focused validation passed: 87 server tests plus 3 client API tests across campaign persistence, member sync
guards, remote-apply safety, AI parser/idempotency contracts, non-HTTP adventure contracts, and transactional checkpoint/retry behavior, stale-token conflicts and durable token reads. HTTP endpoint tests were excluded because this environment
cannot bind test sockets; PostgreSQL integration was not run.

Shared-library build and API typecheck pass. Client typecheck still reports the
pre-existing unsupported Feather `sword` icon and missing Node types/`__dirname`
in Playwright configs. The full combat-baseline gate therefore remains blocked.

Five conflict/ID regressions fail on the prior implementation. Session UI
interaction, real concurrent PostgreSQL transactions, and two-device browser
checks remain manual/deployment acceptance steps; database boundaries were
mocked. Client API tests verify token transmission and non-retrying conflict
handling, not full screen interaction.
