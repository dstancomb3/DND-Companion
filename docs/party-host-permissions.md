# Party host permission: disband

Party codes are invitations and remain shareable. For parties created by the
updated API, only the creating device receives a random 256-bit host capability.
The server persists its SHA-256 hash in `party_sessions.host_token_hash` and
requires the capability as an Authorization bearer token for disband. Join,
member and combat-state responses never expose the capability or its hash.
Creation responses are marked `Cache-Control: no-store`.

All three client creation entry points use the same API adapter. It stores the
capability in a separate per-party AsyncStorage key before reporting success.
The ordinary `{ code }` response, watch history and party session sharing do not
include it. A reloaded app can use the saved capability. A failed disband retains
it for retry; successful disband removes it. A local storage failure reports
creation failure, though a server party may already have been created and will
expire normally. There is no token recovery or device transfer yet. Web storage
is accessible to scripts on the app origin; this does not protect against XSS.
Use HTTPS outside local development.

## Rollout

1. Back up the intended database. Run
   `lib/db/migrations/manual/20261022_party_host_token.sql` against it before
   starting the updated server. This adds one nullable text column without
   changing existing party rows. No database was modified by this code change.
2. Deploy the matching API and client. Existing APIs do not issue capabilities;
   the new client reports a readable error instead of pretending it saved one.
   Old clients can join but cannot disband on the updated server.
3. Create a new party. Reload the creating app and verify it can end that party.
   A different device joining by code must receive 403 on disband. Check the
   database contains only a hash, and repeat after a server restart.

The updated Drizzle schema selects the new column, so deploying the API before
the migration will break party database reads. Do not skip the migration.
Existing sessions have a null hash and cannot be claimed from a code. They can
continue normal play and expire normally; create a new party to obtain host
access. Clearing app storage loses the capability. No automatic legacy claim or
ownership reset endpoint is provided.

Rollback API and client together if needed. Leave the nullable column in place;
older code ignores it. Reverting the server reopens code-only disband access.

## Current boundary

This is a narrow disband protection, not complete party authentication. Member
sync/leave ownership, DM mutations, reads, campaign ownership and AI usage limits
still need authorization. Client `isDmOverride` flags are not credentials.
Disband's existing multi-step deletion is not yet transactional. Focused tests
mock the database; real PostgreSQL, HTTP and browser/mobile rollout checks remain
pending. The client and schema changes are necessary to carry and persist the
server-issued capability across reloads; gameplay authority does not change.
