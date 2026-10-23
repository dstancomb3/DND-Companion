# Companion projection permissions

Original finding O02, passes O02-A9/A10. The user selected player-managed
admission on 2026-10-22: companions enter without a DM approval step, while the
DM retains shared combat oversight. This is a party-scoped submission/control
policy, not certification of a saved character, companion or its stats.

| Boundary | Implemented rule | Remaining evidence |
| --- | --- | --- |
| Ordinary NPC creation | Original host capability only, including DM/demo/AI callers | Delegated host roles and recovery remain absent. |
| Player companion admission | Exact live party/member bearer matching ownerMemberId | No server roster ties member, character and companion together. |
| Companion payload | Friendly character source; matching companionId/sourceId; no gear, conditions or initiative override | HP/abilities/name and ownerCharacterId remain client claims, not approved mechanics. |
| Battle placement | Derive from authenticated member's runtime battle; reject a different explicit battle | Host can later move participants through existing host controls. |
| Member has no battle | Create unassigned projection, without fallback to another player's battle | No automatic later joining/moving is added. |
| Instance management | Existing host-only state/gear/visibility/delete/initiative controls | No player companion-owner edit rights are inferred. |
| Retry and identity | Server-stamped party/member/companion identity reuses a committed live instance | No permanent receipt/tombstone after instance removal; initial insert and proof/commit races remain. |
| Member leave/rejoin | Transactional departure detaches stamped companions and retains live data | No automatic ownership transfer or rebind of old projections. |
| Legacy projections | Existing metadata retained for compatibility | It was publicly writable before this gate and cannot prove historical ownership. |

## Selected policy and current implementation

Players manage their local companion roster and can admit a companion using
live member proof. The server binds the admitted instance to that membership
and companion ID, within the party. It stamps companionAdmission with version
companion-admission.v1, memberId and companionId. Requests cannot write this
field; ordinary host NPC creation cannot forge it. ownerCharacterId remains a
client label and is not used as a credential or deduplication key. Different
members can have identical local IDs without sharing a combat instance.

Admission reads a fresh committed runtime snapshot. If a stamped live instance
already exists for the pair, return it with reused=true and no runtime mutation
or second creation event. The submitted name/stats/health cannot overwrite its
current state. Damage, spent economy, conditions, gear, DM edits, initiative and
placement remain intact. The sheet distinguishes an existing companion from a
new addition. Earlier own-battle validation still applies; reuse never moves the
instance, even if a DM placed it elsewhere.

New admission returns reused=false only after the existing revision-guarded
runtime save succeeds. Concurrent writes fail closed on revision conflict; an
explicit retry can find the committed winning instance. Reuse does not require
warm cache state and never acknowledges an in-flight cached creation. This is
bounded duplicate prevention for a live committed instance, not a permanent
exactly-once receipt or a serialized ownership transaction. On a party's first
runtime insert, the existing unique-row/store behavior is retained; no new
transparent insert-race recovery is added.

Legacy projections have no new server stamp and cannot be silently claimed or
merged by matching owner labels. They stay host-managed. Adding the same local
companion may therefore create one new bound instance beside a legacy one; the
DM must review/remove the old projection. Do not infer new permissions from it.
A host deletion ends the live instance; a later Add can create a new one. There
is no deletion tombstone to distinguish an intentional new Add from an old retry.

## Lifecycle policy and next implementation boundary

The selected player-managed policy does not add player commands for health,
economy, gear, initiative or removal in this pass. Existing manual controls remain
host-only; future member commands must bind to server admission provenance and
use the combat command authority, never projection labels alone.

Owner leave/removal should end that membership's control, detach its companions
from encounter order, and preserve a diagnostic/history record for the DM.
The O02-A11 implementation below now provides guarded detach/retention.
Rejoining creates a different member identity and must not automatically reclaim
old instances through ownerCharacterId, name or local companion ID. Recovery or
transfer needs a separately authorized, logged binding change. Character edits
must not implicitly heal/reset an existing combat instance. Full source-roster
verification, rule validation, transfer and duplicate reconciliation remain open.

