import assert from "node:assert/strict";
import test from "node:test";
import { readSnapshotEffectUsage } from "../../utils/mechanics/snapshotEffectUsage";
import { normalizeCharacterSnapshotMechanics, assemblePortableCharacterSnapshot } from "../../utils/mechanics/characterSnapshotMechanicsAdapters";
import { buildImportedCharacterSnapshot, buildPortableCharacterExport } from "../../utils/characterImportExport";
import { mockLyraSnapshot } from "../../data/mockCharacter";

const snapshot = { ...mockLyraSnapshot, spellEffectUses: { exhausted: 0, spell: 2 }, itemActionUses: { exhausted: 0, item: 1 } };
test("remaining uses, including zero, survive normalization, JSON export and full import", () => {
  const exported = buildPortableCharacterExport(snapshot);
  const parsed = JSON.parse(JSON.stringify(exported));
  const result = buildImportedCharacterSnapshot({ parsed, baseSnapshot: { ...snapshot, spellEffectUses: { wrongCharacter: 99 } } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.snapshot.spellEffectUses, snapshot.spellEffectUses);
  assert.deepEqual(result.snapshot.itemActionUses, snapshot.itemActionUses);
  assert.deepEqual(assemblePortableCharacterSnapshot(result.snapshot).spellEffectUses, snapshot.spellEffectUses);
});
test("legacy full snapshots default to empty usage without borrowing the active character's counts", () => {
  const result = buildImportedCharacterSnapshot({ parsed: mockLyraSnapshot, baseSnapshot: snapshot });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.snapshot.spellEffectUses, {});
  assert.deepEqual(result.snapshot.itemActionUses, {});
});
test("bare-character edits retain the base snapshot's usage", () => {
  const result = buildImportedCharacterSnapshot({ parsed: { name: "Edited", class: "Wizard" }, baseSnapshot: snapshot });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.snapshot.spellEffectUses, snapshot.spellEffectUses);
});
test("normalization clones usage maps, keeping saved state isolated from live edits", () => {
  const normalized = normalizeCharacterSnapshotMechanics(snapshot);
  normalized.spellEffectUses!.spell = 0;
  assert.equal(snapshot.spellEffectUses.spell, 2);
});
for (const bad of [null, [], "2", { spell: -1 }, { spell: 0.5 }, { spell: NaN }, { spell: Infinity }, { spell: Number.MAX_SAFE_INTEGER + 1 }, { spell: "0" }]) {
  test(`invalid usage is refused: ${String(bad)}`, () => {
    assert.throws(() => readSnapshotEffectUsage(bad, "spellEffectUses"), /Invalid spellEffectUses/);
    const result = buildImportedCharacterSnapshot({ parsed: { ...snapshot, spellEffectUses: bad }, baseSnapshot: snapshot });
    assert.equal(result.ok, false);
  });
}

test("projected equipped effect IDs still address saved usage after portable normalization", () => {
  const { getRuntimeItemProjectedEffects } = require("../../utils/mechanics/runtimeMechanicsCompatibility");
  const item = { id: "limited-item", name: "Charged focus", category: "gear" as const, quantity: 1, equipped: true,
    equippedEffects: [
      { id: "spell", type: "spell" as const, label: "Light", uses: 2, resetOn: "long_rest" as const },
      { id: "feature", type: "feature" as const, label: "Ward", uses: 1, resetOn: "long_rest" as const },
    ] };
  const effects = getRuntimeItemProjectedEffects(item);
  assert.ok(effects.length > 0);
  const spellUses = Object.fromEntries(effects.filter((e: any) => e.type === "spell").map((e: any) => [e.id, 0]));
  const itemUses = Object.fromEntries(effects.filter((e: any) => e.type !== "spell").map((e: any) => [e.id, 0]));
  const normalized = normalizeCharacterSnapshotMechanics(JSON.parse(JSON.stringify(assemblePortableCharacterSnapshot({ ...mockLyraSnapshot, inventory: [item], spellEffectUses: spellUses, itemActionUses: itemUses }))));
  const reloaded = getRuntimeItemProjectedEffects(normalized.inventory[0]);
  assert.deepEqual(reloaded.map((e: any) => e.id), effects.map((e: any) => e.id));
  for (const effect of reloaded) assert.equal((effect.type === "spell" ? normalized.spellEffectUses : normalized.itemActionUses)![effect.id], 0);
});
