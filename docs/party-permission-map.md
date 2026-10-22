# Party route permission map and note authorization boundaries

Inspected baseline: main `55f78ee698b60e058af05ceea619e8b10fcc5bb3`, 2026-10-22.
Finding: O02 (original party/DM authorization), with U09 as a related dependency.
This is a route map and bounded remediations, not an application-wide
authentication or authorization completion claim.

## Authority and method

Source: [party routes](../artifacts/api-server/src/routes/party.ts),
[host client adapter](../artifacts/living-character-sheet/utils/partyHostApi.ts),
[party API client](../artifacts/living-character-sheet/utils/partyApi.ts),
[host proof](../artifacts/api-server/src/lib/partyHostToken.ts),
[member permissions](party-member-permissions.md).

The server decides permission from persisted capability hashes. Invitation codes,
member IDs, assignedBy/resolvedBy and isDmOverride flags are identifiers or display
data, not proof. Existing gameplay checks for actor/turn/target identity are
necessary but do not authenticate the caller.

The table accounts for all 33 declared party handlers. It describes application
route-level proof, not network/gateway protection or a penetration test. Bootstrap
access is intentionally distinct from member/DM privilege. Proposed policies in
open rows are design requirements for later bounded passes, not implemented
permissions or newly approved broad changes.

After O02-A4: twelve handlers have explicit capability proof (sync, leave,
disband, note creation/accept/decline, member initiative, roll response, rest
request/approval/acknowledgement and loot claim); three are bootstrap handlers; two are
open read handlers; 16 are open mutation handlers. Counts are declarations, not a security-completion
percentage. Some GET/session helpers have writes.

| Method | Route (under /api) | Current caller proof | Effect | Remaining boundary / policy |
| --- | --- | --- | --- | --- |
| POST | `/party/create` | Bootstrap | Issue session + host capability | Creation is public; abuse limits/recovery remain open. |
| POST | `/party/join/:code` | Invite bootstrap | Validate/share party invitation | Code is an invitation, not DM/member authority; private-read policy remains open. |
| POST | `/party/:code/register-member` | Invite bootstrap | Issue member UUID + private capability | Caller cannot choose/claim existing identity; enrollment abuse limits remain open. |
| PUT | `/party/sync` | Member proof | Own member projection + runtime sync | Existing exact party/member token check; further serialization/races remain open. |
| GET | `/party/:code/members` | Open read | Member/stat projection; expiry handling | No caller proof. Decide scoped read/DM-secret policy; do not infer read authorization from code. |
| DELETE | `/party/leave` | Member or host proof | Remove self or host-remove another member | Existing proof; removal is not a ban, and runtime serialization remains open. |
| POST | `/party/:code/disband` | Host proof | Delete session/members/runtime | Existing original-host check; delegated DM/recovery not implemented. |
| GET | `/party/:code/combat-state` | Open read | Read/hydrate runtime; refresh activity | No caller proof; read privacy and pre-auth activity/expiry side effects remain open. |
| POST | `/party/:code/initiative/start` | Open mutation | Start initiative/change participants and order | Proposed host policy; member inclusion alone is not caller proof. |
| PUT | `/party/:code/initiative/roll` | Member proof | Submit member initiative | Live own-member proof before activity/runtime work; existing member/reroll checks retained. DM override is not granted by this route. |
| POST | `/party/:code/end-turn` | Open mutation | Advance battle turn; optional isDmOverride | Proposed current-actor member proof or host; caller DM flag is not authority. |
| POST | `/party/:code/economy/spend` | Open mutation | Spend member turn economy | Proposed own-current-actor proof and existing economy validation. |
| POST | `/party/:code/economy/reset` | Open mutation | Reset member turn economy | Requires explicit reset/host policy; memberId alone is not proof. |
| POST | `/party/:code/combat/apply-outcomes` | Open mutation | Apply bounded remote HP/temp HP/conditions | Existing source/turn/target checks are business validation, not caller authentication. Prove source ownership or explicit host authority. |
| POST | `/party/:code/roll-requests` | Open mutation | Create roll prompts | Proposed host or explicit authorized orchestrator role; no caller DM flag. |
| PUT | `/party/:code/roll-requests/:requestId/respond` | Target-member proof | Record/replace target member roll response | Live exact-member proof plus existing request-target check. Dice/modifier fairness and durable roll authority remain separate. |
| POST | `/party/:code/rest-requests` | Member proof | Request rest for member | Live requester proof; existing party-wide rest request semantics retained. Host proof is required on the separate approval route. |
| PUT | `/party/:code/rest-requests/:requestId` | Host proof (O02-A4) | Approve/deny rest | Original-host proof before activity/expiry/runtime work; server stamps resolvedBy as dm. |
| PUT | `/party/:code/rest-requests/:requestId/ack` | Target-member proof | Acknowledge recipient rest application | Live exact-member proof plus approved-state/target checks; local/server receipt atomicity remains U08. |
| POST | `/party/:code/events` | Open mutation | Append event with member/metadata labels | Proposed member/host policy with permitted event kinds; labels cannot grant state authority. |
| POST | `/party/:code/loot-assignments` | Open mutation | DM awards AND player-to-player item transfers | Do not make blindly host-only. Need distinct host award/member-owned transfer proof; server currently lacks complete inventory ownership/debit authority. |
| PUT | `/party/:code/loot-assignments/:assignmentId/claim` | Recipient member proof | Mark assignment claimed | Live exact-member proof plus target check. Claim-first/local-inventory-save recovery remains open (I13/U08). |
| POST | `/party/:code/note-assignments` | Host proof (O02-A1) | Create DM quest/people/location assignments | Authenticate original host before activity, expiry cleanup, member reads or runtime hydration. Server stamps DM origin. |
| PUT | `/party/:code/note-assignments/:assignmentId/accept` | Recipient member proof | Mark DM notes accepted | Live exact party/member proof plus assignment target check. Local journal save/recovery remains separate. |
| PUT | `/party/:code/note-assignments/:assignmentId/decline` | Recipient member proof | Decline/remove assignment | Live exact party/member proof plus assignment target and accepted-state checks. |
| POST | `/party/:code/combat-npcs` | Open mutation | Create/seed NPC or dummy in runtime | Proposed host proof; template vs instance authority needs explicit mapping. |
| PUT | `/party/:code/combat-npcs/:npcId/dummy-state` | Open mutation | Update NPC/dummy state | Proposed host proof and referenced instance/battle scope. |
| PUT | `/party/:code/combat-npcs/:npcId/gear` | Open mutation | Replace NPC gear | Proposed host proof; canonical effect validation remains separate. |
| PUT | `/party/:code/combat-npcs/:npcId/visible-stats` | Open mutation | Choose NPC stats visible to players | Proposed host proof; audience-limited read projection remains separate. |
| DELETE | `/party/:code/combat-npcs/:npcId` | Open mutation | Remove NPC and runtime references | Proposed host proof and aggregate serialization. |
| DELETE | `/party/:code/encounters/:battleId` | Open mutation | End/remove encounter and related state | Proposed host proof; authorized reversal/history not implemented. |
| POST | `/party/:code/encounters/:battleId/participants` | Open mutation | Add encounter members/NPCs | Proposed host proof and live referenced-object scope. |
| PUT | `/party/:code/combat-npcs/:npcId/initiative` | Open mutation | Set NPC initiative | Proposed host proof and NPC/battle scope. |

