# Implementation log and audit reconciliation

Backfilled 2026-10-22. Historical coverage: PRs #1–#15 through main commit
`c69f7d34c50aecea862e994622e52765d4bf9afc`.
Merge dates below use America/Chicago (UTC−05:00 on these dates).
This log records this collaboration's work, not every feature that predated it.
Subsequent passes are appended below; latest recorded pass: O02-A2 ([PR #18](https://github.com/dstancomb3/DND-Companion/pull/18)).

## Read this before choosing more work

The initial repository audit, the later undo/snapshot audit and the later item
creation audit are separate scopes. A merged PR is not a closed audit, a database
deployment, or proof of end-to-end acceptance. Do not report “15/15 fixed.”

**Reconciliation gap REC-01:** a reliable original numbered 15-finding artifact
has not been recovered. Retrieved conversation history describes five significant
repository findings and a testing observation at baseline `03a9153`; PRs #1–#8
corroborate that work. This is not proof that the five are the full list the user
remembers. [Original audit reconstruction](audits/original-repository-audit-reconstruction.md)
records the provenance and uncertainty. O01–O05 below are log IDs, not invented
members of a 15-item list. Do not manufacture ten missing findings or use the
later U/I findings to fill that denominator.

Initial scope decision at backfill: reconcile before activating more work.
2026-10-22 scope update: the user explicitly authorized returning to original
O02 with a route permission map and one bounded fix. REC-01 remains unverified;
it does not block this explicitly authorized original-scope pass. AI caller/usage
protections remain O05. Loot claim recovery stays documented under U08/I13/I19,
not silently promoted. The product goal remains the
[AI DM and deterministic combat plan](ai-dm-combat-convergence-plan.md).

## Status and evidence rules

| Status | Meaning |
| --- | --- |
| Fixed (scoped) | The named bounded defect has an implementation and focused regression evidence. Explicit concurrency, rollout and live-test limits still apply. |
| Contained | The unsafe operation is refused/disabled. Its replacement feature is not implemented. |
| Partial | Some finding criteria have changed; the remaining criteria are listed. |
| Open | No qualifying implementation for this finding in this backfill. |
| Planned | A specification exists; execution/acceptance has not been delivered. |
| Unverified | Required provenance, deployment or acceptance evidence is unavailable. |

Runtime status and rollout status are separate. Historical test counts below
overlap and must not be added into a project-wide total. Mocked provider/React/DB
checks do not establish device, PostgreSQL crash/concurrency or multiplayer
acceptance. Audit probe files remain evidence of their pinned baseline; later
verification scripts are separate.

Sources: immutable PR/merge records for history; current source/tests for the
implemented boundary; the U/I audits for original finding criteria; recovered
conversation only where repository records do not preserve the initial audit.
Older “deferred” text in a PR is historical and may be addressed by a later row.

## Recovered original repository findings

Severity is recovered from the earlier audit summary, not a new security rating.
The [reconstruction](audits/original-repository-audit-reconstruction.md) also
documents the original reproductions and testing limits.

| Log ID | Recovered severity / finding | Current status | Implemented evidence | Remaining acceptance or scope |
| --- | --- | --- | --- | --- |
| O01 | High: rejected stale party sync already changed HP/temp HP/AC/conditions | Fixed (scoped) | [PR #1](https://github.com/dstancomb3/DND-Companion/pull/1) moves freshness/replay checks before writes; 3 new regressions cover sync/identity defects together | Sequential rejection fixed; concurrent member/runtime writes are not one atomic transaction. Live DB/concurrency tests pending. |
| O02 | High: party code/caller IDs grant destructive or cross-member access | Partial | [PR #7](https://github.com/dstancomb3/DND-Companion/pull/7) host proof for disband; [PR #8](https://github.com/dstancomb3/DND-Companion/pull/8) member proof for direct sync/leave and host removal; [PR #17](https://github.com/dstancomb3/DND-Companion/pull/17) host proof for DM note creation; [PR #18](https://github.com/dstancomb3/DND-Companion/pull/18) recipient proof for accept/decline | Remaining combat, initiative, rolls, loot, read privacy, NPC/rest and campaign authorization; read/invite/recovery policies; schema rollout and real-client tests. Not full character-state protection. |
| O03 | High: name/class/max-HP/AC dedupe collapses distinct characters | Fixed (scoped) | [PR #1](https://github.com/dstancomb3/DND-Companion/pull/1) groups by stable member ID | Repeated enrollment IDs remain distinct intentionally; ID migration/reference cleanup and live party QA remain separate. |
| O04 | High: recovered DB reads can roll back newer fallback campaign saves | Fixed (scoped) | [PR #3](https://github.com/dstancomb3/DND-Companion/pull/3) cache ordering/bigint; [PR #4](https://github.com/dstancomb3/DND-Companion/pull/4) durable checkpoint+receipt commit; [PR #5](https://github.com/dstancomb3/DND-Companion/pull/5) atomic expected-token writes and durable reads | Guarded HTTP checkpoint boundary; compatibility memory helper is not a durable outbox. Real PostgreSQL, two-device, restart and delete/concurrency acceptance still pending. |
| O05 | High when publicly reachable: AI routes lack app authentication/rate limits and accept memory-buffered uploads | Open | API output validation in [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14) does not close request authorization or usage budgets | Caller/campaign authorization, quotas/concurrency, bounded expensive input/image handling and abuse tests. Also I17. |
| T01 | Additional testing observation: standard validation omits existing tests; no GitHub Actions | Partial | [PR #1](https://github.com/dstancomb3/DND-Companion/pull/1) includes sync regressions; [PR #6](https://github.com/dstancomb3/DND-Companion/pull/6) repairs install/typecheck/combat baseline | CI workflow and comprehensive release gate still absent at the logged main revision; Windows/Node 20, live DB, HTTP/browser/mobile acceptance remain open. T01 is not counted as a sixth recovered major finding. |

## Merged implementation history

PR links provide current merge state. Historical backfill rows pin merge commits;
subsequent pass rows link their PR for final merge metadata. “Implemented”
describes only its row's scope.
Documentation/audit PRs #2/#9/#12 delivered plans/evidence, not runtime features.

| PR / local merge time | Track / finding IDs | Delivered change | Historical validation | Rollout and limits |
| --- | --- | --- | --- | --- |
| [PR #1](https://github.com/dstancomb3/DND-Companion/pull/1) · 2026-10-21 19:35 · [`cb47858`](https://github.com/dstancomb3/DND-Companion/commit/cb4785831ecc57fc0e1a53ed5eb004c652444958) | Original repository audit · O01, O03 | Reject stale sync before member/activity writes; dedupe by stable member ID. | 43 focused API tests; 3 new regressions fail on old code; API typecheck. Client/install baseline was blocked then. | Simultaneous writes and member/runtime atomicity remain open; no DB migration. |
| [PR #2](https://github.com/dstancomb3/DND-Companion/pull/2) · 2026-10-21 19:35 · [`0b98db0`](https://github.com/dstancomb3/DND-Companion/commit/0b98db0b823ac08bd44272bbbfd481d952f5ece4) | User-requested roadmap · ROADMAP | Added supplied AI DM/combat convergence plan; no engine implementation. | Content checked against uploaded plan; documentation only. | Phase 0 authority map and roll-stall diagnosis still required. |
| [PR #3](https://github.com/dstancomb3/DND-Companion/pull/3) · 2026-10-21 19:36 · [`f570b13`](https://github.com/dstancomb3/DND-Companion/commit/f570b13305b2ab9e639bd686c4e4bcc505d6aff0) | Campaign recovery follow-up · O04 | Protect newer fallback snapshots during recovered/in-flight reads; store epoch milliseconds as bigint. | 6 new store tests, 71 focused tests, shared-library build/API typecheck. | Manual timestamp migration; compatibility fallback is not durable or cross-worker authority. |
| [PR #4](https://github.com/dstancomb3/DND-Companion/pull/4) · 2026-10-21 19:37 · [`31e6142`](https://github.com/dstancomb3/DND-Companion/commit/31e614201c59588435dff8070ba73b4dc43522a1) | Campaign durability follow-up · O04 | Commit checkpoint plus keyed replay receipt transactionally before returning success; fail closed on persistence error. | 80 focused store/route/contract tests and API typecheck; old route fails outage regression. | Both checkpoint and idempotency tables required; no-key saves lack replay dedupe; live DB testing pending. |
| [PR #5](https://github.com/dstancomb3/DND-Companion/pull/5) · 2026-10-21 19:38 · [`04b8b68`](https://github.com/dstancomb3/DND-Companion/commit/04b8b6807e05f7387f608ddc25480b029569294b) | Campaign conflict follow-up · O04 | Checkpoint compare-and-swap using expectedSubmissionId; durable token reads; preserve local work on 409. | 87 server tests, 3 client API tests; 5 regressions fail on old code. | Matching client/API required; no automatic merge/outbox or ownership authorization. |
| [PR #6](https://github.com/dstancomb3/DND-Companion/pull/6) · 2026-10-22 06:35 · [`3e3e4ef`](https://github.com/dstancomb3/DND-Companion/commit/3e3e4ef84d439f070e7682fa7e53d3ce4e388844) | Baseline prerequisite · T01 | Repair frozen lockfile consistency, Feather glyph, Playwright Node type project and combat test module format. | Frozen install, workspace typecheck, 24 combat tests, 90 server tests, 3 client API tests. | No new package versions or DB/gameplay change; Windows/device/DB acceptance pending. |
| [PR #7](https://github.com/dstancomb3/DND-Companion/pull/7) · 2026-10-22 06:45 · [`7dc6404`](https://github.com/dstancomb3/DND-Companion/commit/7dc6404263a68c18b98d9ecc99d9f3feb7773c35) | Original permissions finding · O02 | Issue private host capability; store hash; require bearer proof for disband; retain client proof across reload. | 34 server tests, 4 client tests, workspace typecheck and 24 combat tests. | Apply host-token column first; legacy parties unclaimed; disband scope only. |
| [PR #8](https://github.com/dstancomb3/DND-Companion/pull/8) · 2026-10-22 07:30 · [`d722086`](https://github.com/dstancomb3/DND-Companion/commit/d722086af72272a6f166d90f1b3a79bc09095a73) | Original permissions finding · O02 | Server-issued member IDs/capabilities; exact pair proof for direct sync/leave; no revoked-member recreation. | 56 server tests, 12 client tests, workspace typecheck and 24 combat tests. | Apply host/member columns; matching client/API; rejoin/new IDs; other mutation routes still lack full authorization. |
| [PR #9](https://github.com/dstancomb3/DND-Companion/pull/9) · 2026-10-22 08:29 · [`5f8e929`](https://github.com/dstancomb3/DND-Companion/commit/5f8e9296a3c1aba8f9c137c7724d1fca068545cb) | Later user-requested undo audit · U01–U17; H0–H7 | Documented 17 gaps, domain boundaries, rollback spec and immutable-history requirements; no runtime fix. | AST inventory: 140 context properties, 59 storage-write sites, 51 routes; 3 actual-provider unsafe-behavior probes. | Counts are declarations/candidates, not unique reversible commands. Historical unsafe probes retained. |
| [PR #10](https://github.com/dstancomb3/DND-Companion/pull/10) · 2026-10-22 08:44 · [`14b90db`](https://github.com/dstancomb3/DND-Companion/commit/14b90db69af86f1dc0d7fb31706aaac74fb1ee85) | Undo containment slice H0a · U01, U02, U03, U10, U16 | Refuse incomplete MutationHistory undo without writes; remove misleading Undo UI; record diagnostic mixed changes before item review; newest log first. | 6 tests, 3 provider probes, workspace typecheck and 24 combat tests. | Contained, not usable undo. Exact capture, revisions, lifecycle/dependency proof and guarded commit still absent. |
| [PR #11](https://github.com/dstancomb3/DND-Companion/pull/11) · 2026-10-22 08:53 · [`d4cacec`](https://github.com/dstancomb3/DND-Companion/commit/d4cacecb75bc408f13fc90809e9f364e7899f805) | Snapshot coverage slice H1a · U07; part of U14 | Persist remaining spell/item uses through save/load and import/export; zero retained, malformed present counts rejected. | 16 new codec/provider tests, 6 undo tests, 8 compatibility tests, workspace typecheck and 24 combat tests. | Optional additive fields; old missing counts unknown; no per-action autosave or complete combat/history snapshot. |
| [PR #12](https://github.com/dstancomb3/DND-Companion/pull/12) · 2026-10-22 09:06 · [`be69eda`](https://github.com/dstancomb3/DND-Companion/commit/be69edab23988e92a418381e6b266ff87300dd3b) | Later user-requested item audit · I01–I20 | Documented 20 findings and field-preservation matrix; no runtime fix. | 11 API probes with mocked SDK/blocked fetch, 4 client probes, 16 existing API tests. | Probe success reproduces gaps at the audit baseline; it does not prove fixes. |
| [PR #13](https://github.com/dstancomb3/DND-Companion/pull/13) · 2026-10-22 09:19 · [`898c4b3`](https://github.com/dstancomb3/DND-Companion/commit/898c4b37f205f775fd74c726efcc623ff8e117d9) | Item client preservation slice · I04, I11, I12; part of I06/I19 | Retain DM effects/mechanics on save/edit; visible save errors; conservative variant identity; preserve inventory metadata; reject ambiguous name-only removals. | 3 review tests, actual store/provider verification, workspace typecheck and 24 combat tests. | Client-only; conservative metadata differences create extra rows. No acceptance receipt or general undo. |
| [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14) · 2026-10-22 09:25 · [`ca55465`](https://github.com/dstancomb3/DND-Companion/commit/ca55465913341df3ed7603d6b9115398fd43a247) | Item API validation slice · I06, I08, I09, I10, I11, I12; part of I15/I16 | Validate counts/scalars/dice/effects; preserve metadata; separate variants; quarantine malformed mechanics; remove AI self-verification; review unsupported damage responses. | 44 API tests including 28 new validation/route tests, workspace/API typecheck and 24 combat tests. | Partial structural schema/capability checking; no reflection execution, trusted official catalog, full provenance or AI request authorization. |
| [PR #15](https://github.com/dstancomb3/DND-Companion/pull/15) · 2026-10-22 12:17 · [`c69f7d3`](https://github.com/dstancomb3/DND-Companion/commit/c69f7d34c50aecea862e994622e52765d4bf9afc) | Item DM draft/delivery slice · I04, I05, I10, I12, I16, I19 | Preserve supported full item snapshots in both assignment modes; no invented defaults for canonical-only items; require review acknowledgement; reject conflicting structured-field edits. | 11 draft tests, 5 transfer tests, 44 API tests, 24 combat tests, workspace typecheck and provider preservation probes. | Existing wire format/claim path. Read-only linked fields; acknowledgement does not verify effects. Claim and local inventory save remain separate. |

| [PR #16](https://github.com/dstancomb3/DND-Companion/pull/16) · 2026-10-22 12:31 · [`55f78ee`](https://github.com/dstancomb3/DND-Companion/commit/55f78ee698b60e058af05ceea619e8b10fcc5bb3) | Scope reconciliation / REC-01 | Backfilled this log, original audit reconstruction and future-pass instructions; no runtime fix. | Finding/PR/priority coverage and local links checked; frozen install, workspace typecheck and 24 combat tests. | No original 15-item artifact recovered; no completion percentage, deployment or DB change. |
| [PR #17](https://github.com/dstancomb3/DND-Companion/pull/17) · 2026-10-22 · O02-A1 | Original O02 / related U09 | Mapped all 33 party routes; require original-host proof before DM note authoring side effects; matching client sends persisted capability; server stamps DM origin. | 87 focused server/client tests, workspace typecheck, 24 combat tests, frozen install; 9 new regressions fail on old route, including 8 authorization cases. Map/source and OpenAPI checks pass. | No new migration; existing host column and matching API/client required. O02 partial: 24 open mutation handlers, open reads, recipient proof and transaction gaps remain. |

| [PR #18](https://github.com/dstancomb3/DND-Companion/pull/18) · 2026-10-22 · O02-A2 | Original O02 / related U09 | Require exact live recipient capability before note accept/decline side effects; host cannot substitute. Client returns typed responses and preserves JSON/proof handling. | 115 focused server/client tests, workspace typecheck and 24 combat tests; 14 route regressions fail on previous source. Map and OpenAPI checks pass. | Existing columns and matching client/API; O02 remains partial, with 22 open mutation handlers. No journal/server atomicity or deployment. |

## Later audit: undo and snapshots

Source: [undo/snapshot audit](audits/undo-snapshot-audit.md), baseline main after
PR #8. All 17 original IDs retained. These were requested after discussion of
Undo and broader NPC/quest/item history; they are not replacements for original
repository findings.

| ID | Priority / finding | Status | Merged evidence | Remaining work / exact limit |
| --- | --- | --- | --- | --- |
| U01 | P0: Incomplete inverse state (temp HP/conditions/lifecycle) | Contained | [PR #10](https://github.com/dstancomb3/DND-Companion/pull/10) | Existing MutationHistory undo refuses all partial records; full typed capture/inverse behavior still absent. |
| U02 | P0: Undo overwrites later/unrelated HP, coins and resources | Contained | [PR #10](https://github.com/dstancomb3/DND-Companion/pull/10) | Refusal prevents destructive reversal; exact write sets, after-state/revision and dependency proof still required. |
| U03 | P0: Writers and staged item-review changes lack one complete group | Partial | [PR #10](https://github.com/dstancomb3/DND-Companion/pull/10) | Diagnostic history now precedes loot handoff and includes world-only changes; complete writer registration/atomic groups remain open. |
| U04 | P0: World/character/DM/server state has split ownership | Open | None | Define per-domain authority and durable ownership before shared restore. |
| U05 | P0: Live member and runtime/history writes are separate | Open | None | Campaign-only transactions in PR #4 do not make party mutation/history atomic. Require crash/concurrent-writer proof. |
| U06 | P0: Latest saves replace prior state; no immutable versions/tombstones | Open | None | Version history and deletion recovery are not provided by checkpoint token conflict checks. |
| U07 | P0: Snapshots omit mechanical runtime state and reset limited uses | Partial | [PR #11](https://github.com/dstancomb3/DND-Companion/pull/11) | Remaining spell/item counts now survive save/load/import/export. Concentration, reactions, turn economy, full codecs and per-action durability remain open. |
| U08 | P0: Assignment/rest acceptance and local application are separate commits | Open | None | PR #15 preserves delivered fields, not a durable recipient receipt or atomic claim/save. Disconnect/retry recovery still required. |
| U09 | P0: History/shared restore lacks complete caller/DM authorization | Open | None | PRs #7/#8 and later O02-A1 (PR #17) protect specific routes only; note creation now requires host proof. Full history/restore authority remains absent. |
| U10 | P1: Bounded best-effort history and mutating undo markers | Contained | [PR #10](https://github.com/dstancomb3/DND-Companion/pull/10) | No partial record is marked undone by the refused operation; append-only durable reversal/history and retention are not implemented. |
| U11 | P1: Bounded event feeds also serve dedupe/history | Open | None | Permanent receipts, protected restore bases and safe pruning required. |
| U12 | P1: Old queues, rolls and sync can outlive a restored timeline | Open | None | Restore epoch/revision and stale-work rejection have not been delivered. |
| U13 | P1: Template/instance identity and graph dependencies differ | Open | None | Stable scope/identity links, tombstones and dependency-aware restoration required. |
| U14 | P1: Ordinary load normalizes/defaults instead of exact historical restore | Partial | [PR #11](https://github.com/dstancomb3/DND-Companion/pull/11) | Usage maps no longer silently reset; general exact historical migration/restore loader remains absent. |
| U15 | P1: Images are URI references without durable asset versions | Open | None | PR #15 preserves image fields, not asset ownership, historical bytes or recovery. |
| U16 | P1: General shared DM History/Undo/Restore UI is absent | Partial | [PR #10](https://github.com/dstancomb3/DND-Companion/pull/10) | Misleading local Undo removed and limitation shown. No usable guarded Undo Last DM Change or Restore Checkpoint UI. |
| U17 | P0: Storage read errors become empty data before replacement | Open | None | Fail closed on unreadable/corrupt stores; distinguish absent from failed reads and serialize/version writes. |

### History roadmap checkpoints

| Slice | Status | Delivered / missing |
| --- | --- | --- |
| H0 | Partial, H0a contained | PR #10 blocks unsafe undo. Exact reversible capture and guarded inverse application still needed. |
| H1 | Partial, H1a delivered | PR #11 persists limited-use maps. Full authority-scoped codecs/writer inventory and read-failure semantics still needed. |
| H2 | Planned | Atomic immutable history, live aggregate ownership/revisions and permanent receipts. |
| H3 | Planned | Durable delivery/recipient/dependency tracking. PR #15 is field preservation, not completion of H3. |
| H4 | Planned | Coherent versioned full checkpoints and pre-restore safety checkpoint. Campaign continuation saves are not complete game checkpoints. |
| H5 | Planned | Authorized, revision-checked undo/restore as new immutable commands/timelines. |
| H6 | Planned | Usable DM History and reviewed shared restore with reconnect convergence. |
| H7 | Planned | Retention, quotas, asset versions, compaction and rehearsed recovery. |

## Later audit: item creation and application

Source: [item creation audit](audits/item-creation-api-audit.md), baseline main
after PR #11. All 20 original IDs retained. PRs #13–#15 implement bounded slices;
no broad item-finding closure is inferred from a passing probe or merged adapter.

| ID | Priority / finding | Status | Merged evidence | Remaining work / exact limit |
| --- | --- | --- | --- | --- |
| I01 | P0: Designer uses hardcoded localhost description URL | Open | None | Existing API URL adapter/device configuration and truthful failure status still needed. |
| I02 | P0: Description API ignores supplied effects and invents mechanical prose | Open | None | Define flavor-only or typed unapproved proposal contract; reconcile prose with authoritative effects. |
| I03 | P1: Async generation/fallback can overwrite a changed or cleared draft | Open | None | Draft identity/revision, cancellation and stale-result rejection still needed. |
| I04 | P0: DM campaign saves discard structured mechanics | Partial | [PR #13](https://github.com/dstancomb3/DND-Companion/pull/13), [PR #15](https://github.com/dstancomb3/DND-Companion/pull/15) | Save/normalization/notes-edit and supported delivery fields retained. Complete versioned creator→stored-item→load→equip acceptance and cross-consumer contract still pending. |
| I05 | P0: DM generation and draft adapters clear item fields/default choices | Partial | [PR #15](https://github.com/dstancomb3/DND-Companion/pull/15) | Supported fields/full snapshots survive both assignment modes; canonical-only items receive no invented legacy defaults. Full schema/unsupported-field reporting and device generation→claim acceptance remain unproven. |
| I06 | P0: Creation accepts unsafe counts, dice, IDs and effect scalars | Partial | [PR #13](https://github.com/dstancomb3/DND-Companion/pull/13), [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14), [PR #15](https://github.com/dstancomb3/DND-Companion/pull/15) | Positive safe-integer creation counts, bounded dice/types/nesting, finite values and supplied-effect guards added. Shared operation schemas, trusted stable identities and complete nested numeric/usage validation remain open. |
| I07 | P1: Requested generation rarity/category constraints are prompt-only | Open | None | Post-parse enforcement of requested constraints or a typed violation/review result required. |
| I08 | P1: Malformed empty success, wrong provenance and blank flavor | Partial | [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14) | Missing/malformed item lists now fail normalization. SourceType still defaults to photo; operation-specific empty/no-detection semantics and item-properties trimmed-empty validation remain open. |
| I09 | P0: Shallow mechanics admission can keep a model verified label | Partial | [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14) | Bad envelopes/definition shapes quarantined; model verified labels downgraded. Full shared discriminated schemas and supported compiler capability checks remain open. |
| I10 | P0: Immunity/reflection prose bypasses required review | Partial | [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14), [PR #15](https://github.com/dstancomb3/DND-Companion/pull/15) | Damage-response heuristics require review, including beside supported stats; DM delivery requires acknowledgement without verification promotion. Claim-by-claim evidence coverage and actual reflection execution remain open. |
| I11 | P0: Name merges create hybrid variants and inconsistent counts | Partial | [PR #13](https://github.com/dstancomb3/DND-Companion/pull/13), [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14) | Conservative variant/stack keys replace name-only positive merges; ambiguous removals refused. Definition/instance/observation identity and reviewed overlap counting remain open; server sum and photo-review max are intentionally still distinct. |
| I12 | P1: Proposal and inventory adapters discard metadata | Partial | [PR #13](https://github.com/dstancomb3/DND-Companion/pull/13), [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14), [PR #15](https://github.com/dstancomb3/DND-Companion/pull/15) | Value/weight/subtype, weapon/action fields and full supported delivery snapshots retained. Attunement and complete field contract/unsupported-field reporting still needed. |
| I13 | P0: Repeated accepted proposals can duplicate inventory | Open | None | No durable acceptance command/receipt with inventory state/history commit; navigation and generation keys do not establish exactly-once application. |
| I14 | P1: Retry/replay coverage differs across proposal routes and clients | Open | None | Stable operation keys/hashes, durable response handling and visible degraded protection remain required. |
| I15 | P0: Model officialMatch becomes unverified Official status | Partial | [PR #13](https://github.com/dstancomb3/DND-Companion/pull/13), [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14) | Differing provenance no longer blindly combines incompatible variants. Model officialMatch still is not trusted-catalog evidence; source/edition/version lookup required. |
| I16 | P1: Generic/missing OpenAPI and cast-only network contracts | Partial | [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14), [PR #15](https://github.com/dstancomb3/DND-Companion/pull/15) | Local server guards and draft envelope checks added. No unified shared schema/generated contract regeneration or complete deep client validation. |
| I17 | P0: AI caller authorization, budgets and expensive-input controls absent | Open | None | Same underlying request-security risk as O05; output validation does not fix auth, quotas, concurrency or upload memory exposure. |
| I18 | P1: Provider output/failure/deadline/cancellation policy incomplete | Open | None | Strict outputs, finish/refusal/truncation handling, bounded recovery, sanitized errors/trace IDs and tested SDK retry/deadline policy remain required. |
| I19 | P1: Read-failure overwrite, hidden save errors and split delivery/history | Partial | [PR #13](https://github.com/dstancomb3/DND-Companion/pull/13), [PR #15](https://github.com/dstancomb3/DND-Companion/pull/15) | Designer save failures now visible and delivery field loss repaired. Read failures still look empty; serialized durable writes, claim/save receipts and complete item history remain open (U08/U17). |
| I20 | P1/P2: Missing rules/edition/input context; body/zero/default bugs | Partial | [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14), [PR #15](https://github.com/dstancomb3/DND-Companion/pull/15) | Zero metadata retained in creation/delivery; canonical-only draft defaults avoided. Rules/edition/attunement/equip policy, item-properties input validation and zero context remain open. |

## AI DM and deterministic combat roadmap

[PR #2](https://github.com/dstancomb3/DND-Companion/pull/2) added the supplied
[convergence plan](ai-dm-combat-convergence-plan.md). PR #9 linked the history
requirements. No PR in this backfill implements the complete proposed engine.

| Planned boundary | Status through PR #15 |
| --- | --- |
| Phase 0 authority map / fallback | Baseline repair delivered in PR #6; comprehensive owner map, feature-flag/fallback gates and full release baseline remain incomplete. |
| Phase 1 roll-stall diagnosis / durable roll handshake | Open: no reproduced trace and corrective slice recorded here. |
| Phase 2 session orchestration / common command authority | Planned; H0a/H1a do not provide transactional shared history or authoritative AI turns. |
| Phase 3 combat/multiplayer convergence | Planned beyond pre-existing bounded resolver/remote-apply support. |
| Phase 4 generalized effects and Fireball immunity/reflection | Planned. Existing damage mitigation is not a complete triggered/reflection engine. Item review flags do not execute reflection. |
| Phase 5 world/campaign continuity | Checkpoint persistence/conflict fixes landed, but full shared world orchestration and rollback remain planned. |
| Phase 6 usability/production hardening | Partial baseline/client containment only; full security, quotas, observability, release/device acceptance remain open. |

## Rollout and operator evidence

These are separate from merged implementation. They are reports from this
conversation, not a fresh inspection of a connected database or the user's
laptop. No credentials, connection strings or private host/member tokens belong
in this log.

| Step | Evidence / current rollout status |
| --- | --- |
| User environment | Reported Windows PowerShell, Node 20.20.2, environment file present, DATABASE_URL configured and connection successful. Not a Windows application acceptance run. |
| Backup before schema setup | User reported a consistent read-only JSON export of party_sessions (158 rows), party_members (190), party_runtime_snapshots (142), stored outside the repo. Logical row backup only; pg_dump was unavailable. This is not a full PostgreSQL/schema/assets backup or a tested restore. |
| Campaign/AI table setup | User reported committed creation of campaign_continuation_snapshots and ai_idempotency_records. Verified client_saved_at is bigint and idempotency key is text. Not verification of every column, index, transaction or restart behavior. |
| Existing timestamp migration | [Manual bigint SQL](../lib/db/migrations/manual/20261021_campaign_timestamp_bigint.sql) retained for environments with an existing integer column. User's reported new table already uses bigint. |
| Host/member capability columns | [Host SQL](../lib/db/migrations/manual/20261022_party_host_token.sql), [member SQL](../lib/db/migrations/manual/20261022_party_member_token.sql). No completion report recorded; rollout unverified. Apply both before the matching API; member reads can fail when columns are missing. Matching clients must enroll/rejoin with new IDs. |
| Live save/load/server restart | Deferred by user; still unverified. Table setup does not establish durability or complete migration acceptance. |
| Deployment | PRs are merged to main for pull/testing. No application deployment, connected DB migration or production acceptance was performed by these implementation PRs. |
| Agent validation environment | Linux, Node 24.19.0, pnpm 11.25.0. Mocked boundaries and .mts/CommonJS temporary-copy limitations are recorded in the relevant PRs/docs. |
| Browser/mobile/two-device/real DB acceptance | Open across permission, persistence, item delivery and rollback boundaries. |

Rollout/rollback detail: [campaign saves](campaign-save-recovery.md),
[host permissions](party-host-permissions.md),
[member permissions](party-member-permissions.md),
[undo containment](local-undo-containment.md),
[usage snapshot coverage](snapshot-effect-usage.md) and
[runtime baseline](runtime-baseline.md).
AI proposal replay may still degrade without persistence; campaign checkpoint
HTTP commits fail closed. These behaviors must not be conflated.

## Current handoff

| Item | State | Next concrete evidence |
| --- | --- | --- |
| REC-01 original “15 issues” reconciliation | Unverified | Recover the original numbered artifact if available; preserve wording/severity and map each real finding. Until then retain the five recovered O IDs and do not claim a completion percentage. |
| This implementation-log backfill | Documentation only | Coverage of PRs #1–#15, U01–U17, I01–I20 and H0–H7; evidence/links checked; workspace typecheck and 24-test combat baseline rerun for this documentation change. Full historical suites not rerun. No new runtime fix or migration. |
| Original-scope permission/AI exposure work | O02 partial / O05 open | O02-A1 maps all 33 routes and protects DM note creation; O02-A2 protects accept/decline recipients. Select the next bounded remaining policy using the map; 22 mutation handlers and read privacy remain open. AI caller/usage controls are unchanged. |
| New claim-recovery proposal | Open, not activated by this backfill | U08/I13/I19 specify the gap. Durable receipt/state ownership, failure matrix and priority decision required before implementation. |
| Full undo / combat engine / AI DM | Planned or partial as above | Continue the existing roadmap with its authority/acceptance gates, not a parallel implementation track. |

## Pass record: 2026-10-22 O02-A1 (PR #17)

- **Scope:** original finding O02, related U09. User-directed return to the original audit, not a new item/undo feature track. Narrow authorization boundary: DM note assignment creation. [Route map](party-permission-map.md) covers all 33 declarations with implemented vs proposed policies.
- **Before → after:** code-only callers could author DM quest/people/location assignments. Original-host bearer proof is now checked before activity refresh, expired-session deletion, member reads or runtime hydration/writes. Wrong-party/member/legacy/body/role/hash-as-token attempts fail closed; valid hosts keep payload normalization, target checks and persistence. Server derives DM origin.
- **Authority:** server remains the permission owner. Client credential transport and OpenAPI changes are jointly necessary to enforce the existing host-capability policy without breaking the authorized DM notes path. No gameplay authority moved. Loot creation remains unchanged because players use it to transfer items; host-only gating there would break that flow and would not prove inventory ownership.
- **Touched files:** `artifacts/api-server/src/routes/party.ts`; new `artifacts/api-server/src/routes/party.note-assignment-safety.test.ts`; `artifacts/api-server/package.json` (includes new regression suite); `artifacts/living-character-sheet/utils/partyHostApi.ts`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/tests/state/party-host-api.test.cts`; `lib/api-spec/openapi.yaml`; new `docs/party-permission-map.md`; `docs/party-host-permissions.md`; `docs/party-member-permissions.md`; `docs/app-map.md`; `docs/feature-status.md`; `docs/migrations.md`; this log. No UI screen, DB schema, credentials, lockfile or generated API bindings changed.
- **Validation:** 11 new direct route tests and 3 new client tests; 87 focused server/client tests (including existing sync/member/host/remote-apply/AI idempotency and member-client tests), workspace typecheck and 24 combat safety tests pass. Nine route tests fail against prior code, including all eight denial cases. Frozen install, map coverage of all 33 handlers, OpenAPI bearer/403 parsing, local documentation links and diff checks pass. Root/test counts overlap other historical results; no project-wide sum.
- **Rollout/rollback:** no new migration. Existing host-token column must be provisioned; deploy matching client/API. Old clients, unclaimed legacy sessions and DM watching devices lacking host proof cannot send notes. Existing error UI reports failure; client retains credentials for explicit retry. Roll back client/server together if needed, leaving columns intact; server rollback reopens the vulnerability. No deployment or connected database write performed.
- **Remaining:** O02 is still partial. Note accept/decline, read visibility, loot awards/transfers, NPC/encounter, initiative/economy/roll/rest/event routes remain mapped gaps. Recipient claim/save receipts are not implemented; authorization and session/runtime commit are not one transaction. Delegated DM access/recovery/rotation, real PostgreSQL/HTTP/browser/mobile and concurrent disband/recreate acceptance remain open. O05, REC-01 and combat/AI DM implementation status are unchanged.


## Pass record: 2026-10-22 O02-A2 (PR #18)

- **Scope decision:** user authorized the next original-audit slice. Continue O02 with note recipient proof, following O02-A1 author proof. U09 is a related authorization dependency; no new rollback, item or engine subsystem is activated.
- **Before → after:** accept/decline trusted a supplied recipient ID. Server now checks session existence and live persisted proof for the exact party/member pair before activity refresh, expiry cleanup or runtime hydration. Host/other-member/body/legacy/removed proof cannot substitute. Existing assignment-target and accepted-state checks remain. Authenticated wrong-recipient attempts cannot mutate assignments, although existing session activity refresh still occurs.
- **Files touched:** `artifacts/api-server/src/routes/party.ts`; new `artifacts/api-server/src/routes/party.note-recipient-safety.test.ts`; `artifacts/api-server/package.json`; `artifacts/living-character-sheet/utils/partyMemberApi.ts`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/tests/state/party-member-api.test.cts`; `lib/api-spec/openapi.yaml`; `docs/party-permission-map.md`; `docs/party-member-permissions.md`; `docs/party-host-permissions.md`; `docs/feature-status.md`; `docs/migrations.md`; this log. No screen, schema column, lockfile or generated API bindings changed.
- **Authority/client:** server remains permission owner. Matching client transports persisted member proof, preserves JSON headers, returns typed accept/decline results, retains proof on transport/generic errors and removes it on explicit member-access rejection. Existing sync/leave behavior is regression tested. No auto-retry added.
- **Validation:** 22 new direct route tests and 6 new client tests; 115 focused server/client tests, workspace typecheck and 24 combat safety tests pass. Fourteen route tests fail on previous source. Tests cover exact SQL party/member predicate, zero pre-auth writes/hydration, host substitution, missing input, wrong recipient, absent assignment, accepted-state behavior, normalized persistence and credential handling. Frozen install, all 33 mapped route declarations, 22 remaining open mutation rows, both OpenAPI bearer contracts, local links and whitespace checked. Storage/DB boundaries are mocked; no live PostgreSQL, HTTP/browser/mobile or concurrent-removal/recreate acceptance.
- **Rollout/rollback:** no new migration; prior host/member columns and matching client/API required. Legacy players rejoin; old clients fail closed for note receipt. Revert matching client/server together if needed, leaving columns intact; server rollback reopens recipient spoofing. No connected database change or deployment performed.
- **Remaining:** O02 stays partial. Read visibility and 22 mutation handlers remain open. Authorization and session/runtime commit still race concurrent membership/session changes. Server acknowledgement remains separate from local journal saving: no durable exactly-once application or recovery receipt is implemented. O05, REC-01 and full rollback/combat/AI DM status are unchanged.


## Keep this log current

1. Before selecting a task, read this log and the source audit. State the existing
   finding ID(s), intended boundary and acceptance limit. Put discoveries under
   the correct original/later scope; do not silently expand the active task.
2. For each implementation PR, update the affected finding rows and append a
   history row: PR/merge, scope, changed behavior, validation, migration/rollout,
   rollback and remaining limitations. A documentation/specification PR gets
   no runtime completion credit. Record already-authorized follow-ups without
   adding unnecessary approval stops.
3. Preserve finding IDs, baseline evidence and prior implementation rows.
   Supersede status with linked evidence rather than rewriting history. If
   this backfill's reconstruction is corrected, retain an explicit correction.
4. “Fixed (scoped)” needs a concrete defect, implementation and meaningful
   verification. “Contained” stays contained until a usable safe replacement
   passes acceptance. Keep mocked tests and live checks distinct.
5. Add scope changes as dated decisions with their reason and relation to the
   user-approved goal. A new audit is evidence, not automatic authorization to
   build every proposed subsystem.
6. Update feature-status/migrations when behavior or rollout status changes.
   Historical test counts overlap; no summed project completion metric.
   Never store secrets or historical credentials in snapshots or this log.

Entry template:

```text
Date / PR / merge:
Scope and finding IDs:
Before → after:
Affected authority and files:
Validation run and limitations:
Schema / rollout / rollback:
Finding status and remaining acceptance:
Scope decision / dependency:
```

