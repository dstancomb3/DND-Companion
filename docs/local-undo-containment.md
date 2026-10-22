# Local undo safety containment

This is H0a of the undo audit: stop unsafe reversal before introducing complete
capture. It does not complete H0 or implement the planned cross-domain rollback.

## Behavior

The existing MutationHistory records have partial before snapshots, display
strings and an `undone` flag. They have no verified after state, entity revisions,
write sets or complete lifecycle side effects. Even a seemingly simple HP or
currency update may also change death saves, conditions or statistics.

`undoBatch` and `undoLast` now return an explicit `unavailable` result without
changing character fields, writing history, or marking a record undone. Missing,
unapplied and already-marked records return readable reasons too. A new field or
caller flag cannot grant permission to run the removed unsafe restore logic.

The Log shows recent recorded updates with an explanation instead of a working
Undo button. It now shows the newest five entries, and includes world-only
records that have no basic-field display deltas. Quick Update's four-second
status says “Applied. Undo unavailable for this update.” Its misleading Undo
button has been removed. All existing MutationHistory reversals are intentionally
unavailable until complete capture and safe commit are implemented. Separate
spell/action refund controls are outside this change and are not certified by it.

Quick Update records diagnostic history before routing to Loot Review, including
world/death/inventory updates that previously could have no basic display deltas.
`recordingStage: awaiting_item_review` labels a handoff that still needs item
confirmation. Neither this stage nor display deltas establish that every proposed
value was applied, or that history is a durable transaction receipt. Actual item
claim/review history and complete multi-screen transaction grouping remain work.

## Preserved boundaries and limitations

No existing saved history or character data is migrated or deleted. Existing
`undone` markers are retained as legacy evidence, not proof of successful reversal.
The history store still keeps 20 batches, appends after application and uses
best-effort local storage; this slice does not certify its durability. There is
no new snapshot schema, server history, database migration or authority change.

Next H0/H1 work: capture exact touched fields and complete before/after state,
record every supported side effect, establish ownership and revision/dependency
proof, handle persistence failure explicitly, and add guarded transactional
reversal. Only then re-enable supported undo commands. Current unverified records
must never be retroactively treated as safely reversible. Full roadmap:
[Audit](audits/undo-snapshot-audit.md) and [rollback specification](dm-history-and-rollback-spec.md).

## Validation and rollback

Six targeted tests cover legacy/missing snapshots, mixed handoffs, forged flags,
missing/inactive entries, direct/repeated undo and undoLast. The provider-level
regression fails on the old implementation. Three probes of the actual provider
now return refusal with zero character mutations; original unsafe probe evidence
is retained at its audited baseline. Current results:
[audit probes](audits/undo-safety-containment-probes.json).

Run `pnpm --filter @workspace/living-character-sheet run test:undo-safety` and
`node --import tsx scripts/audits/probe-current-undo.cjs` from the repository root.
Workspace typecheck and the 24 combat safety tests also pass. React/provider
boundaries are mocked in targeted tests. Browser/mobile layout and mixed-update
navigation acceptance remain pending; no live database test is required by this
client-only containment.

Rollback by reverting the client, tests and probe-script change together. No data
migration is needed. Reverting restores unsafe local undo, so prefer keeping this
guard while adding verified capture incrementally.
