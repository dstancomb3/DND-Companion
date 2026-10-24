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

The table accounts for all 34 declared party handlers after O02-A12. It describes application
route-level proof, not network/gateway protection or a penetration test. Bootstrap
access is intentionally distinct from member/DM privilege. Proposed policies in
open rows are design requirements for later bounded passes, not implemented
permissions or newly approved broad changes.

After O02-A9: 28 handlers have explicit capability proof; three are bootstrap
handlers and two are open reads. No non-bootstrap mutation declaration remains
without proof. This count does not establish full authorization, read privacy,
validated combat/companion ownership, transaction safety or abuse protection.

| Method | Route (under /api) | Current caller proof | Effect | Remaining boundary / policy |
| --- | --- | --- | --- | --- |
| POST | `/party/create` | Bootstrap | Issue session + host capability | Creation is public; abuse limits/recovery remain open. |
| POST | `/party/join/:code` | Invite bootstrap | Validate/share party invitation | Code is an invitation, not DM/member authority; private-read policy remains open. |
| POST | `/party/:code/register-member` | Invite bootstrap | Issue member UUID + private capability | Caller cannot choose/claim existing identity; enrollment abuse limits remain open. |
| PUT | `/party/sync` | Member proof | Own member projection + runtime sync | Existing exact party/member token check; further serialization/races remain open. |
| GET | `/party/:code/members` | Open read | Member/stat projection; expiry handling | No caller proof. Decide scoped read/DM-secret policy; do not infer read authorization from code. |
| DELETE | `/party/leave` | Member or host proof | Remove self or host-remove another member | O02-A11 commits locked proof, membership removal and durable companion detachment together; removal is not a ban. |
| POST | `/party/:code/disband` | Host proof | Delete session/members/runtime | Existing original-host check; delegated DM/recovery not implemented. |
| GET | `/party/:code/combat-state` | Open read | Read/hydrate runtime; refresh activity | No caller proof; read privacy and pre-auth activity/expiry side effects remain open. |
| POST | `/party/:code/initiative/start` | Host proof (O02-A5) | Start initiative/change participants and order | Live original-host proof before activity/runtime work; AI DM uses the same host capability. |
| PUT | `/party/:code/initiative/roll` | Member proof | Submit member initiative | Live own-member proof before activity/runtime work; existing member/reroll checks retained. DM override is not granted by this route. |
| POST | `/party/:code/end-turn` | Member or host proof (O02-A7) | Advance battle turn; optional isDmOverride | Own current turn in own requested/default battle; host proof required for override. Global compatibility turn is not authority. |
| POST | `/party/:code/economy/spend` | Member proof (O02-A7) | Spend member turn economy | Exact live member proof; existing spend rules preserved, including out-of-turn reactions. Does not prove honest client limits. |
| POST | `/party/:code/economy/reset` | Member proof (O02-A7) | Reset member turn economy | Own-member manual reset only; host cannot substitute. Reset eligibility/turn rules remain separate engine work. |
| POST | `/party/:code/combat/apply-outcomes` | Source-member proof (O02-A7) | Apply bounded remote HP/temp HP/conditions | Exact live source proof before runtime/replay; existing turn/target/outcome checks retained. Does not validate the originating combat command. |
| POST | `/party/:code/roll-requests` | Host proof (O02-A6) | Create roll prompts | Persisted original-host proof before activity/runtime work. AI DM uses the same capability; target membership is not author authority. |
| PUT | `/party/:code/roll-requests/:requestId/respond` | Target-member proof | Record/replace target member roll response | Live exact-member proof plus existing request-target check. Dice/modifier fairness and durable roll authority remain separate. |
| POST | `/party/:code/rest-requests` | Member proof | Request rest for member | Live requester proof; existing party-wide rest request semantics retained. Host proof is required on the separate approval route. |
| PUT | `/party/:code/rest-requests/:requestId` | Host proof (O02-A4) | Approve/deny rest | Original-host proof before activity/expiry/runtime work; server stamps resolvedBy as dm. |
| PUT | `/party/:code/rest-requests/:requestId/ack` | Target-member proof | Acknowledge recipient rest application | Live exact-member proof plus approved-state/target checks; local/server receipt atomicity remains U08. |
| POST | `/party/:code/events` | Member or host proof (O02-A7) | Append event with member/metadata labels | Seven supported client action report types only. Server-derived attribution and reportedBy; authoritative receipt kinds rejected even for host. |
| POST | `/party/:code/loot-assignments` | Member or host proof (O02-A7) | DM awards AND player-to-player item transfers | Host award stamped dm; member transfer stamped authenticated sender. Server inventory ownership/debit and exactly-once delivery remain open. |
| PUT | `/party/:code/loot-assignments/:assignmentId/claim` | Recipient member proof | Mark assignment claimed | Live exact-member proof plus target check. Claim-first/local-inventory-save recovery remains open (I13/U08). |
| POST | `/party/:code/note-assignments` | Host proof (O02-A1) | Create DM quest/people/location assignments | Authenticate original host before activity, expiry cleanup, member reads or runtime hydration. Server stamps DM origin. |
| PUT | `/party/:code/note-assignments/:assignmentId/accept` | Recipient member proof | Mark DM notes accepted | Live exact party/member proof plus assignment target check. Local journal save/recovery remains separate. |
| PUT | `/party/:code/note-assignments/:assignmentId/decline` | Recipient member proof | Decline/remove assignment | Live exact party/member proof plus assignment target and accepted-state checks. |
| POST | `/party/:code/combat-npcs` | Host or companion submitter proof (O02-A9/A10) | Create/seed NPC, dummy or player companion | Ordinary NPCs require host proof; companion admission requires exact live member proof and own-battle scope. Character/creature ownership and stats remain client claims. |
| POST | `/party/:code/combat-npcs/:npcId/recover-companion` | Host proof (O02-A12) | Explicit retained companion reassignment | Locked host/live target proof, reviewed revision + detachment stamp, transactional binding/event save; no automatic encounter placement or canonical ownership claim. |
| PUT | `/party/:code/combat-npcs/:npcId/dummy-state` | Host proof (O02-A8) | Update NPC/dummy state | Host proof plus party-local instance lookup; existing HP/action normalization retained. |
| PUT | `/party/:code/combat-npcs/:npcId/gear` | Host proof (O02-A8) | Replace NPC gear | Host proof plus party-local instance lookup; canonical effect validation remains separate. |
| PUT | `/party/:code/combat-npcs/:npcId/visible-stats` | Host proof (O02-A8) | Choose NPC stats visible to players | Host proof plus party-local instance lookup; public reads still expose full data. |
| DELETE | `/party/:code/combat-npcs/:npcId` | Host proof (O02-A8) | Remove NPC and runtime references | Host proof plus party-local instance lookup; existing initiative/battle reference cleanup retained. |
| DELETE | `/party/:code/encounters/:battleId` | Host proof (O02-A5) | End/remove encounter and related state | Original-host proof before side effects; existing party-local battle checks retained. Reversal/history remains unimplemented. |
| POST | `/party/:code/encounters/:battleId/participants` | Host proof (O02-A5) | Add encounter members/NPCs | Original-host proof plus existing live party-local participant filtering and battle existence checks. |
| PUT | `/party/:code/combat-npcs/:npcId/initiative` | Host proof (O02-A8) | Set NPC initiative | Host proof plus party-local instance lookup; AI DM uses the same creator capability. Dice truth remains separate. |

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


