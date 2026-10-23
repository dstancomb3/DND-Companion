# Companion projection permissions

Original finding O02, pass O02-A9. Current implementation authenticates a
submission; it does not certify character or companion ownership.

| Boundary | Implemented rule | Remaining evidence |
| --- | --- | --- |
| Ordinary NPC creation | Original host capability only, including DM/demo/AI callers | Delegated host roles and recovery remain absent. |
| Player companion admission | Exact live party/member bearer matching ownerMemberId | No server roster ties member, character and companion together. |
| Companion payload | Friendly character source; matching companionId/sourceId; no gear, conditions or initiative override | HP/abilities/name and ownerCharacterId remain client claims, not approved mechanics. |
| Battle placement | Derive from authenticated member's runtime battle; reject a different explicit battle | Host can later move participants through existing host controls. |
| Member has no battle | Create unassigned projection, without fallback to another player's battle | No automatic later joining/moving is added. |
| Instance management | Existing host-only state/gear/visibility/delete/initiative controls | No player companion-owner edit rights are inferred. |
| Retry and identity | Existing fresh NPC ID per accepted creation retained | No duplicate prevention or exactly-once admission receipt. |
| Member leave/rejoin | Existing enrollment/removal behavior retained | No automatic orphan cleanup, ownership transfer or rebind of old projections. |
| Legacy projections | Existing metadata retained for compatibility | It was publicly writable before this gate and cannot prove historical ownership. |

A later ownership implementation needs a durable source binding or an explicit
host approval policy before labeling companions verified. It must define who can
create, update, remove and transfer a companion; how duplicates and concurrent
retries behave; and what happens when a member leaves, rejoins or changes a
character. A member ID, companion ID or client character snapshot alone cannot
prove these properties. Do not derive a new right from legacy owner metadata.

No schema change in this pass. Deploy matching API/client with existing nullable
host/member capability columns. Old clients fail closed for creation. Keep
columns on rollback and revert the pair together; reverting the API restores
unauthenticated creation. No connected DB migration or deployment performed.
Tests mock DB/storage and do not establish PostgreSQL, HTTP, browser/mobile,
restart or concurrent lifecycle acceptance. Read privacy, command truth and
proof-to-commit races remain separate in the [route map](party-permission-map.md).
