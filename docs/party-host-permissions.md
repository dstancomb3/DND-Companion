# Party host permission: disband and DM note creation

Party codes are invitations and remain shareable. For parties created by the
updated API, only the creating device receives a random 256-bit host capability.
The server persists its SHA-256 hash in `party_sessions.host_token_hash` and
requires the capability as an Authorization bearer token for disband and
DM note assignment creation. Join,
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
Existing sessions have a null host hash and cannot be claimed from a code.
The subsequent member-ownership rollout requires players to rejoin for new member
credentials; see [Member ownership](party-member-permissions.md). Create a new
party to obtain host access. Clearing app storage loses the capability. No automatic legacy claim or
ownership reset endpoint is provided.

Rollback API and client together if needed. Leave the nullable column in place;
older code ignores it. Reverting the server reopens code-only disband access.

## Current boundary

These are narrow disband and DM note-authoring protections, not complete party authentication. The
subsequent [member ownership slice](party-member-permissions.md) protects direct
sync/leave. Remaining DM mutations, reads, campaign ownership and AI usage limits
still need authorization. Client `isDmOverride` flags are not credentials.
Disband's existing multi-step deletion is not yet transactional. Focused tests
mock the database; real PostgreSQL, HTTP and browser/mobile rollout checks remain
pending. The client and schema changes are necessary to carry and persist the
server-issued capability across reloads; gameplay authority does not change.


## O02-A1 note-authoring extension (2026-10-22)

POST /party/:code/note-assignments now reuses the original host proof before
session activity/expiration side effects or runtime work. The client uses the
same stored host token; assignedBy/DM flags are not authority and the server
stamps DM origin. Old clients and legacy unclaimed parties fail closed for this
operation. No new schema migration; matching client/API required. Recipient
accept/decline, private read policies, loot award/transfer authorization and
durable claim/save receipts remain open. See the complete
[party permission map](party-permission-map.md) and [implementation log](implementation-log.md).

O02-A2 subsequently adds live recipient-member proof for note accept/decline;
host proof is not a substitute. Recipient persistence/recovery and open reads
remain separate gaps. See the updated route map.


## O02-A4 rest approval authorization (2026-10-22)

Rest approval/denial now requires the original-host bearer capability before
session activity, expiration cleanup or runtime access. The server derives DM
origin; the matching client sends existing persisted host proof through the host
adapter. Existing validation and response contracts are retained. No new schema
migration; provision the existing host column before the matching client/API.
Old clients and legacy/unclaimed parties fail closed; delegation/recovery is not
added. Roll back client/server together if necessary, leaving capability columns
intact; server rollback reopens the authorization gap. No deployment or connected
DB write was performed. O02 remains partial: sixteen mutation handlers, read
privacy, concurrent authorization/commit and transactional rest recovery remain
open. See [route map](party-permission-map.md) and [implementation log](implementation-log.md).


## O02-A5 encounter control authorization (2026-10-22)

Initiative start, encounter participant addition and encounter end now require
original-host proof before session activity/expiry or runtime work. Existing DM,
demo and AI DM callers share the host adapter; signatures/results are retained.
AI DM controls require the party-creator device's capability. Joined players and
watchers are not delegated hosts; missing local proof prevents a request and
existing tool/error paths report failure. DM initiative-start now catches and
shows errors. Existing target/battle filtering, ordering and unrelated battles
are preserved. See [caller map](party-permission-map.md).

No new schema migration; provision existing host capability column and deploy
matching client/API. Operator verified the configured DB column in the previous
rollout; other environments are unverified. Old clients fail closed. Revert
client/API together if needed, leaving columns intact; server rollback reopens
unauthorized controls. No deployment or connected DB write performed by this pass.
O02 remains partial: 13 mutation handlers, open reads, delegated roles, concurrent
authorization/commit and complete AI orchestration still need work. Existing
campaign reuse can reach ungated NPC/roll endpoints. QA-N02 quest completion and
QA-N01 live notes retest remain pending at the user's direction.

Focused DB/storage tests are mocked. Existing encounter regressions use temporary
byte-identical .cts copies for the CommonJS package. Legacy HTTP smoke fixtures
still use pre-capability enrollment/authorization and need a separate fixture
migration; this pass does not claim they or browser/mobile/real DB acceptance pass.
Validation details and exact files are in the [implementation log](implementation-log.md).