## O02-A5: encounter control proof and caller map (2026-10-22)

Three additional routes use authorizePartyHost before ensureActiveSession. Missing,
member, other-party, malformed, legacy, body-only or AI-role-label proof cannot
start initiative, add participants or end encounters. Verify the persisted host
hash for the requested party before activity refresh, expiration cleanup, member
reads or runtime hydration. Denial is 403 party_host_required with zero writes;
unknown party is 404. Valid proof still passes existing expiry, participant and
battle checks. Battle selection, NPC cleanup, ordering, events and persistence
retain their prior behavior; unrelated battles survive.

| Caller | Controls used | Observed authority / resulting policy |
| --- | --- | --- |
| app/dm-party.tsx | Start, add, end | Watching a code does not prove host ownership. Existing stored creator capability is required. Start now displays failure through the screen's error state, matching add/end. |
| app/landing.tsx demo bootstrap | Start | Creates party through host adapter before enrollment/seeding; private host proof is already stored. Member initiative submissions remain member-authorized. |
| components/adventure/session/AiDmCombatSubmodePanel.tsx | Start, add, end | Uses the current party and shared client exports. Host-device AI DM controls use the creator capability; an ordinary joined player or watcher has no implicit delegation. Existing tool-event failure handling remains. |
| utils/adventure/campaignEncounterRuntime.ts via app/adventure/session/[sessionId].tsx | Start when no reusable battle | Injects the same startPartyInitiative export. Main party or watched-code fallback must have stored host proof. New-battle denial happens before later NPC/roll work; existing session catch reports setup failure. |