## O02-A1: authenticated DM note authoring

Only POST /party/:code/note-assignments changes in this pass.

Before: anyone with an invitation code could create quests/people/locations
assignments and label the origin DM. The route refreshed session activity,
hydrated runtime and persisted assignments without private caller proof.

After: load the session host hash and verify the Authorization bearer capability
before calling ensureActiveSession or doing member/runtime work. Missing/incorrect
proof, a member token, another party's host token, a hash used as a bearer token,
body tokens/DM flags and legacy unclaimed sessions cannot create assignments.
Denials return 403 party_host_required with no activity, expiration cleanup,
member reads, runtime hydration or writes. Unknown sessions return 404.
Authenticated host requests retain the existing active-session/payload/target
checks and runtime persistence. Assignment origin is stamped dm by the server,
rather than copied from assignedBy.

The client reuses the existing per-party private host token in partyHostApi.
The existing createPartyNoteAssignments export now delegates to it, so DM UI
callers continue using the same function. Requests keep JSON content type, keep
proof out of the body, and retain proof after request failure. No automatic retry
or exactly-once delivery is introduced.

Loot assignment creation deliberately remains unchanged: app/party.tsx uses it
for player transfers as well as app/dm-party.tsx for DM awards. A host-only patch
there would regress player sending and would not prove inventory ownership.

## Deployment, compatibility and rollback

- No new database column or migration. The existing host-token migration must
  already be applied. Deploy the matching API/client together; old clients send
  no bearer proof and now fail closed when sending notes.
- Privilege in this bounded model belongs to the original host capability, not
  to a device merely watching the DM screen. Legacy/unclaimed parties or another
  device without stored host proof cannot send DM notes. Recreate a party from
  the intended host device if no valid proof exists; do not claim an old party
  by its public code. Delegation, capability recovery and rotation are separate.
- Existing UI error handling shows the missing-host/delivery error and retains
  the party connection. Private token storage is not put in shareable history.
- O02-A2 subsequently protects recipient accept/decline. Note visibility in open
  combat-state reads and local journal/server commit recovery remain open.
  Protecting these routes does not make the entire notes workflow transactional.
- Authorization and the later session/runtime commit are not one transaction.
  A concurrent disband/recreate/capability change race is not resolved here.
