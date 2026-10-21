import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryItem } from "../../types/index.ts";
import {
  appendCombatReadinessNotes,
  buildInventoryCombatReadinessNotes,
} from "../../utils/combat/inventoryCombatReadiness.ts";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: overrides.id ?? "item-1",
    name: overrides.name ?? "Longsword",
    quantity: overrides.quantity ?? 1,
    equipped: overrides.equipped ?? true,
    category: overrides.category ?? "weapon",
    ...overrides,
  };
}

test("ammo-dependent weapons warn when inventory has no tracked ammunition", () => {
  const bow = makeItem({ name: "Longbow", subtype: "Longbow" });

  const notes = buildInventoryCombatReadinessNotes(bow, [bow]);

  assert.deepEqual(notes, [
    "Uses ammunition; ammo is not linked or consumed automatically during attacks.",
    "No tracked ammunition found in inventory.",
  ]);
});

test("ammo-dependent weapons skip missing-ammo warning when tracked ammunition exists", () => {
  const bow = makeItem({ name: "Shortbow", subtype: "Shortbow" });
  const arrows = makeItem({
    id: "ammo-1",
    name: "Arrows",
    category: "consumable",
    equipped: false,
    quantity: 20,
    tags: ["Ammunition"],
  });

  const notes = buildInventoryCombatReadinessNotes(bow, [bow, arrows]);

  assert.deepEqual(notes, [
    "Uses ammunition; ammo is not linked or consumed automatically during attacks.",
  ]);
});

test("attunement-tagged items surface attunement verification note", () => {
  const blade = makeItem({ name: "Sun Blade", tags: ["Requires Attunement"] });

  const notes = buildInventoryCombatReadinessNotes(blade, [blade]);

  assert.deepEqual(notes, [
    "Requires attunement; verify attuned state before relying on this item in combat.",
  ]);
});

test("non-ammo non-attunement weapons produce no readiness notes", () => {
  const sword = makeItem({ name: "Warhammer", subtype: "Warhammer" });

  const notes = buildInventoryCombatReadinessNotes(sword, [sword]);

  assert.deepEqual(notes, []);
});

test("appendCombatReadinessNotes preserves existing notes and de-duplicates exact additions", () => {
  const combined = appendCombatReadinessNotes(
    "Magic weapon",
    [
      "Requires attunement; verify attuned state before relying on this item in combat.",
      "Magic weapon",
    ],
  );

  assert.equal(
    combined,
    "Magic weapon\nRequires attunement; verify attuned state before relying on this item in combat.",
  );
});