Client function signatures and results remain compatible through partyHostApi.
Private proof is selected by exact party code, sent in Authorization alongside
JSON headers, and retained on network/server errors. Missing local proof prevents
the request. No public flag, member proof, watched code, request label, model
response or AI DM session metadata grants host privilege. No automatic party
creation, legacy claiming, delegation or capability transfer is introduced.

This intentionally closes previously unauthorized encounter control on joined
or watching devices. Run host/AI DM controls from the party-creator device.
Delegated AI orchestration is a future explicit authority contract. An existing
reusable campaign battle can still proceed through NPC/roll routes that remain
open, and this pass does not secure that entire workflow. NPC creation also has
player-companion callers, so it is not blindly made host-only here.

No new migration. Existing host column and matching API/client are required;
operator verified this column in the configured test DB, not all environments.
Old clients fail closed on these controls. Roll back matching API/client together
if needed, leaving columns intact; server rollback reopens unauthenticated
encounter changes. Authorization and runtime commit are not one transaction;
concurrent disband/recreate/capability-change races and live acceptance remain.
There are now 15 proof-gated handlers, 3 bootstrap, 2 open reads and 13 open
mutation handlers. This is a count of declarations, not security completion.


## O02-A6: roll-prompt authoring (2026-10-22)

POST /party/:code/roll-requests now reuses authorizePartyHost before session
activity refresh, expired-state deletion, member reads or runtime hydration.
The helper accepts a server-selected action label for clear errors; caller role
fields do not control it. Missing/member/wrong-party/legacy/body-only/malformed/
AI-label proof returns 403 party_host_required with no writes. Unknown party is
404. Authorized hosts retain live target filtering, label/battle-label
normalization, initiative prompt overlap/replied-prompt behavior, events and
persistence. This does not add stat-key schema validation, enforce battle-target
membership or make authoring and runtime commit atomic.

Client createPartyRollRequest retains its signature/result through partyHostApi.
It reads only the exact party's persisted host credential, sends bearer and JSON
headers, prevents requests without local proof and retains proof after errors.
DM Party's direct prompt action now displays errors instead of leaving a rejected
promise unhandled. Its initiative-start and participant-add paths already catch
failures. Adventure adjudication and campaign orchestration already report failed
prompts. Model responses, watched codes and member proof cannot delegate host
access. Use the creator device for both DM and AI DM prompts.

### Caller map and NPC follow-up evidence

| Operation | Observed callers | Decision / remaining work |
| --- | --- | --- |
| Roll-prompt creation | dm-party.tsx start/add/manual prompt; Adventure session adjudication; campaignEncounterRuntime through the session's injected shared export | Gate now using original-host proof, including reused battles that skip initiative start. Recipients still respond with member proof. |
| NPC creation | DM Monsters; DM Party templates/dummies; landing demo; campaign orchestration; player sheet companion projection | Leave open in this pass. Player projection sends ownerMemberId/ownerCharacterId inside metadata without credential proof; host-only gating would break an existing player feature. Need explicit validated ownership/host policies. |
| NPC dummy-state and gear updates | DM Party handlers | Observed UI is host-oriented; separate scoped instance-ownership gate next. No permission inferred from NPC ID or projection labels. |
| NPC visibility and deletion | DM Party handlers | Host-oriented current callers; remain open pending next bounded proof/instance policy. |
| NPC initiative | DM Party and Adventure session AI encounter seeding | Current host/AI DM path needs proof; companion-owner initiative rights require an explicit policy if introduced. No gate added here. |

