# DM history, snapshots and rollback

Status: approved product direction, planned implementation.
Implementation scope is grounded in the [undo/snapshot audit](audits/undo-snapshot-audit.md)
and its source inventory; H0-H7 are the concrete backlog. No new rollback
button, snapshot store or gameplay behavior ships with this specification.

## Goal and scope

Give the authorized DM a reliable history of game changes and two distinct
controls: **Undo Last DM Change** and **Restore Checkpoint**. History covers human
DM actions and supported AI DM commits. Restoring a checkpoint can affect player
changes too, so its preview must identify the entire affected scope.

| Domain | State that must be restorable |
| --- | --- |
| Combat | HP, temporary HP, conditions, durations, concentration, initiative, turn/round, action economy, reactions, pending rolls, resolved dice and all triggered consequences |
| NPCs and companions | Creation/deletion, encounter instances, statistics, equipment, disposition, location and relationships |
| Quests | Creation/deletion, descriptions, objectives, progress, rewards and links |
| People and world records | Creation/deletion, notes, locations, relationships and cross-record references |
| Items and resources | Creation/deletion, quantities, ownership, transfers, equipment/attunement, charges, currency and consumption |

Use stable entity IDs. Restoring an NPC instance must not silently rewrite its
shared monster template. Capture the owners and references involved in transfers
or deletions, not just the entity shown on the DM screen. Asset files need durable
references and retention if their restoration is promised.

## Durable history model

1. Every supported logical command has an actor, authorization scope, command ID,
   idempotency key, schema/rules versions, base revision and resulting revision.
   A change description and affected entity IDs make history understandable.
2. Preserve immutable before and after state for the affected entities, including
   explicit absent/deleted states and references. Store the committed typed events,
   complete trigger chain, resolved rolls and deterministic inputs alongside them.
   A Fireball and its reflection are one change group, not unrelated undo entries.
3. Keep periodic full checkpoints of the supported session/campaign aggregate,
   plus manual named checkpoints. Bind every checkpoint to one coherent revision;
   never assemble one from independently sampled live entities. Store enough state
   and dependency metadata to restore directly or replay from a verified base.
4. The state change, history record, affected-entity snapshots and idempotent result
   must commit atomically in the authoritative store. If history persistence fails,
   the command cannot report a successful reversible commit. Full-checkpoint
   generation may be asynchronous only from immutable committed revision data;
   incomplete checkpoints are never offered for restore.
5. History survives reload, process restart and multiple server workers. Use
   versioned schemas and integrity checks. Missing records, failed integrity or
   unsupported schema versions block restore with an explanation. A storage read
   failure cannot be treated as an empty game state for capture or replacement.

Reuse the planned event log, command coordinator and existing persistence adapters.
Do not create an independent history writer that can disagree with live state.
Current campaign-continuation summaries and runtime snapshots are recovery inputs,
not proof that complete world/inventory history already exists. Map every writer,
including manual edits and compatibility paths, before claiming domain coverage.
Unsupported changes must be clearly labeled as not undoable.

Snapshots contain game state, not bearer tokens, token hashes, API keys or login
secrets. Restoring history must never reinstate revoked credentials or resurrect
party authorization. Shared/local entities outside the chosen authority scope
require an explicit synchronization contract; broad local snapshot overwrite is
not a substitute for a server transaction.

## Undo and restore semantics

**Undo Last DM Change** previews reversing the newest eligible committed DM change.
For each affected entity, verify the recorded post-change revision still matches
and check dependencies. If later work touched it or depends on it, block automatic
undo and offer a reviewed correction or checkpoint-restore preview. Do not restore
old HP, inventory or quest snapshots over newer player work without review.

**Restore Checkpoint** previews all state changes since the selected coherent
checkpoint, including later player actions, created/deleted entities, cross-record
references, pending rolls and encounter progress. This is a broader operation than
undo. Require explicit DM confirmation of that concrete preview. Invalidate the
preview if the live revision changes; never silently retry with a newer base.

Before either operation, create a durable safety checkpoint of the current state.
Commit the reversal/restore as a new atomic, permission-checked command at a new
monotonically increasing revision. Link it to its source command/checkpoint;
preserve all original history. A failure leaves both live state and history
unchanged. Duplicate submissions return the same committed result. Restoring the
safety checkpoint provides a way back through the same reviewed restore process.

Reconcile pending rolls, reactions and client projections after restore. Old
responses, retries and queued commands cannot apply to the restored state using
obsolete revisions. Replaying recorded results never rerolls dice or calls the
model to decide mechanics. Narration follows the committed correction. History
cannot make players forget revealed information, retract external messages or
reverse external effects; the preview must disclose those limitations.

## UI and permissions

Provide a DM History surface with descriptions, actor, timestamp, revision,
affected entities and clear undo availability/rejection reasons. Show automatic
and named checkpoints with their scope and completeness. Expose Undo Last DM
Change near DM actions and Restore Checkpoint through History, with an impact
preview and confirmation. Keep existing character-level undo labeled separately.

The server verifies current DM/host authority and campaign scope for history reads
and restores. An invite code, client role flag or historical DM identity is not
proof. Publish the new committed revision to all clients and show a clear restore
notice. Reconnect/offline clients must refresh before submitting further changes.

## Implementation order and acceptance

After the current audit fixes, inventory existing history, mutation writers and
snapshot coverage during Phase 0. Add history contracts and transactional capture
to the Phase 2 command coordinator before broadening authoritative mechanics.
Then add safe undo, coherent checkpoints and reviewed restore. Extend domain by
domain before claiming support for all NPC, quest, people and item operations.

Required acceptance fixtures:

- Undo one NPC creation, one NPC deletion with references, quest edits, a new
  person, an item transfer/equip, resource spending and multi-target combat.
- Undo Fireball plus reflected damage as one group, restoring all supported
  consequences without rerolls or duplicate resource adjustments.
- Award then consume a potion; automatic award undo is blocked with the dependent
  consumption identified. Checkpoint restore shows both changes in its preview.
- Restore a deleted linked entity without dangling references or duplicate IDs.
- Reject stale previews and unauthorized/cross-campaign restore requests without
  writes; reject delayed rolls/commands from the previous revision.
- Simulate snapshot/history failure, interrupted commit, lost acknowledgment,
  duplicate restore, reload, server restart and two concurrent clients.
- Verify a safety checkpoint can recover the pre-restore state; retain original
  history and ensure credentials are never restored.

Choose and document checkpoint frequency, storage quotas, retention window,
protected checkpoints and export policy before rollout. Pruning must preserve a
verified restore base and required history within the advertised restore window.
Never silently delete a named/protected checkpoint or advertise a restore point
whose dependencies were pruned. Independent database backups remain necessary;
application snapshots share the application's failure domain.
