# Original repository audit: reconstructed record

Recorded 2026-10-22 to support the [implementation log](../implementation-log.md).
Audit baseline reported in recovered conversation: main
`03a9153cf7a02e50669051a7fa820c9e597e26a6` (2026-10-21).

## Provenance and unresolved count

The original standalone audit artifact was not found in the repository, PR
collection or issue collection inspected for this backfill. Retrieved prior
conversation describes **five significant findings**, plus a testing observation.
The implementation PRs corroborate the listed mechanisms. This file is a
reconstruction from that recovered summary and durable repository evidence,
not a verbatim transcript, a newly executed full audit, or proof of original
15-item membership/numbering.

The user recalls 15 original issues. That numbered artifact remains unrecovered
(REC-01). The assistant previously accepted the count without establishing its
source. Keep this uncertainty visible. Fifteen merged PRs do not establish fifteen
original findings, and later U01–U17/I01–I20 must not fill missing original slots.
If the source is recovered, append the correction and map its actual wording and
IDs without deleting this reconstruction's provenance.

## Recovered findings

O IDs are assigned by this log for stable tracking. Severity below is reported
from the recovered original audit summary; findings are paraphrased.

| Log ID | Reported severity | Recovered defect / original evidence reported | Durable corroboration |
| --- | --- | --- | --- |
| O01 | High | `/party/sync` updates member HP, temporary HP, AC and conditions before rejecting a stale snapshot. Original audit reported reproducing the overwrite. | [PR #1](https://github.com/dstancomb3/DND-Companion/pull/1), `party.sync-safety.test.ts`, `partySyncGuard.test.ts`. |
| O02 | High | A shareable party code grants destructive access; caller-supplied member IDs are trusted without proof. | [PR #7](https://github.com/dstancomb3/DND-Companion/pull/7) host disband capability and [PR #8](https://github.com/dstancomb3/DND-Companion/pull/8) member sync/leave proof; remaining route limits in [member permissions](../party-member-permissions.md). |
| O03 | High | Dedupe using name/class/max HP/AC collapses separate characters with identical visible attributes and associated runtime/initiative state. Original audit reported reproducing the collapse. | [PR #1](https://github.com/dstancomb3/DND-Companion/pull/1) stable-ID grouping and regressions. |
| O04 | High | After DB outage/recovery, an older durable campaign snapshot can replace a newer in-memory fallback save. Original audit reported reproducing rollback. | [PR #3](https://github.com/dstancomb3/DND-Companion/pull/3); durability/conflict follow-ups [#4](https://github.com/dstancomb3/DND-Companion/pull/4)/[#5](https://github.com/dstancomb3/DND-Companion/pull/5); [save recovery guide](../campaign-save-recovery.md). |
| O05 | High when publicly reachable | AI endpoints lack app authentication/rate limits while accepting memory-buffered uploads up to 20 MB. | Existing `routes/ai/index.ts`; later item finding I17 records the same request-security gap. Output-validation PR #14 does not close it. |

Additional observation T01: the standard validation command omitted existing
tests and no GitHub Actions workflow was reported. PR #6 repaired install,
typecheck and combat-baseline execution, but a full CI/release gate is still
absent at the main revision pinned by the log. This observation is separate
from the five recovered major findings.

## Original audit limits and present interpretation

Recovered history reports read-only inspection and isolated reproductions; no
files were changed by that audit, and full build/regression/UI checks were not
run then. Historical reproductions are not fresh live-database/security tests.
Current status, scope-limited fixes and remaining acceptance are in the
[implementation log](../implementation-log.md), not inferred from this baseline
record. In particular, authenticated disband/direct sync is not authorization for
all DM mutation routes; memory ordering is not a durable outbox; a passing mocked
regression is not completed deployment or device acceptance.
