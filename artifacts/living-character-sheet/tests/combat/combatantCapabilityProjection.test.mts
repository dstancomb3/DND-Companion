import assert from "node:assert/strict";
import test from "node:test";
import { projectNpcWeaponAttackCapabilities, projectPlayerAttackCapabilities } from "../../utils/combat/combatantCapabilityProjection.ts";

const attack = {
  id: "attack1", name: "Longsword", attackBonus: 5, damageDice: "1d8",
  damageModifier: 3, damageType: "slashing", reminders: [], linkedInventoryItemId: "sword",
};
const inventory = { id: "sword", name: "Longsword", category: "weapon" as const, equipped: true, quantity: 1 };
test("player projection tracks real ready attacks and excludes unequipped or missing inventory", () => {
  const ready = projectPlayerAttackCapabilities([attack], [inventory]);
  assert.equal(ready.length, 1);
  assert.equal(ready[0]?.sourceItemId, "sword");
  assert.deepEqual(projectPlayerAttackCapabilities([attack], [{ ...inventory, equipped: false }]), []);
  assert.deepEqual(projectPlayerAttackCapabilities([attack], []), []);
});
test("standalone player attacks remain possible and invalid attack data fails closed", () => {
  assert.equal(projectPlayerAttackCapabilities([{ ...attack, linkedInventoryItemId: undefined }], []).length, 1);
  assert.deepEqual(projectPlayerAttackCapabilities([{ ...attack, damageDice: "roll anything" }], [inventory]), []);
});
test("NPC projection uses only explicit equipped weapon attacks", () => {
  const gear = { id: "bow", name: "Shortbow", category: "weapon" as const,
    equipped: true, attackBonus: 4, damageDice: "1d6", damageModifier: 2,
    damageType: "piercing", range: "80/320 ft" };
  const ready = projectNpcWeaponAttackCapabilities([gear]);
  assert.deepEqual(ready[0], {
    id: "npc-weapon:bow", name: "Shortbow", source: "npc_weapon", sourceItemId: "bow",
    attackBonus: 4, damageDice: "1d6", damageModifier: 2, damageType: "piercing", range: "80/320 ft",
  });
  assert.deepEqual(projectNpcWeaponAttackCapabilities([{ ...gear, equipped: false }]), []);
  assert.deepEqual(projectNpcWeaponAttackCapabilities([{ ...gear, attackBonus: undefined }]), []);
  assert.deepEqual(projectNpcWeaponAttackCapabilities([{ ...gear, damageDice: "unknown" }]), []);
});
