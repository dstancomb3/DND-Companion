import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryItem } from "../../types/index.ts";
import {
  mergeInventoryItemIntoMatchingUnequippedStack,
  splitInventoryStackForEquip,
} from "../../utils/equipment/inventoryStacks.ts";

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
    weaponRange: partial.weaponRange,
    notes: partial.notes,
    pinned: partial.pinned,
  } as InventoryItem;
}

test("equipping a stacked weapon splits out a single equipped item", () => {
  const inventory: InventoryItem[] = [
    makeItem({
      id: "dagger-stack",
      name: "Dagger",
      category: "weapon",
      quantity: 7,
      damageDice: "1d4",
      damageType: "piercing",
      weaponRange: "20/60 ft",
      tags: ["Finesse", "Light", "Thrown"],
    }),
  ];

  const result = splitInventoryStackForEquip(inventory, "dagger-stack", "dagger-equipped");

  assert.equal(result.didSplit, true);
  assert.equal(result.equippedItemId, "dagger-equipped");
  assert.equal(result.inventory.length, 2);

  const backpackStack = result.inventory.find((item) => item.id === "dagger-stack");
  const equippedSingle = result.inventory.find((item) => item.id === "dagger-equipped");

  assert.equal(backpackStack?.quantity, 6);
  assert.equal(backpackStack?.equipped, false);
  assert.equal(equippedSingle?.quantity, 1);
  assert.equal(equippedSingle?.equipped, true);
});

test("unequipping a split stack item merges it back into the matching backpack stack", () => {
  const inventory: InventoryItem[] = [
    makeItem({
      id: "dagger-stack",
      name: "Dagger",
      category: "weapon",
      quantity: 6,
      damageDice: "1d4",
      damageType: "piercing",
      weaponRange: "20/60 ft",
      tags: ["Finesse", "Light", "Thrown"],
    }),
  ];
  const unequippedSingle = makeItem({
    id: "dagger-equipped",
    name: "Dagger",
    category: "weapon",
    quantity: 1,
    equipped: false,
    damageDice: "1d4",
    damageType: "piercing",
    weaponRange: "20/60 ft",
    tags: ["Finesse", "Light", "Thrown"],
  });

  const result = mergeInventoryItemIntoMatchingUnequippedStack(inventory, unequippedSingle);

  assert.equal(result.merged, true);
  assert.equal(result.mergedIntoId, "dagger-stack");
  assert.equal(result.inventory.length, 1);
  assert.equal(result.inventory[0]?.quantity, 7);
  assert.equal(result.inventory[0]?.equipped, false);
});