import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryItem } from "../../types/index.ts";
import { normalizeEquippedInventorySlots } from "../../utils/equipment/equipmentSlotRules.ts";

function makeItem(partial: Partial<InventoryItem> & { id: string; name: string; category: InventoryItem["category"] }): InventoryItem {
  return {
    id: partial.id,
    name: partial.name,
    quantity: partial.quantity ?? 1,
    equipped: partial.equipped ?? false,
    category: partial.category,
    subtype: partial.subtype,
    tags: partial.tags,
    damageDice: partial.damageDice,
    damageType: partial.damageType,
    damageModifier: partial.damageModifier,
    notes: partial.notes,
  } as InventoryItem;
}

test("preferred two-handed weapon auto-unequips shield and one-handed conflicts", () => {
  const inventory: InventoryItem[] = [
    makeItem({ id: "w-1", name: "Longsword", category: "weapon", equipped: true, damageDice: "1d8", damageType: "slashing" }),
    makeItem({ id: "a-1", name: "Shield", category: "armor", subtype: "Shield", equipped: true }),
    makeItem({ id: "w-2", name: "Greatsword", category: "weapon", equipped: true, tags: ["Two-Handed"], damageDice: "2d6", damageType: "slashing" }),
  ];

  const result = normalizeEquippedInventorySlots(inventory, { preferredItemId: "w-2" });
  const equippedIds = result.inventory.filter((item) => item.equipped).map((item) => item.id);

  assert.deepEqual(equippedIds, ["w-2"]);
  assert.deepEqual(new Set(result.autoUnequippedIds), new Set(["w-1", "a-1"]));
});

test("shield plus two one-handed weapons is normalized to legal two-hand occupancy", () => {
  const inventory: InventoryItem[] = [
    makeItem({ id: "w-main", name: "Rapier", category: "weapon", equipped: true, damageDice: "1d8", damageType: "piercing" }),
    makeItem({ id: "w-off", name: "Dagger", category: "weapon", equipped: true, damageDice: "1d4", damageType: "piercing" }),
    makeItem({ id: "a-shield", name: "Shield", category: "armor", subtype: "Shield", equipped: true }),
  ];

  const result = normalizeEquippedInventorySlots(inventory);
  const equippedIds = result.inventory.filter((item) => item.equipped).map((item) => item.id);

  assert.deepEqual(equippedIds, ["w-main", "w-off"]);
  assert.deepEqual(result.autoUnequippedIds, ["a-shield"]);
});

test("preferred shield keeps shield and one weapon when equipping from an impossible hand state", () => {
  const inventory: InventoryItem[] = [
    makeItem({ id: "w-main", name: "Longsword", category: "weapon", equipped: true, damageDice: "1d8", damageType: "slashing" }),
    makeItem({ id: "w-off", name: "Dagger", category: "weapon", equipped: true, damageDice: "1d4", damageType: "piercing" }),
    makeItem({ id: "a-shield", name: "Shield", category: "armor", subtype: "Shield", equipped: true }),
  ];

  const result = normalizeEquippedInventorySlots(inventory, { preferredItemId: "a-shield" });
  const equippedIds = result.inventory.filter((item) => item.equipped).map((item) => item.id);

  assert.deepEqual(new Set(equippedIds), new Set(["a-shield", "w-main"]));
  assert.deepEqual(result.autoUnequippedIds, ["w-off"]);
});
