import assert from "node:assert/strict";
import test from "node:test";
import { buildComposerAttackOptions, getAvailableAttackGroups } from "../../utils/combat/composerAttackAvailability.ts";

const attack = (id: string, itemId: string | undefined, range: string | undefined) => ({
  id, name: id, attackBonus: 5, damageDice: "1d8", damageModifier: 3,
  damageType: "slashing", reminders: [], linkedInventoryItemId: itemId, range,
});
const weapon = (id: string, equipped: boolean, quantity = 1) => ({
  id, name: id, category: "weapon" as const, equipped, quantity,
});

test("does not advertise ranged weapon category without usable ranged weapon", () => {
  const options = buildComposerAttackOptions(
    [attack("sword", "sword", "5 ft"), attack("bow", "bow", "80/320 ft")],
    [weapon("sword", true), weapon("bow", false)],
  );
  assert.deepEqual(options.map(({ attack, group }) => [attack.id, group]), [["sword", "melee"]]);
  assert.deepEqual(getAvailableAttackGroups(options), ["melee"]);
});

test("shows ranged weapon when equipped and hides absent or empty linked weapons", () => {
  const options = buildComposerAttackOptions(
    [attack("bow", "bow", "80/320 ft"), attack("missing", "missing", "80/320 ft"), attack("spent", "spent", "30 ft")],
    [weapon("bow", true), weapon("spent", true, 0)],
  );
  assert.deepEqual(getAvailableAttackGroups(options), ["ranged"]);
  assert.deepEqual(options.map(x => x.attack.id), ["bow"]);
});

test("keeps unlinked legacy/custom attack available but avoids claiming unspecified range", () => {
  const options = buildComposerAttackOptions([attack("custom", undefined, undefined)], []);
  assert.deepEqual(options.map(x => x.group), ["other"]);
});

test("no empty categories and no duplicate linked weapon projection", () => {
  assert.deepEqual(getAvailableAttackGroups([]), []);
  assert.deepEqual(buildComposerAttackOptions([attack("bow", "bow", "80/320 ft")], [weapon("bow", false)]), []);
});

test("range classification does not infer ranged status from ambiguous text", () => {
  const options = buildComposerAttackOptions([attack("improvised", "blade", "special")], [weapon("blade", true)]);
  assert.deepEqual(options.map(x => x.group), ["other"]);
});
