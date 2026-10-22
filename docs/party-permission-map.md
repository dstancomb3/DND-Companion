# Party route permission map and O02-A1 note-authoring boundary

Inspected baseline: main `55f78ee698b60e058af05ceea619e8b10fcc5bb3`, 2026-10-22.
Finding: O02 (original party/DM authorization), with U09 as a related dependency.
This is a route map and one bounded remediation, not an application-wide
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

After this pass: four handlers have explicit capability proof (sync, leave,
disband, note creation); three are bootstrap handlers; two are open read handlers;
24 are open mutation handlers. Counts are declarations, not a security-completion
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
| PUT | `/party/:code/initiative/roll` | Open mutation | Submit member initiative | Proposed own-member proof or explicit host override; validate battle/roll ownership. |
| POST | `/party/:code/end-turn` | Open mutation | Advance battle turn; optional isDmOverride | Proposed current-actor member proof or host; caller DM flag is not authority. |
| POST | `/party/:code/economy/spend` | Open mutation | Spend member turn economy | Proposed own-current-actor proof and existing economy validation. |
| POST | `/party/:code/economy/reset` | Open mutation | Reset member turn economy | Requires explicit reset/host policy; memberId alone is not proof. |
| POST | `/party/:code/combat/apply-outcomes` | Open mutation | Apply bounded remote HP/temp HP/conditions | Existing source/turn/target checks are business validation, not caller authentication. Prove source ownership or explicit host authority. |
| POST | `/party/:code/roll-requests` | Open mutation | Create roll prompts | Proposed host or explicit authorized orchestrator role; no caller DM flag. |
| PUT | `/party/:code/roll-requests/:requestId/respond` | Open mutation | Record/replace target member roll response | Proposed live target-member proof and current request ownership/revision. |
| POST | `/party/:code/rest-requests` | Open mutation | Request rest for member | Proposed own-member proof; limits separate from role. |
| PUT | `/party/:code/rest-requests/:requestId` | Open mutation | Approve/deny rest | Proposed host proof; resolvedBy is not credentials. |
| PUT | `/party/:code/rest-requests/:requestId/ack` | Open mutation | Acknowledge recipient rest application | Proposed target-member proof; durable local/server receipt still U08. |
| POST | `/party/:code/events` | Open mutation | Append event with member/metadata labels | Proposed member/host policy with permitted event kinds; labels cannot grant state authority. |
| POST | `/party/:code/loot-assignments` | Open mutation | DM awards AND player-to-player item transfers | Do not make blindly host-only. Need distinct host award/member-owned transfer proof; server currently lacks complete inventory ownership/debit authority. |
| PUT | `/party/:code/loot-assignments/:assignmentId/claim` | Open mutation | Mark assignment claimed | Checks target ID, not proof. Prove live recipient; durable claim/save transaction remains I13/U08. |
| POST | `/party/:code/note-assignments` | Host proof (this pass) | Create DM quest/people/location assignments | Authenticate original host before activity, expiry cleanup, member reads or runtime hydration. Server stamps DM origin. |
| PUT | `/party/:code/note-assignments/:assignmentId/accept` | Open mutation | Mark DM notes accepted | Checks target ID, not proof. Require live recipient proof; local journal save/recovery remains separate. |
| PUT | `/party/:code/note-assignments/:assignmentId/decline` | Open mutation | Decline/remove assignment | Checks target ID, not proof. Require live target-member proof. |
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
- Recipient accept/decline routes, note visibility in open combat-state reads,
  recipient identity spoofing and local journal/server commit recovery remain
  open. Protecting creation alone does not make the entire notes workflow safe.
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

