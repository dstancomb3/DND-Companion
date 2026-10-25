# Implementation log and audit reconciliation

Backfilled 2026-10-22. Historical coverage: PRs #1–#15 through main commit
`c69f7d34c50aecea862e994622e52765d4bf9afc`.
Merge dates below use America/Chicago (UTC−05:00 on these dates).
This log records this collaboration's work, not every feature that predated it.
Subsequent passes are appended below; latest recorded pass: T01-PG1 ([PR #35](https://github.com/dstancomb3/DND-Companion/pull/35)).

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
| O02 | High: party code/caller IDs grant destructive or cross-member access | Partial | [PR #7](https://github.com/dstancomb3/DND-Companion/pull/7) host proof for disband; [PR #8](https://github.com/dstancomb3/DND-Companion/pull/8) member proof for direct sync/leave and host removal; [PR #17](https://github.com/dstancomb3/DND-Companion/pull/17) host proof for DM note creation; [PR #18](https://github.com/dstancomb3/DND-Companion/pull/18) recipient proof for accept/decline; [PR #19](https://github.com/dstancomb3/DND-Companion/pull/19) own-member gates for initiative, roll response, rest request/ack and loot claim; [PR #20](https://github.com/dstancomb3/DND-Companion/pull/20) host proof for rest approval/denial; [PR #22](https://github.com/dstancomb3/DND-Companion/pull/22) host proof for initiative start, participant addition and encounter end; [PR #24](https://github.com/dstancomb3/DND-Companion/pull/24) host proof for roll-prompt creation; [PR #25](https://github.com/dstancomb3/DND-Companion/pull/25) caller proof for six non-NPC mutations and battle-scoped end-turn; [PR #26](https://github.com/dstancomb3/DND-Companion/pull/26) host proof for five NPC instance controls; [PR #27](https://github.com/dstancomb3/DND-Companion/pull/27) host NPC creation/member companion submitter proof; [PR #28](https://github.com/dstancomb3/DND-Companion/pull/28) committed live companion identity/reuse | Remaining canonical companion ownership/lifecycle and campaign authorization, read privacy, inventory/combat truth; read/invite/recovery policies; schema rollout and real-client tests. Not full character-state protection. |
| O03 | High: name/class/max-HP/AC dedupe collapses distinct characters | Fixed (scoped) | [PR #1](https://github.com/dstancomb3/DND-Companion/pull/1) groups by stable member ID | Repeated enrollment IDs remain distinct intentionally; ID migration/reference cleanup and live party QA remain separate. |
| O04 | High: recovered DB reads can roll back newer fallback campaign saves | Fixed (scoped) | [PR #3](https://github.com/dstancomb3/DND-Companion/pull/3) cache ordering/bigint; [PR #4](https://github.com/dstancomb3/DND-Companion/pull/4) durable checkpoint+receipt commit; [PR #5](https://github.com/dstancomb3/DND-Companion/pull/5) atomic expected-token writes and durable reads | Guarded HTTP checkpoint boundary; compatibility memory helper is not a durable outbox. Real PostgreSQL, two-device, restart and delete/concurrency acceptance still pending. |
| O05 | High when publicly reachable: AI routes lack app authentication/rate limits and accept memory-buffered uploads | Open | API output validation in [PR #14](https://github.com/dstancomb3/DND-Companion/pull/14) does not close request authorization or usage budgets | Caller/campaign authorization, quotas/concurrency, bounded expensive input/image handling and abuse tests. Also I17. |
| T01 | Additional testing observation: standard validation omits existing tests; no GitHub Actions | Partial | [PR #1](https://github.com/dstancomb3/DND-Companion/pull/1) includes sync regressions; [PR #6](https://github.com/dstancomb3/DND-Companion/pull/6) repairs install/typecheck/combat baseline | [PR #35](https://github.com/dstancomb3/DND-Companion/pull/35) adds scoped CI with successful Linux/Node 20.20.2/PostgreSQL 16.15 HTTP lifecycle coverage; comprehensive release gate, Windows/browser/mobile and broader DB acceptance remain open. T01 is not counted as a sixth recovered major finding. |

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

| [PR #19](https://github.com/dstancomb3/DND-Companion/pull/19) · 2026-10-22 · O02-A3 | Original O02 / related U09 | Gate member initiative, roll response, rest request, rest acknowledgement and loot claim before side effects; reuse live proof with matching client transport. | 173 focused server/client tests, workspace typecheck, 24 combat tests; 35 old-source regressions fail, including 30 denied-caller cases. Map and strict OpenAPI/YAML checks pass. | Existing columns and matching client/API; 11 proof-gated handlers and 17 open mutations. No server-dice, inventory-ownership, transactional delivery or concurrency completion. |
| [PR #20](https://github.com/dstancomb3/DND-Companion/pull/20) · 2026-10-22 · O02-A4 | Original O02 / related U09 | Require original-host proof before rest approval/denial side effects; transport stored proof and stamp DM origin server-side. | 194 focused server/client tests, workspace typechecks, 24 combat tests; 10 new tests fail on prior source, including all eight denied-caller cases. Strict YAML and all 33 mapped routes checked. | No new migration; existing host column and matching API/client required. Twelve gated handlers, 16 open mutations; rest recovery/concurrency and live acceptance remain open. |
| [PR #21](https://github.com/dstancomb3/DND-Companion/pull/21) · 2026-10-22 · live QA | QA-N01 scoped fix / QA-N02 open | Add standalone journal note selection, host-authorized transport and local journal application; refresh saved DM payload before sending and show quest status. | 203 focused tests, workspace typecheck and 24 combat tests; three new server regressions fail on previous code. | No new migration; matching API/client. Quest completion report not reproduced or declared fixed. Local receipt recovery and graph remapping remain open. |
| [PR #22](https://github.com/dstancomb3/DND-Companion/pull/22) · 2026-10-22 · O02-A5 | Original O02 / related U09 | Original-host proof before initiative start, encounter add/end side effects; shared DM/demo/AI DM adapter transport and visible DM start errors. Caller/role map recorded. | 254 focused tests, workspace typechecks, 24 combat tests; 22 existing encounter tests via temporary .cts copies. All 24 new denied-caller regressions fail on previous code. | No new migration; matching API/client and creator-device capability required. Fifteen proof-gated handlers, 13 open mutations; full AI orchestration and delegated roles remain open. |
| [PR #23](https://github.com/dstancomb3/DND-Companion/pull/23) · 2026-10-22 · usage audit | AIU01–AIU08 / related O05 | Inventory twelve model-calling handlers; assess deterministic bypass, retrieval, cache/replay and MiniLM fit. Documentation only. | Source/caller inventory, primary model/runtime docs, local links/IDs and whitespace checked; workspace typechecks and 24 combat tests pass. | No model download, paid call, runtime change or migration. Savings/latency unknown. Prefer measured exact-command bypass before conditional embedding retrieval. |
| [PR #24](https://github.com/dstancomb3/DND-Companion/pull/24) · 2026-10-22 · O02-A6 | Original O02 / related U09 | Require original-host proof before roll-prompt authoring side effects, matching client transport and visible DM errors; map NPC/companion callers separately. | 278 focused tests, workspace typechecks, 24 combat tests; eight denied-author tests fail on prior source. New/reused campaign adapter paths covered. | No new migration; matching API/client. Sixteen proof-gated handlers, 12 open mutations. NPC creation, battle/stat validation and workflow atomicity remain open. |
| [PR #25](https://github.com/dstancomb3/DND-Companion/pull/25) · 2026-10-23 · O02-A7 | Original O02 / related U09 | Six non-NPC mutation proof gates, own-battle end-turn, report kind restrictions and authenticated loot origin. | 396 focused tests, workspace typechecks, 24 combat tests; 62 of 85 new route tests fail on old source. | Matching client/API, existing columns; 22 proof-gated handlers, six open NPC mutations. Inventory/combat truth, reads and races remain open. |
| [PR #26](https://github.com/dstancomb3/DND-Companion/pull/26) · 2026-10-23 · O02-A8 | Original O02 / related U09 | Host proof for five direct NPC instance controls; matching DM/AI transport and surfaced failure messages. | 482 focused tests, workspace typechecks, 24 combat tests; all 40 denied-caller tests fail on old source. | Matching API/client, existing host column; 27 proof-gated handlers, one open creation mutation. Companion ownership, read privacy and concurrency remain separate. |
| [PR #27](https://github.com/dstancomb3/DND-Companion/pull/27) · 2026-10-22 · O02-A9 | Original O02 / related U09 | Host NPC creation proof and separate constrained companion submitter proof with own-battle placement. | 535 focused tests, workspace typechecks, 24 combat tests; 34 of 43 new route tests fail on old source. | Existing capability columns, matching client/API; 28 proof-gated handlers, three public bootstrap and two open reads. Companion ownership/lifecycle and read/commit gaps remain open. |
| [PR #28](https://github.com/dstancomb3/DND-Companion/pull/28) · 2026-10-22 · O02-A10 | Original O02 / related U09 | Player-managed admission policy and server-stamped live identity; repeat Add reuses committed combat state without resets or duplicate events. | 549 focused tests, workspace typechecks, 24 combat tests; ten of 12 new route tests fail on old source. | Additive runtime JSON v1, no SQL migration; no permanent receipt/tombstone or leave/rejoin cleanup. Canonical ownership and general races remain open. |


| [PR #29](https://github.com/dstancomb3/DND-Companion/pull/29) · 2026-10-23 · DEP01 | User-requested cloud preview preparation | Protected same-origin browser/API recipe, automatic main builds, setup guide. | 558 regressions, 24 combat tests, workspace typechecks, web/API export and HTTP smoke. | Hosting acceptance separate; O05 remains open. |
| [PR #30](https://github.com/dstancomb3/DND-Companion/pull/30) · 2026-10-23 · DEP02 | Preview startup follow-up | Direct Node startup and pinned build pnpm after hosted memory failure. | Nine focused preview tests, compiled HTTP smoke, baseline. | User later confirmed startup/login; hosted DB and icon issue remain open. |
| [PR #31](https://github.com/dstancomb3/DND-Companion/pull/31) · 2026-10-23 | User-directed development resumption | Pause cloud setup and audit atomic companion departure boundary. | Documentation/source inspection only. | No lifecycle implementation credit. |
| [PR #32](https://github.com/dstancomb3/DND-Companion/pull/32) · 2026-10-23 · O02-A11 | Original O02 / related U09 | Transactional departure, retained detached companions and no automatic rejoin claim. | 572 regressions, typechecks, 24 combat tests. | Additive runtime v1 metadata; no SQL migration; initial tests mocked DB. |
| [PR #33](https://github.com/dstancomb3/DND-Companion/pull/33) · 2026-10-24 · O02-A12 | Original O02 / related U09 | Reviewed original-host recovery, preserved live data and bounded audit. | 598 regressions, baseline, web/API build and HTTP smoke. | Permanent ledger/canonical roster remain open. |
| [PR #34](https://github.com/dstancomb3/DND-Companion/pull/34) · 2026-10-24 · O02-A13 | Original O02 / related U09 | Transactional admission/reuse with shared departure/recovery lock ordering. | 612 regressions, baseline, API build and HTTP smoke. | Companion scope only; initial concurrency tests modeled serial orders. |
| [PR #35](https://github.com/dstancomb3/DND-Companion/pull/35) · 2026-10-24 · T01-PG1 | Testing T01 / original O02 freshness | Isolated PostgreSQL/HTTP CI, real lifecycle/rollback/concurrency cases and durable combat reads. | CI 40112334408: 11 PG tests, 613 regressions, eight guards, workspace typechecks and 24 combat tests. | PG 16.15/two processes; broader DB, crash/restart and device acceptance remain open. |


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

## Later audit: AI API usage and MiniLM

User explicitly requested this audit after O02-A5. Source:
[AI API usage and MiniLM suitability audit](audits/ai-api-usage-minilm-audit.md),
baseline `35e2441e72c3da43a0f9c3c337e461d23959ec6d`.
These findings are separate from the original audit and later U/I scopes.
All are documented opportunities/gaps, not implemented fixes or measured savings.

| ID | Finding | State / next evidence |
| --- | --- | --- |
| AIU01 | No provider token/cost usage ledger in inspected routes | Open: measure requests/usage/attempts and latency before economic claims. |
| AIU02 | Explicit bookkeeping still calls generative parse-update | Proposed: evaluate a bounded full-input grammar using existing proposal/review paths. |
| AIU03 | Some mechanics/data work is already local or redundantly generated | Open opportunity: retain deterministic progression/JSON import; stop generating discarded item mechanics prose where appropriate. |
| AIU04 | Context retrieval may improve candidate lists/memory | Conditional: compare lexical baseline and MiniLM, preserve mandatory state and access scope. |
| AIU05 | Retry/idempotency gaps can duplicate upstream work | Open: stable logical operations/context-aware replay; separate from semantic similarity and game mutation receipts. |
| AIU06 | Implemented routes and actual callers differ | Open evidence gap: two model routes have no first-party caller found; unused help hook requests a missing route. |
| AIU07 | No embedding runtime; web/native integration is unmeasured | Conditional: disabled-by-default retrieval experiment only after benefit/device gates; no dependency added. |
| AIU08 | Similarity does not establish game semantics or authority | Open boundary: exact IDs/rules/review and O05 caller/usage controls remain required. |

MiniLM is recommended only as a possible ranking/retrieval component. No direct
replacement for structured mutation parsing, vision, narration or deterministic
combat is proposed. The next implementation scope is not activated by this audit.

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
| Host/member capability columns | [Host SQL](../lib/db/migrations/manual/20261022_party_host_token.sql), [member SQL](../lib/db/migrations/manual/20261022_party_member_token.sql). Operator reported both migrations committed on 2026-10-22 and verified both columns as nullable text in the configured database. Fresh five-table JSON data backup saved before migration. Other environments remain unverified. Matching clients enroll/rejoin with new IDs. |
| Live save/load/server restart | Deferred by user; still unverified. Table setup does not establish durability or complete migration acceptance. |
| Deployment | PRs are merged to main for pull/testing. No application deployment, connected DB migration or production acceptance was performed by these implementation PRs. |
| Agent validation environment | Agent: Linux, Node 24.19.0, pnpm 11.25.0. Operator: Windows Node 20.20.2/pnpm 10.33.0; frozen install, workspace typecheck and 24 combat tests passed; API/web startup reported working. Mocked boundaries and .mts/CommonJS limitations remain as recorded. |
| Browser/mobile/two-device/real DB acceptance | In progress: operator reached gameplay testing and reported QA-N01/QA-N02 below. Full permission, persistence, delivery, rollback and restart acceptance remains open. |

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
| Original-scope permission/AI exposure work | O02 partial / O05 open | O02-A1/A2 protect DM note authoring and recipients; O02-A3 protects five member-owned actions. O02-A4 protects host rest approval/denial. O02-A5 maps those callers and gates initiative start/add/end with host proof. O02-A6 protects roll-prompt creation and maps NPC callers. O02-A7 protects six non-NPC mutations and fixes battle-scoped end-turn. O02-A8 protects five NPC instance controls. O02-A9 adds proof to NPC creation and constrained member companion admission. All twelve previously open non-bootstrap mutations now check proof; canonical companion ownership/lifecycle, public read privacy/side effects, public bootstrap abuse, proof-to-commit races and gameplay truth remain open. User selected player-managed immediate admission with DM oversight. O02-A10 adds server-stamped live identity and committed-instance reuse without resets. O02-A11 now implements guarded owner-leave detach/retention. O02-A12 adds reviewed original-host recovery. O02-A13 adds shared transactional admission/reuse proof. T01-PG1 now verifies 11 lifecycle cases with PostgreSQL 16.15 and independent HTTP API processes. Broader DB/production acceptance remains open; canonical roster validation, other mutation races and permanent receipts remain open. Legacy owner metadata grants no rights. AI caller/usage controls are unchanged. |
| New claim-recovery proposal | Open, not activated by this backfill | U08/I13/I19 specify the gap. Durable receipt/state ownership, failure matrix and priority decision required before implementation. |
| AI usage / lightweight model exploration | Deferred by user; no implementation | PR #23 remains audit evidence. User considered a small reasoning model, then explicitly deferred model work and resumed O02. No model/runtime, parser fast path or telemetry integration activated; no measured savings claimed. |
| Live notes/status QA | QA-N01 live retest pending / QA-N02 open | User deferred retesting PR #21 and authorized the encounter-control pass. Do not claim the reported Active-to-Completed behavior fixed without source/sent/local status evidence. |
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


## Pass record: 2026-10-22 O02-A3 (PR #19)

- **Scope decision:** user requested the remaining caller-proof gates. This pass covers five coherent own-member actions under original O02: initiative roll, roll response, rest request, rest acknowledgement and loot claim. DM/combat/mixed-role gates remain explicit follow-ups, not claimed complete. U09 is related; no new engine/history subsystem is activated.
- **Before → after:** supplied member IDs could trigger these operations without proof. They now use the live exact-party/member hash check before activity refresh, expiration cleanup or runtime access. Body DM flags/tokens, host substitution, legacy/removed/wrong-party proof fail closed. Existing target, reroll, approval, total-normalization and persistence behavior remains. Authenticated non-target attempts cannot mutate requests/assignments but may refresh existing session activity.
- **Touched files:** `artifacts/api-server/src/routes/party.ts`; new `artifacts/api-server/src/routes/party.member-action-safety.test.ts`; `artifacts/api-server/package.json`; `artifacts/living-character-sheet/utils/partyMemberApi.ts`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/tests/state/party-member-api.test.cts`; `lib/api-spec/openapi.yaml`; `docs/party-permission-map.md`; `docs/party-member-permissions.md`; `docs/feature-status.md`; `docs/migrations.md`; this log. No screen, capability column, lockfile or generated bindings changed.
- **Authority/client:** renamed the note-recipient helper to authorizePartyMember and reused it for the same ownership boundary. Client exports retain existing signatures/results through the member adapter, sending stored bearer proof with JSON headers. Revocation invalidates only the relevant credential; transport errors retain it. Demo bootstrap already enrolls/stores member proof. No host-only gating of player transfers, companion creation or mixed DM combat actions.
- **Validation:** 48 new direct-route tests and 10 new client tests; 173 focused server/client tests, workspace typecheck and 24 combat safety tests pass. Thirty-five new route tests fail on old source, including all 30 authorization-denial cases. Tests assert exact SQL party/member scope, zero denied writes/hydration, valid persistence, foreign target rejection, compatible results and credential handling. Frozen install, exact coverage of 33 routes, 17 open mutation rows, five bearer contracts, unique YAML keys, local links and whitespace checked. DB/storage boundaries mocked; no live PostgreSQL/HTTP/browser/mobile or concurrent removal/session acceptance.
- **Rollout/rollback:** no new migration; existing capability columns and matching API/client required. Old clients fail closed; legacy members rejoin. No deployment or connected DB write. Revert matching client/server together if needed; server rollback restores spoofing exposure, columns stay intact.
- **Remaining:** O02 partial: 11 proof-gated handlers, three bootstrap handlers, two open reads and 17 open mutations. Rest approval, roll-prompt creation, loot award/transfer authoring, event/DM/NPC/encounter/combat controls still need role policy and proof. Caller proof does not prove fair server-recorded dice, client modifiers, inventory ownership/debit, immutable receipts or atomic rest/loot application. Public read privacy and authorization-to-commit races remain open. O05, REC-01 and full undo/combat/AI DM status unchanged.



## Pass record: 2026-10-22 O02-A4 (PR #20)

- **Scope decision:** user approved the recommended next original-audit slice: host rest approval/denial. Original O02 stays partial; U09 is a related dependency. No item, undo or combat-engine expansion.
- **Before → after:** party-code callers could approve/deny rest and choose resolvedBy. Existing host capability is now verified against the persisted party session before activity refresh, expired-session deletion or runtime hydration. Missing/member/other-party/body/legacy/hash-as-token proof fails closed with no writes. Server stamps resolvedBy as dm; existing status, request existence, expiry, event and persistence behavior remains. Known client caller is dm-party.tsx, which already reports errors.
- **Authority/files:** server remains permission owner. Matching client transport and OpenAPI are necessary for this same authorization boundary. Touched `artifacts/api-server/src/routes/party.ts`; new `artifacts/api-server/src/routes/party.rest-host-safety.test.ts`; `artifacts/api-server/package.json`; `artifacts/living-character-sheet/utils/partyHostApi.ts`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/tests/state/party-host-api.test.cts`; `lib/api-spec/openapi.yaml`; `docs/party-permission-map.md`; `docs/party-host-permissions.md`; `docs/feature-status.md`; `docs/migrations.md`; this log. No UI screen, schema column, lockfile or generated binding changes.
- **Validation:** 17 new direct route tests, four new client tests; 194 focused server/client tests pass, including remote apply and AI idempotency safety. Workspace typechecks and 24 combat safety tests pass. Ten route regressions fail against previous source, including all eight denied-caller cases. Frozen install, unique YAML keys/bearer/403/404 contract, exact 33-route map with 16 open mutation rows, local doc links and diff checks pass. DB/storage mocked; no live PostgreSQL, HTTP/browser/mobile or concurrency acceptance.
- **Rollout/rollback:** no new migration; existing host column must be provisioned before matching client/API. Legacy/unclaimed parties, old clients and watcher devices without original-host proof cannot resolve rest. Stored proof survives transport errors; missing proof prevents the client request. Existing nullable host/member migration rollout remains operator-unverified. No deployment or connected DB write. Revert matching client/server together if needed, leaving columns intact; server rollback reopens unauthenticated approval.
- **Remaining/next:** twelve proof-gated handlers, three bootstrap, two open reads and 16 open mutations. Rest lifecycle transition/replay rules, atomic local application/acknowledgement and recovery receipts are unchanged. Delegation/recovery, read privacy and authorization-to-commit races remain open. Next bounded pass should verify host/player/AI DM call sites before encounter-control gating. O05, REC-01 and full undo/combat/AI DM status unchanged.


## Pass record: 2026-10-22 live delivery QA (PR #21)

- **Scope decision:** pause the next O02 encounter-control gate while the user runs local rollout acceptance. Address concrete notes-delivery gaps in the tested workflow. These are later QA findings, not additions invented to fill REC-01 or close original O02.
- **QA-N01, fixed scoped / live retest pending:** plain DM journal notes were absent because the selection UI, transport and local merge supported quests/people/locations only. Optional notes now carry supported title/body/pinned/session/arc/tag/link metadata through the existing host-authorized API, including notes-only sends; player acceptance creates local journal notes with normal local IDs/timestamps. Legacy assignments without notes still work. Sender refreshes on focus and reads saved state at send time; notes send button uses notesSelectedTargets rather than unrelated turn targets.
- **QA-N02, open / not reproduced:** user confirms an unfinished quest appears Completed in the player quest list after accepting. No tested acceptance path converts Active to Completed. Added creation/acceptance/merge regressions preserve supplied status, including updates to previously completed same-name quests. Stale DM editor state was a concrete risk and is corrected; status appears on sender/recipient delivery UI to support a fresh live retest. No blanket status reset or speculative gameplay fix. Need exact source, sent and resulting local status if the report persists.
- **Authority and files:** existing host sender, member recipient and CharacterContext local journal boundaries retained; jointly necessary client/server payload extension, no new auth system. Touched `artifacts/api-server/src/routes/party.ts`; `artifacts/api-server/src/routes/party.note-assignment-safety.test.ts`; `artifacts/api-server/src/routes/party.note-recipient-safety.test.ts`; `artifacts/living-character-sheet/app/dm-party.tsx`; `artifacts/living-character-sheet/app/party.tsx`; `artifacts/living-character-sheet/package.json`; new `artifacts/living-character-sheet/tests/state/party-notes-delivery.test.cts`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/utils/partyNotesMerge.ts`; `lib/api-spec/openapi.yaml`; `docs/app-map.md`; `docs/feature-status.md`; `docs/migrations.md`; this log. No schema or lockfile change.
- **Validation:** four new server tests and five client merge tests, enhanced acceptance payload assertions; 203 focused server/client tests pass, including existing authorization, remote apply and AI idempotency suites. Workspace typecheck and 24 combat tests pass. Three new server regressions fail against previous route. Frozen install, strict unique-key YAML, local docs links, finding ID preservation and whitespace checked. DB/storage mocked; visual/browser UI and operator regression retest pending. No claim of full end-to-end acceptance.
- **Operator rollout evidence:** user preserved divergent laptop history via backup branch and separate worktree at PR #20, with ignored local environment files. Frozen install on Windows Node 20.20.2/pnpm 10.33.0 succeeded. Fresh consistent public-table JSON backup contained 0 idempotency, 0 campaign snapshot, 190 member, 142 runtime and 158 session rows. Operator applied both capability SQL files and verified nullable text columns, then passed workspace typecheck/24 combat tests and reported API/web startup working. This is user-reported configured-DB evidence, not agent deployment or verification of other environments. Full PostgreSQL schema backup/restore was not performed.
- **Rollout/rollback/remaining:** matching API/client required; no new migration. Old API drops notes, old client ignores them, so avoid accepting notes-only deliveries with old clients. Journal note creation appends per delivery and does not implement source identity deduplication, graph-ID remapping or atomic acknowledgement/local-save receipts. Revert API/client together if needed; data is not automatically repaired or erased. O02 remains partial with sixteen open mutation handlers. O05, REC-01 and full undo/combat/AI DM completion unchanged. Resume targeted live notes/status retest before returning to queued encounter authorization work.


## Pass record: 2026-10-22 O02-A5 (PR #22)

- **Scope decision:** user explicitly deferred the live notes/status retest and resumed the original O02 encounter-control agenda. Three coherent controls: initiative start, participant addition and encounter end. U09 is related, not implemented shared rollback. QA-N01 live retest and QA-N02 completion report remain pending/open.
- **Before → after:** party-code callers could change encounters without credentials. authorizePartyHost now checks persisted proof for the exact party before session refresh, expiry cleanup, member reads or runtime hydration/writes. Unknown party returns 404; missing/member/other-party/legacy/malformed/hash-as-token/body/AI-label proof fails closed with 403 party_host_required. Existing active-session, participant filtering, battle existence, ordering, NPC cleanup, event and runtime persistence rules remain. Unrelated battles/initiative survive.
- **Caller/authority audit:** dm-party uses all three; landing demo creates/stores host proof before start; AiDmCombatSubmodePanel uses all three; campaignEncounterRuntime injects startPartyInitiative from the adventure session and may use current party or watched-code fallback. Existing client exports now delegate to partyHostApi without changing signatures/results. AI DM uses the original host capability, not a model response, member token, DM flag or watched-code label. Ordinary joined/watching devices intentionally lose unauthorized control; use the creator device. No automatic ownership claim, role delegation or new party provisioning. DM start handler now catches and displays errors; other DM/AI callers already report them.
- **Touched files:** `artifacts/api-server/src/routes/party.ts`; new `artifacts/api-server/src/routes/party.encounter-host-safety.test.ts`; `artifacts/api-server/package.json`; `artifacts/living-character-sheet/utils/partyHostApi.ts`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/app/dm-party.tsx`; new `artifacts/living-character-sheet/tests/state/party-encounter-api.test.cts`; `artifacts/living-character-sheet/package.json`; `lib/api-spec/openapi.yaml`; `docs/party-permission-map.md`; `docs/party-host-permissions.md`; `docs/app-map.md`; `docs/feature-status.md`; `docs/migrations.md`; this log. Server permission and matching client credential transport are jointly necessary for the same boundary. No schema, lockfile or generated binding changes.
- **Validation:** 36 new direct route tests plus 15 new client/orchestration tests; 254 focused server/client tests pass, including existing notes/member/host/remote apply/AI idempotency checks. All 24 denied-caller cases fail against prior route source; remaining twelve route cases pass there. Coverage includes exact party SQL predicate, zero denied side effects, unknown party, expiry, authorized persistence/events, filtered foreign participant IDs and unrelated battle preservation. Real host adapter is injected into campaign orchestration to verify host start and member-only denial before NPC/roll work for a new battle. Stored proof survives reload/errors; request defaults/JSON/results remain compatible.
- **Additional checks/limits:** frozen install, workspace typechecks and 24 combat safety tests pass. Twenty-two existing campaign runtime/integration/one-off bridge tests pass through byte-identical temporary .cts copies, cleaned afterward, for the existing CommonJS/module-format limitation. Strict unique-key YAML, three bearer contracts, exact 33-route map/13 open mutation rows, local links and diff checks pass. DB/storage mocked; no new HTTP/browser/mobile/real DB or concurrency acceptance. Four legacy combat HTTP smoke files still send pre-capability setup/authorization and need a bounded fixture migration; do not label them a passing release gate.
- **Rollout/rollback:** no new migration; existing host column and matching API/client required. Operator verified the configured DB column in the preceding rollout, not all environments. Old clients and legacy unclaimed parties fail closed. Missing local proof stops the request; network/server errors retain credentials for explicit retry. Roll back matching client/API together if necessary, leaving columns intact; server rollback reopens these controls. No deployment or connected DB write performed.
- **Remaining/next:** O02 partial: 15 proof-gated handlers, 3 bootstrap, 2 open reads and 13 open mutations. Authorize-to-commit races, delegation/recovery, read privacy, turn/economy/remote outcome gates, NPC and roll-prompt/loot/event authoring remain. A reused campaign battle can still reach ungated NPC/roll routes without initiative-start gating; this is not full AI orchestration security. NPC creation also serves player companions, so no blind host-only extension. Next inspect roll-prompt authoring and NPC-instance caller ownership for the next bounded original-audit pass. O05, REC-01 and full history/combat/AI DM completion unchanged.


## Pass record: 2026-10-22 AI usage / MiniLM audit (PR #23)

- **Scope decision:** user asked whether MiniLM can reduce semantic/deterministic work sent to APIs and requested an audit before replacement. This pass documents AIU01–AIU08; it does not silently activate a new model integration or replace the queued original permission work. O02 remains partial (13 open mutations), O05 open, QA-N01 retest pending and QA-N02 unresolved.
- **Evidence:** inspected all eleven AI model-call routes plus Adventure runtime helper/route, production client URL references, local progression/item properties/combat/identity matching, context assembly, keyed replay and active live-response retry. Twelve handlers have model-call paths; nine AI endpoints plus Adventure have first-party callers found, while recommend-feat/generate-class-features have none found. useWhatsThis has no production consumer or mounted endpoint found. Party/persistence/Open5e APIs are distinguished from paid generation. No deployed environment or traffic frequency is inferred from source defaults.
- **Conclusion:** MiniLM sentence embeddings can rank rules/entities/context, not generate change JSON, inspect images, narrate campaigns or decide damage/reflection/identity. First measure provider usage/attempts and evaluate exact full-input bookkeeping grammar. Preserve existing deterministic bypasses and review/authority; consider optional retrieval only after lexical/quality/device gates. No savings percentage/dollars or latency claimed. Backend embedding still uses the app API; browser/native/offline deployment is a separate measured choice.
- **Files:** new `docs/audits/ai-api-usage-minilm-audit.md`; `docs/app-map.md`; `docs/feature-status.md`; `docs/migrations.md`; this log. No runtime, schema, dependency, model asset, credential or lockfile change. Primary model/runtime references linked in the audit, checked 2026-10-22.
- **Validation/limits:** static inventory verifies eleven AI model calls plus one Adventure helper call, all eleven AI route rows, eight AIU IDs, local links and diff whitespace. Workspace typechecks and 24 combat safety tests pass after frozen install. No paid AI calls, embedding downloads/inference, provider billing/traffic inspection, device benchmarks or connected DB writes. Historical broad suites are not rerun for a documentation-only pass; no new runtime tests written.
- **Rollout/rollback:** documentation only, no migration or deployment; revert docs if needed without runtime effect. Implementation suggestions require a separate bounded pass and benchmark/acceptance decision. Exact parsing must abstain on unrecognized/mixed input without partial effects; embeddings must not auto-apply changes or merge identities, bypass permissions or omit required live state. No original/later audit finding is marked runtime-fixed by this pass.


## Pass record: 2026-10-22 O02-A6 (PR #24)

- **Scope decision:** user explicitly deferred lightweight reasoning-model exploration and returned to original remediation. Gate one clear host-authoring boundary, POST roll-requests, and record the next NPC caller map. AIU recommendations remain documented/unimplemented; no MiniLM, reasoning model, API telemetry or parser fast path added. O02 partial; related U09 does not imply shared rollback. QA-N01 live retest and QA-N02 status defect remain pending/open.
- **Before → after:** party-code callers could issue prompts to live targets without credentials. Existing authorizePartyHost now checks proof for the exact party before activity refresh, expiration cleanup, member reads or runtime work. Its optional action label is selected by server code, never caller metadata. Missing/member/other-party/legacy/malformed/hash-as-token/body/AI-label proof fails closed with 403 party_host_required and zero writes; unknown party returns 404. Authorized input keeps existing target filtering, label/battle-label normalization, initiative unresolved-overlap replacement and replied/other-target prompt preservation, event and persistence behavior.
- **Caller audit/client:** DM Party uses creation after initiative, participant addition and manual prompting. Adventure adjudication plus campaignEncounterRuntime use the shared export and existing failed-prompt handling, including reused battles that bypass initiative start. Existing signature/typed response now delegates through partyHostApi with exact-party persisted bearer/JSON proof; missing local proof stops requests and errors retain credentials. DM manual prompting now catches/displays failures. NPC dummy-state/gear/visibility/deletion currently have DM Party callers, NPC initiative also has Adventure AI callers, and creation additionally serves player sheet companion projection, demo and DM Monsters. Owner projection metadata is not proof; no NPC route is blindly host-gated in this pass.
- **Touched files:** `artifacts/api-server/src/routes/party.ts`; new `artifacts/api-server/src/routes/party.roll-prompt-safety.test.ts`; `artifacts/api-server/package.json`; `artifacts/living-character-sheet/utils/partyHostApi.ts`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/app/dm-party.tsx`; new `artifacts/living-character-sheet/tests/state/party-roll-prompt-api.test.cts`; `artifacts/living-character-sheet/package.json`; `lib/api-spec/openapi.yaml`; `docs/party-permission-map.md`; `docs/party-host-permissions.md`; `docs/app-map.md`; `docs/feature-status.md`; `docs/migrations.md`; this log. Server proof plus matching client transport are jointly necessary at the same authority boundary. No schema, lockfile or generated binding change.
- **Validation:** 15 new direct route tests and nine adapter/orchestration tests; 278 focused server/client tests pass including existing encounter/notes/member/host/remote apply/AI idempotency regressions. All eight denied-author cases fail on previous server source; seven existing-behavior cases pass there. Tests assert exact-party SQL, zero denied side effects, legacy/member/role rejection, unknown/expired session, normalized live targets, optional battle labels, initiative replacement/replied retention, persisted payload/event, compatible results and credential retention. Campaign tests inject both real host methods for new and reused battle flows; member-only reused battle records failedRolls without issuing a prompt. No full NPC/roll workflow transaction claimed.
- **Checks/limits:** frozen install, workspace typechecks and 24 combat tests pass. Strict unique-key YAML/bearer/400/403/404 contract, exact 33-route map with 12 open mutations, local documentation links, finding IDs and whitespace verified. DB/storage mocked; HTTP/device/real DB/concurrency and legacy HTTP fixture migration remain open. Existing prompt stat-key and battle-target validation are not expanded; caller proof is not full prompt correctness.
- **Rollout/rollback:** existing host column and matching client/API required; no new migration. Operator previously verified the configured DB column, not all environments. Old clients, legacy unclaimed parties and joined/watching devices without host capability fail closed. Run DM and AI DM prompts on the creator device. Revert matching API/client together if necessary, leaving columns intact; server rollback reopens spoofing. No deployment or connected DB write performed.
- **Remaining/next:** sixteen proof-gated handlers, 3 bootstrap, 2 open reads and 12 open mutations. NPC creation and instance controls, turn/economy/remote outcome, loot/event authoring, read privacy, delegation/recovery and authorization-to-commit races remain open. On reused campaign battles, a missing NPC can still be created before a later prompt denial. Scope NPC instance controls next, keeping player companion creation/ownership distinct. O05, REC-01, full history/combat/AI DM completion and pending notes/status QA are unchanged.

## Pass record: 2026-10-23 O02-A7 (PR #25)

- **Scope:** user requested the twelve remaining mutations followed by NPC instance controls, with player companion ownership separate. Six of the twelve are NPC routes. This pass covers the six non-NPC routes under original O02/related U09. Server authorization plus matching client transport/contracts are one boundary; no engine, inventory or history redesign.
- **Before → after:** end-turn, economy spend/reset, remote outcomes, events and loot authoring now verify persisted live caller proof before activity/expiry/runtime access. Members end only their own current turn in their own requested/default battle; fixes the old global compatibility-turn check. Host override needs actual host proof, never a body flag. Economy/source actions require exact member proof and reject host substitution. Out-of-turn reactions and existing own manual reset semantics retained; no fairness claim.
- **Events/loot:** generic endpoint accepts the seven observed action report kinds and derives attribution/reportedBy; cannot forge authoritative server event kinds even with host proof. Reports remain client statements. Host loot origin stamped dm, member transfers require exact sender proof and preserve full snapshots. Server has no inventory ledger: proof does not establish ownership/debit or delivery atomicity. CombatContext catches report transport rejection; existing gameplay state paths unchanged.
- **Touched files:** `artifacts/api-server/src/routes/party.ts`; `artifacts/api-server/src/routes/party.remaining-mutation-safety.test.ts`; `artifacts/api-server/package.json`; `artifacts/living-character-sheet/context/CombatContext.tsx`; `artifacts/living-character-sheet/package.json`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/utils/partyHostApi.ts`; `artifacts/living-character-sheet/utils/partyMemberApi.ts`; `artifacts/living-character-sheet/tests/state/party-mutation-api.test.cts`; `lib/api-spec/openapi.yaml`; `docs/party-permission-map.md`; `docs/feature-status.md`; `docs/migrations.md`; `docs/implementation-log.md`. No schema column, lockfile, generated binding or screen layout change.
- **Validation:** 85 new direct-route and 33 new client adapter tests; 396 focused tests pass including remote apply and AI idempotency suites. Workspace typechecks and 24 combat safety tests pass. Sixty-two new route tests fail on the previous source. Frozen install, exact 33-route map/six remaining open mutation rows, six strict unique-key OpenAPI bearer/400/403/404 contracts and whitespace checks pass. DB/storage mocked; PostgreSQL, HTTP/browser/mobile, crash and concurrent-removal acceptance remain pending.
- **Rollout/rollback:** existing capability columns plus matching API/client, no new migration. Old clients fail closed; legacy members rejoin. Revert matching API/client together; server rollback reopens these spoofing paths. No deployment or connected DB write.
- **Remaining/next:** O02 partial: 22 proof-gated handlers, three bootstrap, two open reads, six open NPC mutations. Five instance controls next, NPC creation and player companion ownership separately. Read privacy, proof-to-commit races, server command/dice truth, reset eligibility, inventory debit and durable delivery remain open. O05, REC-01, deferred models and live notes QA unchanged.

## Pass record: 2026-10-23 O02-A8 (PR #26)

- **Scope:** second bounded pass in the user's authorized sequence, after O02-A7. Original O02/related U09; original-host authorization of five direct NPC instance controls only. Player companion creation/ownership remains explicitly separate. Server gate, matching transport/contracts and caller error handling are necessary parts of this boundary.
- **Before → after:** health/action state, gear, visible-stat settings, deletion and initiative require original-host proof before session refresh/expiry cleanup or instance/runtime reads/writes. IDs/role flags/AI labels/companion owner metadata do not grant control. Existing party-local instance lookup, normalizers, initiative behavior and deletion cleanup retained. Host can manually manage existing companion projections under the same NPC policy; no player companion-owner rights introduced.
- **Client/callers:** shared exports delegate to persisted host adapter. DM UI callers preserve signatures; previously silent state/gear failures now use the existing error display. AI encounter initiative uses creator-device proof and emits failure text while keeping the active encounter. No delegation, automatic retry or workflow transaction added.
- **Touched files:** `artifacts/api-server/src/routes/party.ts`; `artifacts/api-server/src/routes/party.npc-instance-safety.test.ts`; `artifacts/api-server/package.json`; `artifacts/living-character-sheet/app/dm-party.tsx`; `artifacts/living-character-sheet/app/adventure/session/[sessionId].tsx`; `artifacts/living-character-sheet/package.json`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/utils/partyHostApi.ts`; `artifacts/living-character-sheet/tests/state/party-npc-instance-api.test.cts`; `lib/api-spec/openapi.yaml`; `docs/party-permission-map.md`; `docs/feature-status.md`; `docs/migrations.md`; `docs/implementation-log.md`. No creation route, player companion payload/caller, schema column, lockfile or generated binding changes.
- **Validation:** 65 new direct route and 21 new client adapter tests. 482 focused tests pass including earlier authorization, remote apply and AI idempotency safety; workspace typechecks and 24 combat safety tests pass. All 40 denied-caller route tests fail on previous source. Tests cover zero pre-auth side effects, wrong/member/body/hash/legacy proof, unknown/expired party, foreign instances, host companion management, normalization, cleanup and credential retention. Frozen install, exact 33-route map/one open mutation row, five strict unique-key bearer contracts, local operational doc links and whitespace checks pass. DB/storage mocked; UI visual, PostgreSQL/HTTP/browser/mobile/restart and concurrency acceptance remain pending.
- **Rollout/rollback:** existing host column plus matching API/client; no new migration, deployment or connected DB write. Legacy parties/old clients fail closed for these controls. Roll back API/client together, retaining columns; API rollback reopens unauthorized instance editing.
- **Remaining/next:** 27 proof-gated handlers, three bootstrap, two open reads and one open creation mutation. Eleven of the previously twelve open mutations now have proof; this is not complete O02 or NPC authorization. Creation remains open and can still add battle participants/change order. Separate companion work must prove owner/source, constrain projection fields and define rejoin/replacement/removal lifecycle. Read privacy (visibility settings do not filter public payloads), proof-to-commit races, command/dice truth, inventory debit and durable delivery remain open. O05, deferred models, REC-01 and notes/status live QA unchanged.

## Pass record: 2026-10-22 O02-A9 (PR #27)

- **Scope:** user continued after NPC instance gates. Original O02/related U09; close the remaining creation caller-proof gap while separating companion submitter authentication from unavailable canonical ownership evidence. Server route, matching client transport and contracts are the same authorization boundary. Date uses America/Chicago.
- **Before → after:** ordinary NPC creation requires original-host proof before activity/expiry/runtime work. Companion admission requires exact live party/member proof selected by ownerMemberId; host proof cannot impersonate a companion owner. Missing/body/wrong-member/party/role/hash/legacy proof fails closed. Companion/member IDs required; projection must be friendly character source with matching sourceId/companionId, without gear, conditions or explicit initiative override. Battle derived from submitting member; foreign explicit battle rejected. An unassigned member's companion stays unassigned rather than using the first other battle. Existing host source/gear/stat normalization remains.
- **Client/callers:** addCombatNpc now uses host adapter for DM/demo/AI callers. New explicit projectPartyCompanion member adapter is used by the player sheet with the existing companion builder. Shared CreateCombatNpcPayload preserves existing shapes/results; errors expose the actual permission/transport message. No implicit host fallback or new player rights over manual NPC instance controls.
- **Touched files:** `artifacts/api-server/src/routes/party.ts`; `artifacts/api-server/src/routes/party.npc-creation-safety.test.ts`; `artifacts/api-server/package.json`; `artifacts/living-character-sheet/app/(tabs)/sheet.tsx`; `artifacts/living-character-sheet/package.json`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/utils/partyHostApi.ts`; `artifacts/living-character-sheet/utils/partyMemberApi.ts`; `artifacts/living-character-sheet/tests/state/party-npc-creation-api.test.cts`; `lib/api-spec/openapi.yaml`; `docs/party-permission-map.md`; `docs/companion-projection-permissions.md`; `docs/feature-status.md`; `docs/migrations.md`; `docs/implementation-log.md`. No capability column, lockfile, generated binding, canonical companion roster or new gameplay engine change.
- **Validation:** 43 new direct-route tests and ten client tests; 535 focused tests pass, including existing authorization, remote apply and AI idempotency suites. Workspace typechecks and 24 combat safety tests pass. Thirty-four new route tests fail against previous source. Tests cover zero denied side effects, exact SQL party/member scope, wrong role/owner/member, unsupported fields, foreign/missing own battle, expired/missing parties, host source compatibility, real companion builder transport and credential retention/revocation. Frozen install, all 33 route rows/no remaining open non-bootstrap mutation declarations, strict unique-key OpenAPI bearer/400/403/404/409 contract, operational doc links and whitespace checked. DB/storage mocked; no PostgreSQL, HTTP, UI visual/browser/mobile, restart or concurrency acceptance.
- **Rollout/rollback:** existing host/member columns plus matching client/API required. Old clients fail closed on creation; no new migration, deployment or connected DB write. Revert the API/client pair together if needed; server rollback reopens unauthenticated creation. Leave columns intact.
- **Limits/next:** 28 proof-gated handlers, three public bootstrap handlers and two open reads. All twelve previously open non-bootstrap mutations now have proof, but O02 remains partial. Server lacks a canonical character/companion roster: authenticated submission does not verify ownership, ownerCharacterId, stats or approved mechanics. Duplicate prevention/receipts, legacy metadata reconciliation, leave/rejoin/orphan cleanup and permission transfer remain deferred under the separate companion boundary document. No duplicate-prevention or ownership completion credit. Public read privacy/activity/expiry side effects, invitation abuse, proof-to-commit races, gameplay truth and durable item delivery remain open. O05/model work, REC-01 and notes QA unchanged.

## Pass record: 2026-10-22 O02-A10 (PR #28)

- **Scope/policy:** user continued companion ownership work and selected Player-managed admission when asked whether entry needs DM approval. Preserve immediate admission with DM oversight, without a new queue. Original O02/related U09; this pass implements live identity/duplicate containment, with ownership/source validation and lifecycle explicitly separate. Policy is recorded in companion-projection-permissions.md. Date uses America/Chicago.
- **Before → after:** repeating Add created fresh NPCs, potentially refreshing combat resources. Server stamps companion-admission.v1 provenance for the authenticated member/companion pair within the party. A repeat reads committed runtime and returns the existing bound live instance with reused=true, no runtime write or second creation event. Input name/stats/HP cannot overwrite current damage, spent actions, conditions, DM gear/edits, initiative or placement. Existing proof/field/battle checks remain. Different members/local IDs stay separate. Requests and ordinary host creation cannot write trusted provenance; legacy metadata is not adopted or merged.
- **Persistence/concurrency:** companion admission now hydrates a fresh committed snapshot rather than acknowledging an in-flight cached mutation. New instances acknowledge only after existing revision-guarded save succeeds; conflicts fail closed. A failed save cannot cause the next retry to acknowledge an unsaved cached instance. Focused tests hold a write, let a competing request commit, and require the loser to conflict and retry to the committed winner. This is not full serialization or proof-to-commit atomicity. Initial runtime insert/store behavior remains unchanged; no transparent first-row race recovery.
- **Client:** typed reused result and additive response metadata; sheet distinguishes an already-present companion and keeps current combat state. No new player instance-control rights, automatic retry or approval UI. Existing host controls remain authoritative for manual live edits.
- **Touched files:** `artifacts/api-server/src/routes/party.ts`; `artifacts/api-server/src/lib/partyRuntimeSchema.ts`; `artifacts/api-server/src/routes/party.companion-identity-safety.test.ts`; `artifacts/api-server/package.json`; `artifacts/living-character-sheet/app/(tabs)/sheet.tsx`; `artifacts/living-character-sheet/utils/partyApi.ts`; `artifacts/living-character-sheet/utils/partyMemberApi.ts`; `artifacts/living-character-sheet/tests/state/party-npc-creation-api.test.cts`; `lib/api-spec/openapi.yaml`; `docs/companion-projection-permissions.md`; `docs/party-permission-map.md`; `docs/feature-status.md`; `docs/migrations.md`; `docs/implementation-log.md`. Optional companionAdmission metadata is additive in existing runtime JSON/schema v1; no new capability column, SQL migration, lockfile or generated bindings.
- **Validation:** 12 new direct-route tests and two new client result tests. 549 focused tests pass including previous proof, remote apply and AI idempotency safety. Workspace typechecks and 24 combat safety tests pass. Ten of 12 new route tests fail on the previous source. Tests cover repeated/lost acknowledgement, hydration without warm cache, external committed DM edits, malformed/legacy provenance, forged body binding, distinct member/companion identity, fresh proof/battle checks, failed save and concurrent CAS. Frozen install, exact 33-route map, strict unique-key OpenAPI and local operational links/whitespace checked. DB/storage and concurrency are mocked; no live PostgreSQL, HTTP, UI visual/browser/mobile/restart or process-crash acceptance.
- **Rollout/rollback:** matching API/client and existing capability columns; no deployment or connected DB write. Optional metadata remains backward readable. Rollback the pair together if needed; A10 rollback restores duplicate/reset exposure while A9 proof gates remain. No automatic legacy projection claim or cleanup.
- **Remaining/next:** bounded duplicate prevention applies only while the stamped live instance remains. Host deletion permits a later Add; no permanent tombstone/receipt or suppression of retry-after-removal. Legacy projections can coexist beside a newly bound instance and require DM review. Owner leave/rejoin detach/retention and explicit recovery are next; no automatic transfer based on character labels. Source-roster ownership, rule/stat validation, future owner combat commands, public reads, bootstrap abuse and proof-to-commit races remain open. Counts unchanged: 28 proof-gated handlers, three bootstrap and two open reads. O02 partial; O05, REC-01, deferred model work and live notes QA unchanged.

## DEP01: protected cloud browser preview preparation

Date / PR: 2026-10-23, [PR #29](https://github.com/dstancomb3/DND-Companion/pull/29).

Scope decision: user requested cloud testing on PC and phone, then confirmed
preparation. This is a separate deployment-readiness pass, related to O05
perimeter containment. Companion lifecycle follow-up after O02-A10 is paused for
this request, not completed or removed from the map. REC-01 remains unverified;
O02 remains partial and O05 remains open.

Before → after: browser tests required local serving and included a hardcoded
localhost item-properties URL. An opt-in preview now serves the Expo SPA and API
from one HTTPS origin. Render follows main with automatic deployment on commits;
after initial setup, merges trigger cloud builds/restarts and testers refresh the
same URL. Local/native Expo remains separate.

Authority: preview startup requires strong secrets, HTTPS origin and a built web
export. Initial Basic login issues a signed eight-hour HttpOnly/Secure/SameSite
cookie, independent of existing party Bearer proof. All app/assets/API paths are
protected except minimal process liveness. Cross-origin API requests are denied.
The preview start wrapper forces protection; build forces same-origin public
configuration and disables dotenv loading. This is shared staging access, not
per-user accounts, AI quotas or closure of O05.

Affected files:
- README.md
- artifacts/api-server/package.json
- artifacts/api-server/src/app.ts
- artifacts/api-server/src/lib/cloudPreview.test.ts
- artifacts/api-server/src/lib/cloudPreview.ts
- artifacts/living-character-sheet/app.json
- artifacts/living-character-sheet/app/dm-item.tsx
- artifacts/living-character-sheet/package.json
- artifacts/living-character-sheet/tests/state/api-url-preview.test.cts
- artifacts/living-character-sheet/utils/apiUrl.ts
- docs/app-map.md
- docs/cloud-phone-preview.md
- docs/feature-status.md
- docs/migrations.md
- package.json
- render.yaml
- scripts/build-cloud-preview.cjs
- scripts/start-cloud-preview.cjs
- scripts/test-cloud-preview.cjs
- docs/implementation-log.md

Validation: all workspace typechecks and 24 combat safety tests passed; 558 focused
tests passed, including nine new preview/client URL tests. Actual Expo web export,
bundled API build and compiled HTTP smoke passed. Smoke covers login, assets,
deep links, API protection and cookie/Bearer compatibility without successful DB
or AI calls. YAML/local documentation checks passed; provider-side acceptance is
pending. Agent used Linux Node 24.19.0/pnpm 11.25.0; recipe pins Node
20.20.2/pnpm 10.33.0. Chromium download failed with a truncated archive, so no
browser visual or phone acceptance is claimed.

Schema / rollout / rollback: no schema or lockfile changes, no cloud resource
creation, connected database writes or AI model calls. Operator must connect the
Render Blueprint, supply a separate provisioned test DB and preview password,
then test HTTPS/browser login, phone layout, multi-device party permissions and
DB/AI connectivity. Existing five tables and host/member capability columns are
prerequisites; deployment does not run schema push. Disable the hosted service to
stop previewing; reverting code alone does not remove cloud resources. Preserve
the perimeter when rolling back to avoid exposing an older API.

Next handoff: one-time Render connection and real PC/phone acceptance. Automatic
cloud deployment thereafter removes manual local builds for browser tests, but
still requires waiting for a successful deployment. QA-N01 live notes retest and
QA-N02 quest completion investigation remain pending. Resume companion ownership
lifecycle work separately from NPC instance controls after this user-requested
preview setup.

## DEP02: direct Node preview startup

Date / PR: 2026-10-23, [PR #30](https://github.com/dstancomb3/DND-Companion/pull/30).

Scope: follow-up to user-reported Render deployment failure. User logs establish
successful browser export, API bundle and build upload, followed by deployment
exceeding 512 MiB. Earlier runtime logs showed Corepack fetching pnpm 12.15.0
and dependency downloads near port scans. Exact memory attribution remains
unverified; do not conclude the API needs a paid instance.

Before → after: Render invoked pnpm run start:preview without a root
packageManager declaration. It now invokes the same protected wrapper directly
with Node, bypassing runtime package-manager bootstrap. Root packageManager pins
pnpm 10.33.0 for build tooling. No runtime install/build is added.

Files: package.json, render.yaml, docs/cloud-phone-preview.md,
docs/feature-status.md, docs/migrations.md, docs/implementation-log.md.

Validation: all workspace typechecks and 24 combat baseline tests passed;
nine focused preview/client URL tests and compiled HTTP startup smoke passed.
YAML start-command and package-manager pin checks passed. No application code
changed, so the prior compiled artifact was reused for startup smoke. Hosted
memory acceptance remains pending; this pass has no memory benchmark proving
512 MiB suitability and makes no claim the original deployment succeeded.

Rollout: sync the Blueprint and verify the service Start Command is
node --enable-source-maps scripts/start-cloud-preview.cjs before testing the
next deployment. Preserve existing preview secrets and DB URL. Capture runtime
logs/metrics if OOM persists. No paid plan change, DB/schema write, model call
or password/party authority change. Revert only with preview protection retained.

Status: DEP01 hosting acceptance remains pending, O05 open, O02 partial,
REC-01 unverified. Companion lifecycle and existing QA follow-ups remain queued.

## Development resumption after cloud setup pause

2026-10-23: user explicitly paused cloud setup due to setup burden and requested
return to the previous development track. No further cloud account setup,
database provisioning or paid hosting change is part of the active task. Existing
Render service is not asserted shut down; no external resource was changed here.

User evidence updates DEP01/DEP02: service started and browser login succeeded
after the startup change. Desktop screenshots show missing icon glyphs; that
font-rendering defect remains open. Party creation reaches the API but fails
with PostgreSQL ECONNREFUSED. User identified localhost:5432/character_companion,
with a separate PORT=3000 line, as the supplied configuration. Cloud DB
connectivity and phone/multiplayer acceptance remain unverified. Do not call
cloud rollout complete or repeat database setup as the next development task.

Active boundary resumes original O02-A11, separate from DM NPC instance controls.
Audited DELETE /party/leave deletes membership before runtime persistence,
cleans only warm cached state, and does not detach admitted companions. The
existing runtime store has a global DB executor, so an atomic fix requires an
explicit transaction-scoped storage path, durable snapshot/revision checks and
cache publication only after commit. Partial delete-then-detach is not a safe
implementation. The companion permission document records exact scope and
failure/rejoin acceptance. This is preparation evidence, not an implemented
lifecycle fix.

Files: docs/companion-projection-permissions.md, docs/implementation-log.md.
Validation: inspected leave authorization/deletion, runtime hydration/save/CAS,
server admission identity and lifecycle policy; documentation whitespace checked.
No runtime code, schema, DB write or authority changed in this preparation;
no test rerun claimed. Next implementation is atomic member departure and
companion detach/retention. Explicit rebind/recovery remains separate.
O02 partial, O05 open, REC-01 unverified; notes QA and icon defect remain open.

## O02-A11: transactional member departure and retained companions (PR #32)

2026-10-23 / [PR #32](https://github.com/dstancomb3/DND-Companion/pull/32).
User resumed development after pausing cloud setup. This implements the boundary
audited in PR #31, original O02 / related U09; it does not add player rights over
DM NPC instances, rebind controls or a new approval policy.

Before → after: DELETE /party/leave deleted membership before saving runtime
cleanup and skipped cleanup on a cold cache. Bound companions stayed in combat.
The route now revalidates host/member capability under session/member row locks
inside one serializable transaction. Durable snapshot load, existing revision
guard/save and member deletion use the same transaction executor. Commit precedes
success acknowledgement and cache eviction; no staged state is published. A
missing runtime row is left missing. Save/delete/commit failures roll back both
records; revision and wrapped PostgreSQL serialization/deadlock errors fail as
conflicts, with no automatic retry.

Companion scope: only server-stamped companion-admission.v1 bindings to the
departing member receive optional detachedAt provenance. The retained NPC record
keeps HP, conditions, gear, dummy action/reaction/movement usage and original
binding. Encounter mapping, initiative and shared economy entries are removed.
The departing member's shared economy is also removed; normal rebuild prunes
member state and delivery/request targets. Rebuild/start/add exclude detached
NPCs so refresh and ordinary host encounter admission do not reactivate them.
Host data edits and deletion remain; unstamped legacy projections are untouched.
A newly enrolled identity cannot claim the retained instance through matching
names, owner labels or local companion ID. Explicit recovery/transfer remains
separate. Host replay after successful removal is a no-op; self replay is refused
because deleted membership revokes proof. No permanent replay receipt added.

Touched files:
- artifacts/api-server/package.json
- artifacts/api-server/src/lib/partyRuntimeSchema.ts
- artifacts/api-server/src/lib/partyRuntimeStore.ts
- artifacts/api-server/src/routes/party.ts
- artifacts/api-server/src/routes/party.departure-safety.test.ts
- artifacts/api-server/src/routes/party.member-safety.test.ts
- artifacts/living-character-sheet/utils/partyApi.ts
- docs/app-map.md
- docs/companion-projection-permissions.md
- docs/party-permission-map.md
- docs/feature-status.md
- docs/migrations.md
- docs/implementation-log.md
- lib/api-spec/openapi.yaml

Validation: 572 focused tests passed, including 14 new direct departure tests and
existing member/host/NPC/companion proof, remote apply, AI idempotency and client
adapter tests. All workspace typechecks and 24 combat safety tests passed.
Thirteen of 14 departure tests fail against the prior party route source.
Tests cover self/host cold departure, exact live data retention, stale warm cache,
write/delete/commit rollback, revoked/foreign proof, revision and wrapped
serialization conflict, host replay/self revocation, absent runtime, new-member
rejoin and refusal to re-add detached companions. Explicit executor assertions
keep transactional writes off the global DB mock. OpenAPI and whitespace checked.

Evidence limits: transaction tests use staged database doubles. No real
PostgreSQL locking/serialization, multi-process, browser/mobile, crash or lost
commit-ack integration test was run. Commit-ack uncertainty is bounded by
subsequent membership/provenance reads, not a new durable receipt. No connected
database write, schema migration or cloud account action occurred.

Rollout/rollback: additive detachedAt in existing server-owned admission metadata,
runtime schema remains v1. Optional client typing preserves old payloads.
No SQL migration, capability-column or lockfile change. Existing store callers
retain their global executor; only departure passes the transaction executor.
Use the matching API before relying on cleanup. Older code ignores detachedAt
and rollback restores partial-departure risk; review retained parties before
rolling back and preserve capability columns/protection.

Remaining: explicit host-authorized recovery/rebind with audit and live DB
acceptance are next. Canonical companion/source roster, wider admission
proof-to-commit races, legacy reconciliation, public read privacy, bootstrap abuse,
permanent receipts and gameplay truth remain open. Counts unchanged: 28
proof-gated mutations, three public bootstrap handlers, two open reads.
O02 partial / O05 open / REC-01 unverified. Full undo/combat/AI DM and live notes QA
retain prior status. Cloud setup stays paused; missing icon glyphs and hosted
DB connectivity are recorded open, not fixed by this pass.

## O02-A12: reviewed original-host companion recovery (PR #33)

2026-10-24 / [PR #33](https://github.com/dstancomb3/DND-Companion/pull/33).
Continuation of original O02 companion lifecycle, related U09. Separate from
DM NPC instance commands and canonical player companion ownership verification.

Before → after: O02-A11 retained departed companions but provided no recovery
flow. The retained DM card now offers enrolled recipient selection, a reason,
review and separate confirmation. Detached entries are omitted from encounter
selection and initiative controls until recovered. The new POST
/party/:code/combat-npcs/:npcId/recover-companion requires original-host Bearer,
targetMemberId, expectedRevision, expectedDetachedAt and a 3–240 character reason.
No member/watch capability can substitute for host proof.

The endpoint revalidates locked host proof and exact-party live target enrollment
inside one serializable transaction. It requires the reviewed durable revision
and exact detachment stamp, refuses unstamped/active/changed instances and
conflicts if the recipient already has the same companion ID bound to another
instance (active or detached). It preserves HP, gear, conditions and used dummy
actions/reaction/movement. It rebinds membership, updates projection ownerMemberId,
retains the companion ID/legacy character label and records recoveredFrom for
the latest prior member/detachment/time. Character labels are not credentials.
Encounter mapping, initiative and shared economy remain empty; encounter placement
is a separate host action after recovery.

Binding and companion_recovered history commit together with existing revision
guarding. Event metadata includes prior/target membership, companion/NPC identity,
reason, original-host actor and timestamps. Cache is invalidated only after commit.
Stale/replayed requests conflict, including a lost-ack retry; no automatic retry or
exactly-once receipt added. Event history remains bounded to 200 and recoveredFrom
retains only the latest transition, not a permanent ownership ledger.

Client: partyHostApi uses persisted original-host proof without member/watch
fallback. Confirmation is invalidated by new runtime revision or disappearing
recipient and supports cancellation. An in-flight ref blocks double-click sends;
form controls disable during the request. Failure keeps the draft, shows an error,
requires review again and attempts a state refresh. Existing API authorization
remains authoritative even when a watcher views DM controls. No optimistic binding
or new player instance-control rights.

Touched files:
- artifacts/api-server/src/lib/partyRuntimeSchema.ts
- artifacts/api-server/src/routes/party.ts
- artifacts/api-server/src/routes/party.departure-safety.test.ts
- artifacts/living-character-sheet/utils/partyApi.ts
- artifacts/living-character-sheet/utils/partyHostApi.ts
- artifacts/living-character-sheet/app/dm-party.tsx
- artifacts/living-character-sheet/components/CompanionRecoveryPanel.tsx
- artifacts/living-character-sheet/package.json
- artifacts/living-character-sheet/tests/state/party-npc-instance-api.test.cts
- artifacts/living-character-sheet/tests/state/companion-recovery-panel.test.cts
- docs/app-map.md
- docs/companion-projection-permissions.md
- docs/feature-status.md
- docs/migrations.md
- docs/party-permission-map.md
- docs/implementation-log.md
- lib/api-spec/openapi.yaml

Validation: 598 focused tests passed, including 19 new direct recovery tests,
two new host adapter tests and five UI interaction tests using mocked React Native
host primitives and the existing renderer dependency. All 19 new recovery tests
fail against the prior route source, while 14 existing departure tests still pass.
Cases include exact preservation/committed audit, invalid/member/forged/revoked host
proof, missing/legacy/foreign-party target, expired party, absent runtime, stale
revision/stamp, duplicate binding, legacy/non-detached source, write/commit failure,
revision/serialization conflict, lost acknowledgement and ignored combat overrides.
UI tests cover review/confirm, cancellation, changed revision, recipient loss,
error/draft retention, no retry, double-send exclusion and hidden active recovery.

All workspace typechecks and 24 combat safety tests passed. Actual browser export
and API build passed; compiled HTTP preview smoke passed after the final API build.
OpenAPI unique keys, exact 34 route declarations and whitespace checked. No
lockfile/dependency or generated-binding change. No successful connected DB/AI
calls or cloud setup. UI renderer emits its existing deprecation warning.

Evidence limits: transaction storage and UI native primitives are test doubles.
No real PostgreSQL locking, multi-process races, browser visual/mobile/accessibility
acceptance, crash or provider deployment acceptance claimed. Export/smoke is not
end-to-end multiplayer verification. The previously reported icon font issue stays
open; cloud setup remains paused.

Rollout/rollback: optional recoveredFrom is additive in existing runtime JSON v1;
no SQL migration. Matching API/client, existing capability columns and server-first
rollout required. Older lifecycle code ignores recovery provenance and does not
provide this guarded recovery contract; inspect retained/recovered parties before
reverting. Restore the pair together, preserve capabilities and preview perimeter.

Remaining/next: close the wider companion admission/departure proof-to-commit race
before claiming full lifecycle consistency, then verify real DB/multi-client behavior.
Canonical source-roster ownership, active-instance transfer, duplicate reconciliation,
permanent audit/receipts, public reads/bootstrap protection and gameplay truth remain
open. Current route counts: 34 declarations, 29 proof-gated mutations, three public
bootstrap handlers and two open reads. O02 partial, O05 open, REC-01 unverified.
Full undo/combat/AI DM, lightweight-model deferral and live notes QA unchanged.

## O02-A13: companion admission/departure race containment (PR #34)

2026-10-24 / [PR #34](https://github.com/dstancomb3/DND-Companion/pull/34).
Original O02 companion lifecycle, related U09. Server-only continuation after
reviewed recovery, without new player/host rights or a broader party cutover.

Before → after: companion admission/reuse authenticated membership before the
runtime operation, so removal between those steps could still create or return
an instance. The companion branch now runs session/member row locks in that order,
live member capability/party-expiry revalidation, activity refresh, fresh durable
snapshot reads, own-battle checks and revision-guarded runtime save on one
serializable transaction connection. It shares lock order with departure/recovery.
Reuse also waits for transaction commit, despite adding no runtime event or
snapshot revision. Successful commit invalidates cache; no transaction-local
state is published.

A removed/revoked member fails locked revalidation even after passing preflight.
If admission commits first, a later committed departure reads and detaches that
instance. PostgreSQL may instead abort an overlapping serializable transaction;
this is returned as conflict with no automatic retry. Session activity rolls back
with rejected/failed companion work. First runtime insert uses the same scoped
executor; first-row uniqueness, serialization and deadlock errors fail closed
rather than acknowledge an unsaved instance or transparently retry. Explicit
requests reauthenticate. Detached retained instances cannot be reused to bypass
host recovery. Existing source/battle/payload constraints are preserved.

Ordinary original-host NPC creation keeps its previous activity/cache/CAS path.
The route's shared construction logic is wrapped without moving authority to
clients or changing the request/result contract. Internal lifecycle error handling
is shared with recovery. Other party mutation proof-to-commit races, canonical
source ownership and gameplay truth remain separate work.

Touched files:
- artifacts/api-server/src/routes/party.ts
- artifacts/api-server/src/routes/party.companion-identity-safety.test.ts
- artifacts/api-server/src/routes/party.npc-creation-safety.test.ts
- artifacts/api-server/src/routes/party.departure-safety.test.ts
- docs/app-map.md
- docs/companion-projection-permissions.md
- docs/feature-status.md
- docs/migrations.md
- docs/party-permission-map.md
- docs/implementation-log.md
- lib/api-spec/openapi.yaml

Validation: 612 focused tests passed, including 14 new lifecycle regressions.
All workspace typechecks and 24 combat safety tests passed, followed by a final
API test-source typecheck. API bundle build and compiled HTTP preview smoke passed.
Existing identity/reuse and ordinary host NPC creation regressions still pass.
Updated success fixtures accept transaction execution; denied preflight tests
retain their no-write expectations.

New staged transaction tests cover removal after preflight for creation and reuse,
missing first runtime, revocation, both modeled serial admission/departure orders,
acknowledgement only after commit for creation and reuse, write/commit rollback,
revision/serialization conflict, first-row uniqueness and explicit retry, expired
reuse and retained-instance refusal. Test doubles assert session/member lock order
before scoped writes and forbid global insert/delete. Negative run selected 11
non-blocking regressions against the prior route: nine fail, two already pass.
Three acknowledgement/queue gate tests were not run on the old source because it
does not enter that transaction boundary. Existing bounded duplicate/CAS tests
are not a substitute for database isolation evidence. OpenAPI unique keys, exact
34-route inventory and whitespace checked.

Evidence limits: DB transactions and queued lock order are models of permitted
serial behavior, not real PostgreSQL scheduling/locking or multi-process proof.
An actual concurrent PostgreSQL run can return serialization conflict instead of
the modeled success order. No real DB, crash/lost-commit-ack, mobile/browser or
provider deployment acceptance claimed. Compiled smoke performs no successful DB
or AI call. Temporary negative-run files were removed; no dependency/lockfile,
schema version, capability, generated-binding or client change.

Rollout/rollback: compatible server behavior on existing runtime JSON v1 and
capability columns, no SQL migration or connected DB action. Rollback restores
the preflight-to-commit gap even if departure/recovery remain transactional.
Keep the newer server before relying on this lifecycle containment and preserve
existing admission/recovery metadata. No cloud setup resumed.

Remaining: real PostgreSQL and multi-client lifecycle acceptance, canonical
source-roster verification, other mutation races, permanent receipts/history,
public reads/bootstrap protection, legacy reconciliation and deterministic
combat truth remain open. Counts unchanged: 34 declarations, 29 proof-gated
mutations, three public bootstrap handlers, two open reads. O02 partial / O05
open / REC-01 unverified. Full undo/combat/AI DM, deferred model work, notes QA and
reported icon-font/hosted DB issues retain prior status. Cloud setup stays paused.

## T01-PG1: isolated PostgreSQL lifecycle CI and durable combat reads (PR #35)

2026-10-24 / [PR #35](https://github.com/dstancomb3/DND-Companion/pull/35).
User selected real DB integration and CI as the next plan step, with cloud setup
paused. Scope: T01 testing gap and O02 companion lifecycle acceptance; one bounded
read-freshness fix discovered by those tests. No new gameplay rights or features.

Infrastructure: an opt-in runner requires RUN_POSTGRES_INTEGRATION=1 and a separate
TEST_DATABASE_URL restricted to loopback database dnd_companion_ci with no URL
options. It never loads .env or falls back to application DATABASE_URL. It creates
one random schema, exports DDL from the current party Drizzle model, scopes
foreign keys/child connections to that schema and drops it afterward. No public
tables, user database, schema push or application migration is touched. Abrupt
machine/process kill can leave a random local test schema; CI service is ephemeral.

Workflow: PostgreSQL 16 service on ubuntu-24.04, pinned checkout/setup-node commits,
Node 20.20.2/pnpm 10.33.0 and frozen install. Contents-read-only token, no persisted
checkout credentials or production secrets. PR/main/manual triggers run baseline,
eight runner guards, scoped unit/client regressions and mandatory real PG tests.
Missing configuration fails rather than skips. This is CI configuration and
observed execution, not an automatically configured branch-protection rule.

Real suite: two independent HTTP API worker processes, real PostgreSQL row-lock
waits and durable SQL assertions. Eleven cases cover preservation/detach/recovery/
stale replay, runtime-write/delete/deferred-commit rollback, admission commit
rollback including activity, both queued admission/departure orders, simultaneous
first admission, competing recovery, recovery commit rollback and cross-process
read freshness. Serialization conflicts are valid rejected outcomes; tests make
explicit follow-up requests only after checking durable membership.

Discovered defect: a warmed combat-state GET could keep showing a companion as
active after another process committed detachment. New regression fails on prior
source. That GET now reads committed durable runtime and current member rows,
using a local projection instead of cached in-flight mutations. Existing activity/
expiry handling and open-read authorization remain; reads are not one snapshot-
isolated transaction, and other mutation caches remain separate.

Verified CI evidence:
- Initial run 40112146208 stopped during typecheck on optional IPC disconnect in
  the new worker; fixed without changing application authority or dependencies.
- [Run 40112334408](https://github.com/dstancomb3/DND-Companion/actions/runs/40112334408)
  succeeded on source commit dc27c694d267e85b4c9c4f98e2571ed6af04b030.
- Logs report PostgreSQL 16.15, 11 PG tests passed, zero failed/skipped, and removal
  of the uniquely created test schema.
- Same job passed all workspace/integration-source typechecks, 24 combat safety
  tests, 613 scoped regressions and eight runner guards under Node 20.20.2.
- Local baseline/regressions/guards passed; API bundle and compiled HTTP smoke
  passed. Local PG/server/container binaries were unavailable, so real DB evidence
  comes from CI, not local mock results. Workflow syntax/no-secret settings checked.

Touched files:
- .github/workflows/party-postgres.yml
- scripts/test-party-postgres.cjs
- scripts/test-party-postgres.test.cjs
- artifacts/api-server/tests/integration/party-lifecycle.postgres.test.ts
- artifacts/api-server/tests/integration/party-worker.ts
- artifacts/api-server/tsconfig.integration.json
- artifacts/api-server/package.json
- artifacts/api-server/src/routes/party.ts
- artifacts/api-server/src/routes/party.departure-safety.test.ts
- package.json
- README.md
- docs/party-postgres-tests.md
- docs/app-map.md
- docs/feature-status.md
- docs/migrations.md
- docs/party-permission-map.md
- docs/companion-projection-permissions.md
- docs/runtime-baseline.md
- docs/implementation-log.md

Log reconciliation: summary rows for PRs #29–#34 were backfilled from their
existing detailed pass records. This adds no completion credit beyond those
records and supersedes pending DB statements only for the 11 tested lifecycle
cases. Original finding IDs and historical claims remain intact.

Rollout/rollback: no production SQL/schema/capability/client/lockfile or generated
binding change. The read fix adds a durable query path to an existing GET; API
rollback restores stale cached reads. Reverting CI loses future coverage but does
not delete user data/resources. Test-only schema writes occurred solely in the
disposable CI PostgreSQL instance; no connected user DB, AI call, paid service or
cloud setup was performed.

Limits/next: actual PostgreSQL/two-process lifecycle cases now have evidence.
This is not all scheduling interleavings, DB versions/configurations, crash/
restart, checkpoint durability, all mutation races or a complete release gate.
Canonical source ownership, public read privacy/bootstrap limits and O05 remain
open. O02 partial / T01 partial / REC-01 unverified; full undo/combat/AI DM, deferred
models, notes QA and icon-font/hosted DB issues retain previous status. Return to
the remaining original safety backlog before expanding gameplay features.

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

## O02-A14: private party-state reads

2026-10-24 / branch `fix/party-read-privacy`.

Scope: remaining O02 code-only read exposure. GET `/party/:code/members` and
GET `/party/:code/combat-state` now require either original-host proof or a
live member bearer capability plus the member identity header. Denial occurs
before activity refresh, expiry cleanup, member projection or runtime hydration.
The three bootstrap handlers remain public by design.

Client reads now choose a stored host token or existing member token automatically,
preserving the current exported read-call signatures. `party_read_required`
maps to lost party access. No database/schema/capability-format/lockfile change.

Focused regressions cover denial without writes/runtime hydration and authenticated
member projection still excluding credential hashes. The prior PostgreSQL
combat-state freshness path remains intact. Field-level host/member redaction,
bootstrap abuse limits, canonical combat/inventory truth and proof-to-commit races
remain outside this bounded slice, so O02 remains partial.

Next planned safety work after this PR: O05 AI endpoint caller authorization,
usage/concurrency controls and bounded expensive input handling. Cloud setup stays
paused; AI DM roll-prompt reliability resumes after the safety backlog.

## O05-I1: bounded AI input admission (2026-10-24)

Scoped input-containment slice on `fix/o05-ai-input-limits`. Before the general 25 MB application JSON parser, /api/ai and the model-backed Adventure campaign-runtime turn now use a 4 MB streaming JSON parser limit. The AI loot-image endpoint changes from a 20 MB memory-buffer cap to 8 MB, and bounds multipart fields/parts/count. Express/body-parser and Multer oversize errors are translated to HTTP 413 with `ai_input_too_large`. Other import and party endpoints keep their existing request-size contract.

This is a conservative per-request memory/input ceiling, not caller authorization, global byte-budget enforcement, model token counting, per-IP/account quotas, distributed concurrency, image pixel/decompression validation, or full O05. Existing clients with inputs beyond these ceilings will receive explicit errors. No SQL/schema or client credential change. The next slices must design real caller/session authorization and distributed usage budgets before claiming publicly reachable AI safety. Cloud deployment remains paused.

## O05-I2: bounded in-flight AI admission (2026-10-24)

Scope: per-process concurrency containment only. A shared middleware guard admits up
to four simultaneous requests across the eleven /api/ai handlers and the model-backed
Adventure campaign-runtime turn. Surplus requests fail with HTTP 429,
`ai_capacity_exceeded` and Retry-After: 2. Response finish or disconnect releases
occupancy exactly once; synchronous handler setup errors also release it.
Focused tests cover saturation, release and invalid configuration. CI workflow
includes those regressions alongside the established party/PostgreSQL checks.

This is NOT caller authentication, per-user/IP quota, token/cost budgeting,
cluster-wide distributed concurrency, cross-process fairness or prevention of
slow-request resource exhaustion. Every server process has its own capacity.
No migration, client change or cloud deployment. O05 stays open and the remaining
authorization/usage protections must be addressed before public AI deployment.

## O05-I3: process-local AI attempt budget (2026-10-24)

Bounded shared admission cap of 60 request attempts per 60-second fixed window,
applied before concurrency middleware to /api/ai and the Adventure runtime turn.
Excess calls fail HTTP 429 with Retry-After and ai_attempt_budget_exceeded.
Deterministic tests cover acceptance, saturation, window reset, clock rollback
and invalid configuration. Added the focused test to the PostgreSQL CI workflow.

A process-local global cap is deliberately not an authenticated per-user quota,
distributed limit, expenditure/token budget, or denial-of-service guarantee.
Multiple API processes each retain independent windows. No caller identity,
cloud setup, schema, model or client contract is changed; O05 remains open.

## O05-I4: bounded upstream model transport (2026-10-25)

The standalone AI model route and Adventure campaign-runtime model route now use
one shared SDK configuration: 120-second upstream timeout and zero automatic
OpenAI SDK retries. This prevents hidden provider retry multiplication and
caps provider wait duration for calls routed through these two clients.
Focused policy regression is included in CI. A timeout may still incur provider
usage and does not cancel or undo an already accepted logical gameplay operation.
Existing HTTP response semantics remain unchanged.

No client, schema, deployment, authentication, cost ledger or distributed quota
change. O05 is still open; account/campaign-level caller identity, durable usage
limits, field-level authorization and budget accounting require separate work.
Cloud setup stays paused.

## AI DM R1: one-off roll response handoff (2026-10-25)

Focused gameplay slice: in the existing one-off session route, adjudication roll
creation now targets the locally registered member when the separate member list
has not hydrated yet. After successful server-side submission, the client reloads
authoritative combat state and confirms that the specific member response was
persisted and that no other targeted requests remain. Only then, and only outside
initiative/encounter gates, it sends a silent continuation turn containing the
confirmed dice result, so the AI DM can adjudicate and continue narration instead
of leaving the session stalled. Existing roll cards and local combat panels remain
unchanged. The session requires network connectivity for the handoff.

Limits: this is a bounded one-off adjudication-path repair, not a persisted
session roll state machine. It has not yet proven reload/reconnect idempotency,
multi-player orchestration, general saving throw timing or full deterministic
combat authority. Continue the roll handshake and its end-to-end acceptance
tests before marking AI DM runtime complete.

## AI DM R2: synchronous roll submission single-flight (2026-10-25)

The existing roll button now uses a synchronous per-roll in-flight gate in addition to render-state disabling. Repeated rapid taps for one request cannot submit a second response while the first submission/continuation is in progress. Missing party-member identity and all success/error exits release the gate, preserving explicit retries. Focused deterministic regressions are run in CI. This does not yet provide durable exactly-once roll operations across reloads, process failures or multiple devices. Continue roll handshake persistence and end-to-end acceptance before declaring fixed.

## AI DM R3: reject conflicting roll retries (2026-10-25)

For the existing party roll-response route, a member's first persisted roll is authoritative. A replay with the same sanitized roll/modifier/total now returns success without changing the response timestamp or appending another event. A conflicting repeat returns HTTP 409 with code `roll_response_already_recorded`, rather than silently rewriting a roll. Added deterministic replay-classifier regressions to CI. This is a single-route sequential replay guard; full transactional multi-worker arbitration, persistent end-to-end continuation receipts, and restored narrative handshakes remain outstanding. No schema or cloud changes.

## AI DM R4: no silent party replacement on existing one-off reload (2026-10-25)

An existing one-off with conversation history can no longer silently auto-create a fresh party when its prior party identity is missing during hydration. The session shows a visible reconnect warning instead, preserving the possibility of rejoining the original authority carrying unresolved rolls and combat state. Fresh new one-offs retain their initial party bootstrap path. Focused policy tests are included in CI.

This is a fail-closed recovery containment, not automated restoration of missing credentials, a fully persistent roll handshake, or an end-to-end multi-device test. Existing session history stays local; original party proof must still be recovered through the supported join process. No server migration or cloud changes.

## AI DM R5: block one-off story bypass while roll pending (2026-10-25)

The one-off session now rejects additional free-text and suggested-choice story turns while the current player has outstanding authoritative targeted roll prompts, preserving the DM roll card as the required next action. Campaign scaffold retains its own encounter gate logic. The denial displays a visible system explanation without dispatching another model turn. Deterministic decision tests are included in CI. Does not cover other clients, server-side request authority, or durable narrative replay receipts; full cross-reload roll orchestration remains incomplete.

## AI DM R6: local roll-to-narration continuation receipts (2026-10-25)

After the party server confirms a one-off adjudication roll and no other targeted checks remain, the client writes a session/member/request-scoped local receipt before invoking the AI DM. It records completed status following successful response processing. Existing or uncertain receipts prevent automatic duplicate narration after a rerender/reload; reopening a session with an uncertain receipt surfaces a review warning instead of automatically replaying the turn. Storage failures prevent the continuation dispatch. Regression tests cover scoped keys, first claim, uncertain/completed duplicate suppression and storage failure.

Scope limit: the receipt is local to this device, not a distributed transactional checkpoint. A crash after model completion but before local receipt completion can leave the outcome uncertain; the safe behavior is to avoid automatic replay, not claim exactly-once delivery. Server idempotent AI turn receipts, authoritative per-session roll continuation, multiplayer reconnection and full end-to-end session acceptance are still deferred. No server schema, deployment or cloud setup changes.

## Combat UI C6.1: in-session Story / Combat navigation (2026-10-25)

When an active one-off encounter snapshot is visible, Story and Combat / Targets controls scroll within the same adventure to the existing party target snapshot, attacks, consumables, actions, bonus actions and resources. The same shared combat cards and resolution logic are reused; no duplicate combat authority or navigation to the full sheet is required for supported actions.

This is navigation integration only, not full engine convergence, a verified mobile acceptance run, a new targeting authority, or expanded spell/reaction coverage. Gameplay testing remains needed.
