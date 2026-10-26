import assert from "node:assert/strict";
import test from "node:test";
import { buildComposerAttackOptions, buildSessionCombatAttacks, getAvailableAttackGroups } from "../../utils/combat/composerAttackAvailability.ts";

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

test("session generates equipped weapon attacks even when no saved attacks exist", () => {
  const char = {
    class: "Fighter", level: 3, proficiencyBonus: 2,
    abilityScores: { strength: 16, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
  };
  const inventory = [
    { ...weapon("blade", true), name: "Longsword", damageDice: "1d8", damageType: "slashing", weaponRange: "5 ft" },
    { ...weapon("bow", false), name: "Longbow", damageDice: "1d8", weaponRange: "150/600 ft" },
  ];
  const projected = buildSessionCombatAttacks([], inventory, char);
  const choices = buildComposerAttackOptions(projected, inventory);
  assert.equal(choices.some((x) => x.attack.name === "Longsword" && x.group === "melee"), true);
  assert.equal(choices.some((x) => x.attack.name === "Longbow"), false);
  assert.equal(choices.some((x) => x.attack.name === "Unarmed Strike"), true);
  assert.deepEqual(getAvailableAttackGroups(choices), ["melee"]);
});

test("session includes unarmed strike without weapons", () => {
  const char = {
    class: "Monk", level: 5, proficiencyBonus: 3,
    abilityScores: { strength: 10, dexterity: 18, constitution: 12, intelligence: 10, wisdom: 14, charisma: 10 },
  };
  const projected = buildSessionCombatAttacks([], [], char);
  assert.equal(projected.length, 1);
  assert.equal(projected[0]?.damageDice, "1d6");
  assert.equal(projected[0]?.attackBonus, 7);
  assert.deepEqual(getAvailableAttackGroups(buildComposerAttackOptions(projected, [])), ["melee"]);
});

test("session does not duplicate already linked attacks", () => {
  const char = {
    class: "Fighter", level: 1, proficiencyBonus: 2,
    abilityScores: { strength: 14, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  };
  const weaponItem = { ...weapon("blade", true), damageDice: "1d8", weaponRange: "5 ft" };
  const projected = buildSessionCombatAttacks([attack("custom-blade", "blade", "5 ft")], [weaponItem], char);
  assert.equal(projected.filter((x) => x.linkedInventoryItemId === "blade").length, 1);
});
