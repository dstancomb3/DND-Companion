# Party member ownership: enrollment, sync and leave

Party codes remain invitations. `POST /api/party/:code/register-member` creates
a new UUID member with a random private capability, reusing the existing host
capability cryptography. Caller-supplied member IDs or token hashes are ignored.
The server stores only `party_members.member_token_hash` and returns the private
token once with `Cache-Control: no-store`. Public member projections exclude
the hash. The insert validation schema also excludes this persistence-only field.
A newly enrolled row displays “Joining player” until its first authenticated sync.

`PUT /api/party/sync` requires that member's bearer capability for that exact
party/member pair before runtime hydration, freshness/replay processing, or
writes. A host capability cannot sync another player. Sync updates existing rows
only, with the persisted hash included in the update predicate; if removal wins
before the update, sync returns 403 and cannot recreate the row. The previous
stale/replay guard remains in place after authorization.

`DELETE /api/party/leave` accepts either the affected member's capability or the
original party host capability. The DM removal action sends the host proof;
client role flags grant no permission. Legacy rows with no member hash can be
removed by a credentialed host, but cannot be claimed by another player.

## Client behavior

The shared adapter stores private tokens separately from shareable session data,
keyed by party and member. A separate local party/character lookup resumes the
same registered identity across reloads, without sending a character-derived ID
as authorization. Creation/join, normal sync, leave, DM removal and demo seeding
all use this contract. Demo joining explicitly passes its seeded character
snapshot so it does not depend on React finishing a character switch first.

Successful leave removes local member proof. A server `party_member_required`
rejection invalidates local proof and stops the active session with a rejoin
message. Network errors retain credentials for retry. Late authorization failures
from a previous party do not disconnect a newly joined party. Local leave keeps
its existing behavior of disconnecting even when the server is unreachable;
it does not establish that the remote member was removed.

Storage or acknowledgment failure during enrollment may leave a server member
without a usable local credential. Enrollment has no idempotent receipt yet;
retrying can create another member. Hosts can remove abandoned enrollment rows.
AsyncStorage is not a hardware credential vault; origin scripts can access web
storage. Clearing it loses access. There is no recovery/device transfer flow.

## Required migration and rollout

1. Back up the intended database. Apply the previous host migration and then
   `lib/db/migrations/manual/20261022_party_member_token.sql` before starting
   this API. The new migration adds a nullable text column. No database was
   modified while implementing this change.
2. Deploy the matching API and client together. Old clients cannot sync or leave
   under this contract, and old APIs do not provide enrollment. Drizzle selects
   include the new column, so running the updated API before migration breaks
   member reads, not just enrollment.
3. Rejoin with the updated client. Legacy local sessions without a private token
   are cleared with a rejoin message. Legacy server rows remain unclaimed and
   are not silently reassigned. Rejoining creates new member IDs, so old initiative,
   requests and encounter references do not migrate to those IDs. Prefer a fresh
   party for a clean cutover; local character data remains intact.
4. Test two players and a host: each player can sync/leave their own member;
   changing member/party IDs with the same token returns 403; the host can remove
   a player; that player's next sync cannot recreate the row. Reload clients and
   restart the server to check persisted proof. Test demo bootstrap separately.

Rollback API and client together and leave both nullable columns in place.
Reverting the API reopens unauthenticated sync/removal. No automatic schema or
connected database migration is performed by this change.

## Remaining boundary

This protects enrollment identity and direct sync/leave only. Other party routes,
including remote combat application, initiative, rolls, loot, note acceptance/decline, NPCs and
rest workflows, still need caller/host authorization. Some can indirectly mutate
member HP or conditions, so this is not complete character-state protection.
Read access, invite limits, campaign ownership, AI quotas and transactional
member/runtime commits remain deferred. Removal is not a ban: anyone retaining
the invitation code can register a new member. Concurrent removal after the
member update can still race a later runtime write; no full serialization is
claimed. PostgreSQL, browser/mobile, HTTP and restart acceptance remain pending;
focused tests use mocked database boundaries.

The OpenAPI source documents enrollment and bearer requirements for sync,
leave and disband. These flows use the hand-written `partyApi.ts` client;
generated React/Zod bindings are not regenerated by this slice. Existing
GenericObject contracts remain in their migration zone.


DM note creation separately requires original-host proof under O02-A1; it does
not use a member token or authorize recipient actions. See the
[route permission map](party-permission-map.md) for all current boundaries.
