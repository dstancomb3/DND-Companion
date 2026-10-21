import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryItem } from "../../types/index.ts";
import {
  buildLootAssignmentItemFromInventory,
  getRemainingQuantityAfterTransfer,
  getTransferableInventoryItems,
  isPartyTransferEligibleItem,
  toLootAssignmentCategory,
} from "../../utils/partyItemTransfer.ts";

function makeItem(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: overrides.id ?? "item-1",
    name: overrides.name ?? "Torch",
    quantity: overrides.quantity ?? 1,
    equipped: overrides.equipped ?? false,
    category: overrides.category ?? "gear",
    ...overrides,
  };
}

test("isPartyTransferEligibleItem rejects equipped or empty items", () => {
  assert.equal(isPartyTransferEligibleItem(makeItem({ quantity: 0 })), false);
  assert.equal(isPartyTransferEligibleItem(makeItem({ equipped: true })), false);
  assert.equal(isPartyTransferEligibleItem(makeItem({ quantity: 2, equipped: false })), true);
});

test("toLootAssignmentCategory keeps known categories stable", () => {
  assert.equal(toLootAssignmentCategory(makeItem({ category: "weapon" })), "weapon");
  assert.equal(toLootAssignmentCategory(makeItem({ category: "map" })), "map");
  assert.equal(toLootAssignmentCategory(makeItem({ category: "other" })), "other");
});

test("buildLootAssignmentItemFromInventory maps transferable fields", () => {
  const item = makeItem({
    name: "Potion of Healing",
    quantity: 3,
    category: "consumable",
    notes: "2d4 + 2",
    value: 50,
    imageUri: "https://example.com/potion.png",
    imageSource: "dm",
    tags: ["rare", "healing"],
    sourceTag: "official",
  });

  const mapped = buildLootAssignmentItemFromInventory(item, 2);
  assert.deepEqual(mapped, {
    name: "Potion of Healing",
    quantity: 2,
    category: "consumable",
    notes: "2d4 + 2",
    value: 50,
    imageUri: "https://example.com/potion.png",
    imageSource: "dm",
    inventoryItem: {
      name: "Potion of Healing",
      quantity: 2,
      equipped: false,
      category: "consumable",
      notes: "2d4 + 2",
      value: 50,
      imageUri: "https://example.com/potion.png",
      imageSource: "dm",
      tags: ["rare", "healing"],
      sourceTag: "official",
    },
  });
});

test("getTransferableInventoryItems filters to eligible rows", () => {
  const rows = [
    makeItem({ id: "a", quantity: 2, equipped: false }),
    makeItem({ id: "b", quantity: 0, equipped: false }),
    makeItem({ id: "c", quantity: 1, equipped: true }),
  ];

  const filtered = getTransferableInventoryItems(rows);
  assert.deepEqual(filtered.map((item) => item.id), ["a"]);
});

test("getRemainingQuantityAfterTransfer floors and clamps", () => {
  assert.equal(getRemainingQuantityAfterTransfer(5, 2), 3);
  assert.equal(getRemainingQuantityAfterTransfer(1, 4), 0);
  assert.equal(getRemainingQuantityAfterTransfer(3.9, 1.2), 2);
});
