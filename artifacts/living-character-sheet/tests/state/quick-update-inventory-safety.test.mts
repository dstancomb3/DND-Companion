import assert from "node:assert/strict";
import test from "node:test";

import { partitionQuickUpdateInventoryChanges } from "../../utils/quickUpdateInventorySafety";
import type { ProposedInventoryItem } from "../../types";

function makeItem(overrides: Partial<ProposedInventoryItem> = {}): ProposedInventoryItem {
  return {
    id: overrides.id ?? "item_1",
    name: overrides.name ?? "Item",
    quantity: overrides.quantity ?? 1,
    category: overrides.category ?? "magic",
    confidence: overrides.confidence ?? "medium",
    needsReview: overrides.needsReview ?? false,
    ...(overrides.equippedEffects ? { equippedEffects: overrides.equippedEffects } : {}),
    ...(overrides.additionalDamage ? { additionalDamage: overrides.additionalDamage } : {}),
    ...(overrides.mechanics ? { mechanics: overrides.mechanics } : {}),
  };
}

test("partitions needs-review inventory changes into review bucket", () => {
  const item = makeItem({ id: "review", needsReview: true });
  const result = partitionQuickUpdateInventoryChanges([item]);

  assert.equal(result.autoApplicable.length, 0);
  assert.equal(result.requiresReview.length, 1);
  assert.equal(result.requiresReview[0]?.id, "review");
});

test("partitions low-confidence structured mechanics changes into review bucket", () => {
  const item = makeItem({
    id: "low_structured",
    confidence: "low",
    equippedEffects: [{ id: "eff", type: "stat_bonus", label: "AC Bonus", statKey: "armorClass", statValue: 1 }],
  });

  const result = partitionQuickUpdateInventoryChanges([item]);

  assert.equal(result.autoApplicable.length, 0);
  assert.equal(result.requiresReview.length, 1);
  assert.equal(result.requiresReview[0]?.id, "low_structured");
});

test("keeps low-confidence non-structured changes auto-applicable", () => {
  const item = makeItem({ id: "low_plain", confidence: "low", notes: "Rusty trinket." });

  const result = partitionQuickUpdateInventoryChanges([item]);

  assert.equal(result.autoApplicable.length, 1);
  assert.equal(result.autoApplicable[0]?.id, "low_plain");
  assert.equal(result.requiresReview.length, 0);
});

test("keeps high-confidence structured mechanics changes auto-applicable", () => {
  const item = makeItem({
    id: "high_structured",
    confidence: "high",
    additionalDamage: [{ dice: "1d4", damageType: "fire" }],
  });

  const result = partitionQuickUpdateInventoryChanges([item]);

  assert.equal(result.autoApplicable.length, 1);
  assert.equal(result.autoApplicable[0]?.id, "high_structured");
  assert.equal(result.requiresReview.length, 0);
});
