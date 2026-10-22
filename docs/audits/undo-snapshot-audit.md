# Undo and snapshot audit

Audited gameplay baseline: `d722086af72272a6f166d90f1b3a79bc09095a73` (main after
PR #8). Date: 2026-10-22. This is an implementation audit and backlog, not a
claim that general rollback exists. No gameplay, schema or connected database
was changed by this audit.

## Method and limits

Read the existing undo implementation, character snapshot/load/save code, public
mutation APIs, separate DM stores, combat state/persistence, campaign checkpoint
coordinator, assignment acceptance, rest handling and retry queue. Cross-check
those paths against an AST inventory of tracked, non-test, non-generated TS/TSX:

| Inventory | Count | Meaning |
| --- | ---: | --- |
| Context function properties | 140 | Character 106, Combat 23, Party 5, MutationHistory 4, AdventureSession 2; includes helpers/UI operations, not 140 distinct reversible commands |
| Storage write/remove call sites | 59 | AsyncStorage, injected storage, localStorage; includes credentials, preferences and caches that should not be rolled back |
| Server route declarations | 51 | All scanned server route files; includes reads and parsing endpoints |
| Party route declarations | 33 | Includes GET routes that also update activity or in-memory projections |

The [inventory JSON](undo-snapshot-inventory.json) lists source paths, symbols,
line anchors, signatures/paths and storage key expressions. It is a candidate
surface map, not proof every dynamic writer is intercepted. Generated code,
third-party/native code and JavaScript-only infrastructure are outside this
extractor. Grouped semantic findings below distinguish current code from required
architecture. Real browser/device storage, PostgreSQL and concurrent clients were
not exercised.

Three probes invoke the actual `MutationHistoryProvider.undoBatch` with mocked
React hooks, character mutations and storage. Results are in
[probe output](undo-current-behavior-probes.json). Assertions characterize current
unsafe behavior, not successful robust undo. After dependencies are installed,
run from the repository root:

```sh
node scripts/audits/inventory-undo-surface.cjs
node --import tsx scripts/audits/probe-current-undo.cjs
```

During this audit those commands used dependencies from an existing worktree via
NODE_PATH and the installed tsx loader, without changing dependency manifests.

## Findings, ordered by implementation risk

| ID | Priority | Verified current behavior and evidence | Required addition |
| --- | --- | --- | --- |
| U01 | P0 | `context/MutationHistoryContext.tsx::undoBatch` restores HP, currency and resource values only. It ignores `tempHp` and `conditionsBefore`; the probe produces no restore calls for either. Quick Update captures `conditionsBefore: []`. | Complete typed before/after state for each affected field, including condition identity, source, duration and concentration linkage; restore only a validated change set. |
| U02 | P0 | `app/(tabs)/quick-update.tsx::handleApply` captures HP, every coin and all resource counts even when only one field changes. `undoBatch` restores all captured fields against current values without checking intervening edits. Probe: an HP-only batch removes 20 GP and restores 3 resource uses from unrelated later state. | Record actual write sets and entity revisions; block stale/dependent undo. No whole-value reversal over later work. |
| U03 | P0 | Search for `appendBatch`/`buildMutationBatch` finds Quick Update as the only consuming writer. Its new-item branch returns to `/loot-review` before recording the batch, after potentially applying HP/currency/world consequences. | One logical change group across all writers and staged loot review, including partially applied/canceled steps. Audit manual and AI changes equally. |
| U04 | P0 | `CharacterContext` holds inventory, world, progression, conditions and resources locally; DM notes/NPC libraries are separate local stores. Party PostgreSQL rows contain only a member projection plus runtime JSON. | Define campaign/character/entity ownership and authority first. Full shared rollback needs authoritative world/inventory storage or an explicit local-only scope; a server snapshot cannot restore data the server never owned. |
| U05 | P0 | `routes/party.ts` remote outcomes update member rows before `persistRuntimeState`; sync/leave and runtime writes are also separate. Runtime CAS does not make those row writes atomic. | Commit affected live rows, command receipt, before/after records and history in the same transaction. Serialize the relevant aggregate and test partial failure. |
| U06 | P0 | `utils/characterStorage.ts::saveCharacter` replaces the saved entry for an ID; `deleteCharacter` filters it out. `party_runtime_snapshots` has one primary-key row per party; continuation snapshots have one per session. | Immutable version history and tombstones plus coherent full checkpoints. Existing latest-state saves are useful recovery inputs, not historical restore points. |
| U07 | P0 | `CharacterContext::loadCharacter` resets `spellEffectUses` and `itemActionUses` to empty. `CharacterSnapshot` does not declare those maps or CombatContext's concentration, pending reaction and local turn economy. | A versioned complete game-state codec, separate from portable character export; round-trip all mechanical state without silent defaults/reset. |
| U08 | P0 | `app/party.tsx` accepts a server note/loot assignment, then changes local journal/inventory. `PartyContext::syncApprovedRestRequests` applies local rest before server acknowledgement. | Durable operation IDs/receipts across recipient projections, explicit pending/committed application and recovery. Undo/restore must include awards, claims, recipient state and rest consequences as one dependency group. |
| U09 | P0 | Only disband/direct sync/leave currently have the new capability gates. Remaining combat/DM routes lack complete caller proof. World stores do not yet establish campaign-wide host authorization. | Current host/DM authorization for history access and restore, per-scope ownership and negative tests. Never use historical credentials, invite codes or client flags as permission. |
| U10 | P1 | History is limited to 20 local batches; `appendBatch` is after application and swallows persistence errors. A missing before snapshot is still marked undone. Undo mutates the batch flag rather than appending the reverse event, despite the type comment suggesting otherwise. | Durable append-only commands/reversal records, explicit missing-history failure, storage error reporting and a defined retention window. |
| U11 | P1 | Party `appendEvent` truncates at 200; rest requests at 100, loot/note assignments at 400. Remote dedupe consults bounded event history. Adventure archives keep 40 entries and replace the same session. | Separate immutable receipts/history from bounded display feeds. Never rewind dedupe receipts or resurrect retired command IDs when restoring snapshots. Preserve required bases when pruning. |
| U12 | P1 | `utils/aiQueue.ts` stores retryable work separately; `SyncContext` replays it. Roll requests, encounter gates, handled intent keys and actor registry persist separately from character data. | A new timeline/revision on restore; reject old queued commands, rolls, acknowledgements and stale sync. Retain recorded dice/model-independent outcomes without rerolling. |
| U13 | P1 | Saved NPC templates, custom monster templates and live combat NPC projections have different stores/IDs. Quest graph relationships, review queue and import normalization add further references. | Stable identity mapping, entity kind/scope, dependency graph and tombstones. Restore copies/instances without accidentally editing global templates or dangling links. |
| U14 | P1 | Restoring via ordinary `loadCharacter` invokes normalization, creates default planes and can add default spell slots; this is not an exact historical-state loader. | Explicit historical schema migration and invariant validation; a restore codec must not silently generate new game content or reset usage. |
| U15 | P1 | Inventory and location/person types store image URI references, not owned durable asset versions. | Retain/version referenced assets or disclose unrecoverable assets in the preview. Do not promise that a stale device URI restores a file. |
| U16 | P1 | Log and Quick Update offer local undo; spell undo is rejected during active combat in `utils/combat/resolveCombatAction.ts`. No shared DM history/restore route or general rollback UI was found in scanned routes/surfaces. | DM History, impact preview, Undo Last DM Change, named checkpoints and Restore Checkpoint with fresh authorization and explicit confirmation. |
| U17 | P0 | `characterStorage::getAllCharacters` and saved DM NPC reads catch failures and return empty arrays; `dmNotesStorage::getDmNotesPayload` returns an empty payload on failure. Subsequent read-modify-write operations cannot distinguish read failure from an empty store. | Distinguish absent, corrupt and temporarily unreadable state; block history capture and destructive replacement on failed reads. Verify durable save before declaring reversible success. |

Paths in this table under `context/`, `utils/`, `app/` and `types/` are relative to
`artifacts/living-character-sheet/`; `routes/` is relative to the API server.
Exact symbol locations are also present in the inventory.

## Domain coverage and capture boundaries

“Latest snapshot” below means overwrite-style persistence, not historical undo.
All gameplay rows require versioned capture; listing them does not imply they are
currently on one authoritative server.

| Domain / operations | Existing owner or writer | Present coverage | What must be captured together |
| --- | --- | --- | --- |
| Character identity, stats, levels, XP, death saves, statistics; create/import/delete | CharacterContext `updateCharacter`, HP/death-save/progression methods; create/edit/characters screens; characterStorage | Latest character save; partial Quick Update undo | Full character record, life/death state, derived/progression decisions, prior absent/deleted state and stable ID |
| HP/temp HP, damage/heal and conditions | CharacterContext `updateHp`, `updateTempHp`, `applyResolvedLocalDamage`, condition lifecycle methods; remote outcome route | Split local/member rows; incomplete undo | HP, temp HP, death saves, conditions with IDs/durations, concentration and statistics, complete trigger chain |
| Resources, spell slots, limited item/spell uses, rests | CharacterContext resource/slot/use/recharge methods; PartyContext rest apply; party rest routes | Some fields in character save; use maps reset on load; resource-count undo only | Counts AND maxima, definitions, recharge rules, usage maps, pending/approved rest and recipient acknowledgements |
| Inventory create/remove/edit/equip, split/merge, consumption | CharacterContext inventory methods, rule triggers; loot-review, quick-update, inventory/item-detail screens | Latest character inventory | Whole affected stacks and new IDs, quantities, equipment/attunement, charges, mechanics effects/provenance and resource side effects |
| Awards, transfers, claims, currency | DM loot assignment routes; party claim handler; currency methods | Server assignment and local recipient mutation separate | Sender/recipient objects, coin denominations, assignment/claim state, stable receipt, dependent consumption/equip |
| Attacks, spells, class/passive features and mechanics definitions | CharacterContext attack/spell/feature methods; SpellsSection custom spell storage | Latest character plus separate custom spell library | Definitions, prepared state, unlocks, mechanics version, active effects and use state; distinguish library from instance |
| Player quests, objectives and quest graph review | CharacterContext quest CRUD, `applyQuestUpdate`, deferred resolution/archive methods | Latest character quests and review queue | Objectives/status/rewards, aliases, references, review batches/receipts, dependent people/locations/items |
| Player people, relationships/deaths, locations, planes | CharacterContext world CRUD/pins; Quick Update inferred death consequences | Latest character world arrays | Linked records, deceased state/notes, location parents, links and inherited relationships; no regeneration of IDs |
| Notes, journal arcs, wishlist conversion, combat log/session log | CharacterContext note/journal/wishlist/log methods | Latest save; no general reversal | Original text/order, wishlist and created inventory item, log provenance. Gameplay corrections append history rather than erase evidence |
| DM quests, people, locations, campaign items, planes, notes | `utils/dmNotesStorage.ts` upsert/delete helpers; dm-notes and dm-item | One `dm_notes_payload_v1` blob | All affected arrays, location-parent cleanup, entity versions and player assignment links; separate scope from each character's copies |
| Saved DM NPC library and equipment | `app/dm-npc.tsx` save/upsert/delete; dmNpcStorage normalization | One `dm_saved_npcs` array | Template identity, equipment, secrets/relationships and tags. DM secrets require access control in history previews |
| Custom monsters and custom spells | monsterApi save/update/delete; SpellsSection | Separate latest library blobs | Original template versions and source references; restore live encounter instances independently |
| Combat NPCs/companions and encounter participation | party combat-npcs/encounters routes; CharacterContext companions; CombatContext actor selection | Party runtime plus local companions | Instance identity, owning character/template source, HP/conditions/gear, visibility, initiative and battle membership |
| Initiative, turns, economy, movement, reactions, concentration | Party runtime and CombatContext | Partial shared runtime; other local hook state | Orders/current actor/round, slots/usage, movement, reaction state, concentration timers and linked conditions; UI-only target selections may be cleared safely |
| Rolls, saves, approvals and overrides | party roll/rest routes; adventure encounter gates and local reaction window | Separate runtime/session state | IDs, status, target sets, responses, resolved dice, timing, cancellation/override provenance and timeline/revision |
| Adventure feed, pending choices, outcome and continuity | session screen, AdventureSessionContext, archive/journal storage, campaignContinuationStore | Latest local session/archive; server continuation is metadata/recap | Authoritative orchestration state and committed consequence IDs; preserve narrative evidence and correction notices; summaries alone are insufficient |
| Offline work, retries and replay | aiQueue, SyncContext, AI idempotency store, party event dedupe | Independent queues/receipts | Exclude receipts from game rewind, fence old requests by timeline/revision, durable retry policy and projection application IDs |
| Membership removal/disband and session expiry | party leave/disband/expiry branches | Destructive row/runtime cleanup with credentials | Define whether gameplay recovery creates a new session; retain audit tombstones. Never restore bearer tokens or deleted membership authority automatically |

## Explicit exclusions and boundaries

Do not rewind credentials, API keys, host/member token hashes, authentication,
feature flags, accessibility/theme preferences, watch history, dismissed coachmarks,
cache timestamps or official compendium caches. Those are present in the storage
inventory but are not game history. Keep idempotency/reversal receipts durable
outside the restored game projection. Library definitions may be scoped for their
own undo, but a campaign restore must not roll back unrelated campaigns or a global
library without a separate reviewed operation.

Temporary unsaved editor fields are not committed game changes; clarify whether
editor cancel/draft recovery is offered separately. External exports/messages and
information already revealed to players cannot be “unseen” by restoring state.
Database backups remain a separate requirement.

## Concrete implementation backlog and gates

| Slice | Exact additions | Gate before proceeding |
| --- | --- | --- |
| H0: Contain current unsafe undo | Guard against missing before state and stale/intervening writes; record only actual touched fields; complete temp HP/condition capture and inverse behavior. Clearly label unsupported domains; preserve original batch evidence. | Regression tests for U01/U02/U03/U10; HP-only undo cannot change later coins/resources; later edits cause review, not overwrite |
| H1: Scope and serialization | Typed game-state envelope per authority scope; stable entity IDs/kinds; complete character/combat/world codecs; typed missing/corrupt/read-failure results that block overwrite; exclusions for secrets/auth; explicit migration of legacy snapshots. Register all inventory candidates as tracked, derived, read-only, UI-only or excluded with reasons. | Round-trip equality for all supported mechanical fields, deleted/absent states and references; usage/concentration survive reload; no mutation path classified by guesswork |
| H2: Atomic history core | Proposed aggregate revisions, immutable command/change groups, entity before/after revisions and tombstones, permanent idempotency/reversal receipts. Refactor shared state ownership and commit adapters, not a parallel history service. | Real database rollback/crash/concurrent-writer tests prove live state, receipt and history commit together; local-only domains stay explicitly local until migrated |
| H3: Delivery and dependency tracking | Assignment/award/rest recipient receipts, source-to-copy identity links, quest graph dependencies, complete combat consequence groups and stored dice outcomes. | Simulated disconnect at every send/accept/apply/ack boundary; no duplicate item, reward or rest; Fireball reflection reverses as one group |
| H4: Coherent checkpoint store | Versioned complete snapshot manifest, schema/rules versions, content integrity, asset references, manual naming and protected pins; automatic full checkpoints built from an immutable committed revision. Durable pre-restore safety checkpoint. | Cross-store membership completeness checked; incomplete/corrupt/unsupported checkpoint refused; safety checkpoint can recover pre-restore game state |
| H5: Undo/restore commands | Current authorization, exact affected write set/dependencies, dry-run preview at expected revision, explicit confirmation, transaction, new increasing revision/timeline and linked reversal record. Do not delete original history. | Unauthorized/stale/dependent operations write nothing; duplicate restore returns one result; old rolls/queues/sync cannot mutate restored state |
| H6: UI and convergence | DM History list/detail; supported/unavailable reasons; Undo Last DM Change, Restore Checkpoint preview, affected players/entities, restore notice and reconnect refresh. Keep local undo distinct. | Two-client/browser/mobile tests, including absent/offline recipients, player changes since checkpoint, new/deleted linked entities and local-only exclusions |
| H7: Retention and operational recovery | Specify cadence, maximum snapshot size, quotas, history window, protected checkpoint policy, safe compaction, asset retention/export and metrics for failed capture/restore. | Measured storage/latency budget; pruning keeps a verified restore base; corrupt/missing asset and backup recovery rehearsed; history access never leaks DM secrets |

These slices describe required engineering work, not a commitment that each fits
one PR. Full shared restore is blocked by H1/H2 ownership and atomicity work.
Permission audit fixes remain prerequisites. H0 can be implemented conservatively
without waiting for the new combat engine; broad mechanics must use the history
core rather than add more untracked writers.

## Acceptance matrix required for a robust claim

- Round-trip every domain above, including noncombat edits, item split/merge,
  removed resources, quest graph deferred decisions, person death, NPC gear,
  custom templates versus instances, character import/delete and linked assets.
- Interleave an HP change with new currency/resource changes, then undo the first:
  later unrelated values survive; dependent changes produce an explicit conflict.
- Award then consume/transfer/equip an item; preview identifies downstream actions.
  Verify loot/notes/rest receipts remain consistent across server and recipients.
- Undo multi-target damage, immunity, reflected damage, condition expiration,
  concentration break, resource spend and death-save consequences as one group.
- Fail each history/checkpoint/commit stage, lose the response after commit, retry
  twice and restart workers. Verify no successful reversible mutation lacks history.
- Restore at a stale base while a second player acts; reject without mutation.
  Reject old pending rolls, local sync and queued commands after the timeline changes.
- Restore a deleted entity and its references without duplicate IDs; restore a
  safety checkpoint; retain original command history and exclude credentials.
- Verify history/reversal authorization, private DM data filtering, checkpoint
  pruning/integrity/schema migration and backup recovery with real storage.

## What remains unproven

The probes establish three local undo behaviors only. The inventory and code
inspection establish architectural gaps, not runtime failure rates. No existing
snapshot system was certified for full rollback. Manual UI, live PostgreSQL,
concurrency, storage corruption/quota and full save/restart checks remain pending.
No gameplay fixes are bundled into this audit.
