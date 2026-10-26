import assert from "node:assert/strict";
import test from "node:test";
import { buildCombatantCapabilityCatalog, hasExecutableAttackDefinition } from "../../utils/combat/combatantCapabilityCatalog.ts";

test("retains attack, prepared spell, feat, feature and consumable capabilities", () => {
  const catalog = buildCombatantCapabilityCatalog({
    combatantId: "npc-1",
    inventory: [
      { id: "bow", name: "Bow", category: "weapon", quantity: 1, equipped: true, attackBonus: 4, damageDice: "1d6", damageModifier: 2, damageType: "piercing", weaponRange: "80/320 ft" },
      { id: "potion", name: "Healing Potion", category: "consumable", quantity: 2 },
      { id: "hidden", name: "Dagger", category: "weapon", quantity: 1, equipped: false },
    ],
    spells: [{ id: "shield", name: "Shield", level: 1, prepared: true, timing: "reaction", targetPolicy: "self" },
      { id: "sleep", name: "Sleep", level: 1, prepared: false }],
    feats: [{ id: "tough", name: "Tough" }],
    features: [{ id: "nimble", name: "Nimble Escape", timing: "bonus_action" }],
  });
  assert.deepEqual(catalog.capabilities.map(x => x.kind), ["attack", "item", "spell", "feat", "feature"]);
  assert.equal(hasExecutableAttackDefinition(catalog.capabilities[0]), true);
  assert.equal(hasExecutableAttackDefinition(catalog.capabilities[2]), false);
});
test("linked attacks are not double generated from inventory", () => {
  const catalog = buildCombatantCapabilityCatalog({
    combatantId: "npc-1",
    inventory: [{ id: "sword", name: "Sword", category: "weapon", quantity: 1, equipped: true }],
    attacks: [{ id: "slash", name: "Slash", linkedInventoryItemId: "sword" }],
  });
  assert.deepEqual(catalog.capabilities.map(x => x.id), ["attack:slash"]);
  assert.equal(hasExecutableAttackDefinition(catalog.capabilities[0]), false);
});
test("unavailable gear cannot yield attacks and no mechanics are invented", () => {
  const catalog = buildCombatantCapabilityCatalog({
    combatantId: "npc-1",
    inventory: [{ id: "a", name: "Bow", category: "weapon", quantity: 0, equipped: true },
      { id: "b", name: "Dagger", category: "weapon", quantity: 1, equipped: false }],
    attacks: [{ id: "bowattack", name: "Shoot", linkedInventoryItemId: "a" }],
  });
  assert.equal(catalog.capabilities.length, 0);
});