Campaign integration tests exercise real host adapters for new and reused battles.
A member-only new battle fails at start before downstream work. In a reused
battle with an already-present hostile, unauthorized roll authoring becomes a
failedRoll entry without issuing a roll request. If an existing battle lacks its
NPC, the still-open creation route can run before prompt failure: no workflow
transaction or complete AI DM authority is claimed. Refresh/read paths remain open.

No new schema or migration. Matching client/API and existing host column required;
old clients and unclaimed legacy parties fail closed. Roll back matching versions
together if needed, leaving columns intact; reverting server proof reopens prompt
spoofing. DB/storage are mocked in focused tests; device/HTTP/real DB and concurrent
capability/session changes remain unverified. There are 16 proof-gated handlers,
3 bootstrap, 2 open reads and 12 open mutation handlers. Original O02 stays partial.

## O02-A7: remaining non-NPC mutation proof (2026-10-23)

The twelve previously open handlers include six NPC routes. This pass covers
only the six non-NPC handlers. NPC instance controls follow separately;
NPC creation/player companion ownership remain a distinct policy decision.

End-turn permits the authenticated current member in that member's own battle,
or the original host. A body isDmOverride flag never grants host rights. Member
defaults select that member's battle, and the check uses currentTurnIdByBattle,
fixing the old primary-battle/global-turn check. Economy spend/reset and remote
apply require exact live member/source proof; a host cannot impersonate a player.
Self reset preserves the existing manual API contract; fairness and eligibility
are not established by proof. Out-of-turn reaction spending remains supported.

Mixed event/loot operations check persisted host proof or exact live member
proof before session activity, expiry cleanup or runtime work. Member IDs select
which credential to check; they never establish permission themselves. Generic
events allow the seven observed player action report kinds, stamp reportedBy,
and reject server-owned receipt kinds even for the host. Host reports do not
impersonate a supplied member ID. Reports remain caller-written descriptions,
not validated combat facts. CombatContext catches report transport failures.
Host loot origin is always dm; player transfers retain the authenticated sender.
Full supported inventory snapshots remain intact. There is no server inventory
ledger, so authorship does not prove item ownership, debit or atomic delivery.

Matching client/API required with existing host/member columns; no new migration
or connected DB write. Old clients fail closed. Roll back client/server together,
leaving columns; API rollback reopens these spoofing paths. No deployment.
Read privacy, concurrency between proof and commit, combat truth and receipts,
NPC routes, companion ownership, O05 and REC-01 remain open. Focused tests use
mock DB/storage; PostgreSQL/HTTP/browser/mobile/restart acceptance is pending.

## O02-A8: host NPC instance controls (2026-10-23)

Five direct instance routes now require the original party host capability before
activity refresh, expiry deletion, runtime hydration or instance lookup: health/
action state, gear, stat visibility, removal and NPC initiative. Instance IDs,
DM/AI labels and companion owner metadata do not grant access. Authenticated
hosts remain subject to existing party-local NPC existence checks and normalizers.
Deletion retains battle/initiative reference cleanup. AI DM initiative uses the
same host device; no delegated role is introduced. DM state/gear errors and AI
initiative failures are now surfaced instead of silently discarded.

This policy applies to manual host management of any existing NPC projection,
including companions. It does not introduce player companion-owner rights.
Creation remains unchanged and open because it also serves player projections;
that separate pass must prove source member/companion ownership, validate allowed
projection fields and define replacement/rejoin/lifecycle behavior. Do not call
NPC authorization complete: open creation can still add NPCs to a battle and
change order; public reads and member combat outcomes are separate paths.

Matching client/API plus existing host column required; no new schema migration
or deployment. Old clients and unclaimed parties fail closed on these controls.
Rollback the pair together, retaining columns; API rollback reopens unauthorized
instance editing. Proof/commit races, public stat privacy (visibility settings
are not a read-security filter), inventory/combat truth, recovery and live
PostgreSQL/HTTP/browser/mobile/restart acceptance remain open. Tests mock DB and
storage. Original O02 remains partial; O05/model work and REC-01 unchanged.

## O02-A9: host creation and companion submitter proof (2026-10-22)