A10 adds optional server-owned admission metadata to the existing runtime JSON
payload; schema version stays 1 and legacy payloads remain readable. No new DB
column or SQL migration. Deploy matching API/client with existing nullable
host/member capability columns. Old clients fail closed for creation. Keep
columns on rollback and revert the pair together; reverting A10 restores duplicate/reset exposure; reverting A9 also restores
unauthenticated creation. No connected DB migration or deployment performed.
Tests mock DB/storage and do not establish PostgreSQL, HTTP, browser/mobile,
restart or concurrent lifecycle acceptance. Read privacy, command truth and
proof-to-commit races remain separate in the [route map](party-permission-map.md).


## O02-A11 preparation: guarded member departure (historical pre-fix audit)

The user paused cloud setup and resumed this development boundary. Inspection
shows DELETE /party/leave currently deletes the member first, then only cleans
runtime state when combatStates already contains a warm cache entry. Cleanup
does not detach server-stamped companion instances. A runtime conflict or write
failure can therefore occur after membership deletion. A cold server can skip
cleanup entirely. These are implementation findings, not deployed fixes.

The next implementation must use one database transaction for capability
revalidation, membership removal and revision-guarded durable runtime cleanup.
Read the durable snapshot inside that transaction; never use warm cache as the
condition for cleanup or publish cache changes before commit. On conflict/failure,
roll back membership and runtime together and return a conflict/error without a
success acknowledgement. The existing snapshot store uses the global DB client,
so its load/save operations need an explicit transaction-scoped executor, with
normal non-transaction callers preserved.

Detach only companions with server-stamped companion-admission.v1 binding to
the departing member. Preserve their live combat data and admission provenance
for host review/history, while removing encounter/order/economy participation.
Unstamped legacy owner labels confer no relationship. Keep retained instances
host-managed; a newly enrolled member must not reclaim them by name,
ownerCharacterId or companion ID. Explicit rebind/recovery is separate work.

Acceptance must cover member self-leave and host removal, invalid/revoked proof,
cold cache, stale cache, unrelated NPC/member preservation, spent/damaged
companion retention, durable failure and revision-conflict rollback, retry after
lost acknowledgement, and new-member rejoin without automatic ownership.
PostgreSQL integration evidence is required before claiming transaction behavior
verified against a real database. No new owner instance-control rights, recovery
endpoint, source-roster verification or canonical combat behavior is introduced
by this preparation.


## O02-A11 implementation: transactional departure

DELETE /party/leave revalidates host/member proof under row locks in a serializable
transaction. It loads the durable runtime on that same connection and saves its
cleanup with the existing revision guard before deleting membership. Failure
rolls both changes back; serialization/deadlock and revision conflicts are returned
without an automatic retry. On commit the process cache is invalidated, never
replaced with transaction-local state. No runtime row is invented for an otherwise
empty party. A host retry for an absent member is a no-op; self-retry after a lost
success acknowledgement is refused because that membership proof is revoked.

Only server-stamped companion-admission.v1 bindings to that membership receive
an optional detachedAt timestamp. Their stored NPC data, damaged HP, dummy action/
reaction/movement state, conditions, gear and original provenance remain available
for host review. Their encounter mapping, initiative and shared economy entries
are removed, alongside the departing member's. Existing rebuild cleanup removes
departed member stats, roll/rest targets and assignments. Rebuild and host
encounter admission exclude detached instances so an ordinary refresh or add
cannot silently reactivate them. Existing host edits/deletion remain available.

A new enrollment receives a distinct member ID. Matching character labels or local
companion IDs never rebind the old instance. An explicit, separately authorized
recovery/transfer flow and its UI remain next work. Legacy unstamped projections
remain unchanged and require manual DM review; there is no retroactive cleanup.

This changes server runtime JSON additively at schema v1, with matching optional
client response typing and no SQL migration. Roll out the API version before
relying on departure cleanup. Reverting it restores partial-departure exposure
and older encounter code does not honor detachedAt; do not roll back casually on
parties containing retained companions. No connected DB or cloud setup is needed
to continue development. Mock transaction tests do not establish live PostgreSQL
locking/concurrency behavior; real DB and multi-client acceptance remain pending.
General admission proof-to-commit races, canonical source ownership, permanent
receipts, public read/privacy and full combat authority are still open.
