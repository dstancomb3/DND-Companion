# Character snapshot coverage: limited-use effects

This is H1a of the undo/snapshot audit, addressing part of U07. It repairs a
specific save/load loss without claiming that CharacterSnapshot is a complete
combat checkpoint or enabling undo.

## Captured state

Character snapshots now have optional `spellEffectUses` and `itemActionUses`
fields. Each is a map from the runtime's stable effect ID to remaining uses.
Zero is an explicit exhausted state and is preserved. Counts are copied at the
normalization boundary to prevent snapshot/live object aliasing.

Both CharacterContext save builders (normal save and inventory reorder) include
these maps. The loader restores them instead of clearing them. Snapshot import,
portable export, the Edit Character export/paste-import paths and its repaired
snapshot path preserve provided fields. Paste import now uses the existing shared
import adapter, avoiding a second field list that can drop usage state. Clearing
a character still resets usage; loading another character uses only that
character's snapshot. Existing spend/recharge timing is unchanged.

Present usage data must be an object containing nonnegative safe integer counts.
Null, arrays, strings, negative/fractional/nonfinite/unsafe numbers are rejected;
invalid data is not silently replaced with full charges. Validation runs before
CharacterContext applies any state. Import adapters return a readable error,
and the paste/repaired import UI surfaces failures without loading the snapshot.

Older full snapshots that omit the maps load with empty usage maps, preserving
the previous default behavior. Missing historical counts cannot be recovered;
this is not evidence the character had full charges. Bare-character edits keep
the surrounding base snapshot and its usage, as they already do for inventory.
The additive optional fields retain snapshot `_version` compatibility; no stored
rows are rewritten or automatically migrated.

## Limits and next work

Counts persist when the character is saved through an existing save path. This
does not add an automatic durable checkpoint on each ability use. It does not
change shared-party authority, recover unsaved state after a crash, or persist
CombatContext concentration, pending reactions and local action economy. World
records, complete transactional history, read-failure handling and versioned
restore remain separate work. Unverified local undo stays disabled.

No database schema/migration, new dependency or API contract is involved. Do not
restore a snapshot as a full combat checkpoint based on these two fields alone.

## Validation and rollback

Sixteen focused tests cover codec and JSON round-trips, full/bare imports, legacy
compatibility, copied maps, malformed values, stable projected equipment effect
IDs and actual CharacterProvider load/spend/save/reorder/clear/switch behavior.
Provider React hooks and persistence are mocked, not a browser or disk test.
Fourteen of the original fifteen new regressions fail against the preceding
loader/import/normalization code.

Six undo-containment tests, the 24 combat safety tests and eight existing
import/export/companion contract tests also pass. The existing `.mts` compatibility
suite was run as a temporary byte-identical `.cts` copy to match this CommonJS
package; the tracked test and scripts were not changed. Workspace typecheck
passes. Browser/device save/reload and file-sharing/AI-repair interaction remain
manual acceptance steps.

Use `pnpm --filter @workspace/living-character-sheet run test:snapshot-usage`
for the new tests. Roll back the matching adapter, context, type and UI changes
together if needed. Older code ignores or drops the optional fields and clears
counts on load, so reverting reintroduces the loss. No database rollback is needed.