- Roll back API/client changes together if necessary; reverting the server
  reopens unauthenticated DM note authoring. Leave capability columns intact.
  No connected database was changed.

## Verification

Eleven new direct handler tests cover denied proof with zero writes/side-effect
reads, unknown party, full authorized normalized persistence and origin stamping,
and authenticated invalid input. Nine fail against the preceding route, including
all eight authorization cases. Existing host adapter tests plus three new tests
cover persisted proof after re-instantiation, wrong-party local denial and
retained credentials on network failure.

Direct handler/provider tests use mocked storage/database boundaries. PostgreSQL,
HTTP/browser/mobile, two-client and deployment acceptance remain pending.
Full regression totals and this pass's files/PR are recorded in the
[implementation log](implementation-log.md).



## O02-A2: live recipient proof (2026-10-22)

Accept/decline now validate memberId, verify session existence and the persisted
member hash for the exact party/member pair before ensureActiveSession activity
updates, expiration cleanup or runtime hydration. Missing, legacy, removed,
wrong-party, other-member, body-only and host-substitute proof fail closed with
party_member_required. A host has no implicit right to accept for a player.
Existing assignment-target and accepted-state checks still apply after proof.
An authenticated member requesting another recipient's assignment may refresh
session activity but cannot mutate that assignment.

The existing member adapter now returns typed authorized responses and merges
JSON headers with bearer proof. It invalidates credentials on explicit member
revocation, retains them on network/generic errors, and preserves the current
caller API. No screen flow or automatic retry was added. No new DB migration;
existing host/member columns and matching client/API are required. Legacy
players must rejoin, and old clients cannot accept/decline without proof.

Remaining: public read visibility, concurrent removal/session races and the
server-ack-before-local-journal-save gap. There is no durable exactly-once
recipient application receipt. Roll back matching client/server together if
needed; reverting the server reopens recipient spoofing. No connected DB or
deployment was changed. Direct-handler tests mock the DB; live PostgreSQL,
HTTP/browser/mobile and reload/disconnect acceptance remain pending.

## O02-A3: member-owned action gates (2026-10-22)

Five additional routes reuse authorizePartyMember, renamed from the note-only
helper because the same persisted live-party/member boundary applies. Verify
memberId and capability before session refresh, expiration cleanup or runtime
access; neither host capability nor body role flags substitute. Existing
initiative/reroll, roll target/total derivation, rest approval/target and loot
recipient checks remain. Successful authenticated requests retain their existing
normalization and persistence paths.

The client exports keep their signatures and delegate through the member adapter.
Stored per-party/member proof is sent in Authorization alongside JSON headers;
response-returning methods preserve results, and initiative remains void. Generic
transport errors retain proof; explicit member rejection removes that credential.
Demo bootstrap already enrolls and stores its member credentials. No host-only
gate was applied to player transfers or companion/AI DM operations.

No new schema migration. Matching client/API and existing capability columns are
required; old clients fail closed and legacy members rejoin. Authenticated foreign
assignment/request targets cannot mutate those objects, though session activity
refresh remains an existing side effect. Concurrent removal/session races,
public read privacy, item ownership/debit, transactional loot/rest recovery,
server-recorded dice and modifier validation remain separate gaps. Rest approval,
event/award creation and combat controls remain open; this is not complete O02.
Rollback matching client/server together; reverting the server reopens spoofing.
Tests use mocked DB/storage and do not establish device/HTTP/real DB acceptance.


## O02-A4: host rest resolution (2026-10-22)

Approval/denial now verifies the existing original-host capability before session
activity, expired-session deletion or runtime hydration. Party code, member proof,
body tokens, DM labels and legacy unclaimed sessions cannot resolve rest. Unknown
sessions return 404; unauthorized requests return 403 party_host_required without
writes. Authorized hosts retain status validation, missing-request handling,
expiry checks and persisted approved/denied events. The server stamps resolvedBy
as dm. The only current UI caller is dm-party.tsx; its existing error handling
reports missing local host proof or API failure.

The existing client export delegates to partyHostApi, transports the per-party
stored proof with JSON headers and returns the typed response. Missing local
proof prevents the request; failures retain proof for explicit retry. No UI flow,
new schema or automatic retry is added. Provision the existing host column and
deploy matching client/API; old clients and DM watchers without the original
host capability fail closed. Roll back both together if needed, leaving columns
intact; a server rollback reopens unauthenticated approval. No deployment or
connected database change was performed.

This is permission enforcement, not transactional rest application or complete
rest lifecycle validation. Existing resolution transition/replay behavior is
unchanged, as are acknowledgement/local-save recovery, delegation, read privacy
and authorization-to-commit races. Sixteen mutation handlers remain open. Tests
mock DB/storage; live PostgreSQL, HTTP and mobile acceptance remain pending.
