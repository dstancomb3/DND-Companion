import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSavedDmNpcInventory, normalizeSavedDmNpcRecord } from "../../utils/dmNpcStorage.ts";

test("normalizeSavedDmNpcInventory falls back to empty array for legacy rows", () => {
  assert.deepEqual(normalizeSavedDmNpcInventory(undefined), []);
  assert.deepEqual(normalizeSavedDmNpcInventory(null), []);
});

test("normalizeSavedDmNpcRecord preserves valid inventory rows and adds compatibility default", () => {
  const legacy = normalizeSavedDmNpcRecord({ id: "npc-1", name: "Mara", inventory: undefined });
  const current = normalizeSavedDmNpcRecord({
    id: "npc-2",
    name: "Bran",
    inventory: [
      {
        id: "item-1",
        name: "Thieves' Tools",
        quantity: 1,
        equipped: false,
        category: "gear",
      },
    ],
  });

  assert.deepEqual(legacy.inventory, []);
  assert.equal(current.inventory.length, 1);
  assert.equal(current.inventory[0]?.name, "Thieves' Tools");
  assert.equal(current.inventory[0]?.category, "gear");
});