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
| Member leave/rejoin | Existing enrollment/removal behavior retained | No automatic orphan cleanup, ownership transfer or rebind of old projections. |
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
Implementing guarded detach/retention is the next pass; it is not active yet.
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