The final non-bootstrap creation route now authenticates before session activity,
expiry cleanup or runtime access. Ordinary DM/demo/AI NPC creation requires the
original host capability. Companion projections instead require the live bearer
for projection.ownerMemberId; host proof cannot impersonate an owner. Supplied
IDs select which persisted credential to check and grant no rights themselves.

The player sheet uses the explicit projectPartyCompanion member adapter. The
existing addCombatNpc export now always uses host proof. Both retain typed
payload/results, JSON headers and existing credential retention/revocation rules.
Errors on the companion sheet show the actual permission/transport message.

Member admission requires nonempty companion/member IDs, character source with
sourceId matching companionId, friendly disposition, and no supplied gear,
conditions or initiative override. It derives the battle from that member's
server runtime mapping; another explicit battle is rejected. An owner without a
battle creates an unassigned projection, never one in another member's first
battle. Generic NPC controls remain host-only. No new companion edit/remove
rights, automatic retry or source-of-truth subsystem is introduced.

The server has no character/companion roster. This establishes authenticated
submission, not ownership of a real saved companion, approved stats or trusted
ownerCharacterId. Duplicates/retry receipts, legacy projection reconciliation,
owner removal/rejoin, canonical source validation and permission transfer remain
separate. See [companion boundary](companion-projection-permissions.md).

Matching API/client and existing capability columns required; no new migration
or connected DB write. Rollback both together; API rollback reopens creation
spoofing. All twelve previously open non-bootstrap mutations now check proof,
but O02 remains partial: open reads still have activity/expiry side effects,
invitation bootstrap is public, and proof-to-commit races, gameplay truth and
companion ownership remain open. O05, REC-01 and deferred models are unchanged.

## O02-A10: player-managed live companion identity (2026-10-22)

The user chose player-managed immediate admission, with DM oversight, rather
than an approval queue. New companions get server-stamped admission provenance
bound to the authenticated party/member/companion identity. Repeat admission
checks committed runtime and reuses an existing bound instance without
resetting its combat state, applying local edits, moving it or emitting another
creation event. Existing member/battle/field checks remain before reuse.

Only server-stamped live instances qualify, so legacy public owner labels grant
no ownership or deduplication rights. There is no canonical local-roster proof,
permanent receipt/tombstone, auto-transfer, owner leave/rejoin cleanup or new
player instance-control permission. Optional runtime JSON metadata is additive;
no new SQL migration. Existing revision conflicts fail closed and may be retried
explicitly; full proof-to-commit serialization is not implemented. See the
[companion policy](companion-projection-permissions.md) for exact lifecycle scope.
The route counts stay 28 proof-gated, three bootstrap and two open reads. O02
remains partial. Rollback A10 reopens duplicate/reset exposure, not A9 proof gates.


## O02-A11: departure transaction and detached companions

Member self-leave and host removal now revalidate locked persisted capabilities
inside a serializable transaction shared with durable runtime cleanup/deletion.
Only server-stamped membership bindings detach; their live data stays host-managed.
Encounter rebuild/start/add exclude retained detached instances. New enrollment
does not inherit old membership bindings. Counts remain 28 proof-gated mutations,
three public bootstrap handlers and two open reads. Explicit recovery/transfer,
canonical source ownership and wider proof-to-commit races remain open.


## O02-A12: reviewed host recovery

One new non-bootstrap mutation brings the current inventory to 34 route
declarations: 29 proof-gated mutations, three public bootstrap handlers and two
open reads. The recovery route requires original host proof; member/watch
capabilities cannot substitute. Host/target revalidation and binding/event save
share a serializable transaction. Review/version guards reject stale, duplicate
and replayed requests. This bounded recovery does not close canonical source
ownership, active transfer, permanent history or general admission races.


## O02-A13: companion admission/reuse lock scope

The existing companion branch now locks session then exact member, revalidates
member capability and commits activity/runtime work on one transaction connection,
matching departure/recovery ordering. Reuse is authenticated again and acknowledged
after commit. The ordinary host NPC branch is unchanged. This closes the bounded
preflight-to-departure gap in implementation, subject to real DB acceptance;
canonical ownership, other mutation races and full authorization remain open.
Route counts remain 34 declarations / 29 proof-gated mutations / three bootstrap /
two open reads.
