import assert from "node:assert/strict";
import test from "node:test";

import { deduplicateItems, mergeProposedItems } from "../../utils/lootReviewMerge";
import type { ProposedInventoryItem } from "../../types";

function makeItem(overrides: Partial<ProposedInventoryItem> = {}): ProposedInventoryItem {
  return {
    id: overrides.id ?? "item_1",
    name: overrides.name ?? "Ring of Steady Aim",
    quantity: overrides.quantity ?? 1,
    category: overrides.category ?? "magic",
    confidence: overrides.confidence ?? "medium",
    needsReview: overrides.needsReview ?? false,
    ...(overrides.notes ? { notes: overrides.notes } : {}),
    ...(overrides.equippedEffects ? { equippedEffects: overrides.equippedEffects } : {}),
    ...(overrides.additionalDamage ? { additionalDamage: overrides.additionalDamage } : {}),
    ...(overrides.tags ? { tags: overrides.tags } : {}),
    ...(overrides.officialMatch ? { officialMatch: overrides.officialMatch } : {}),
    ...(overrides.sourceTag ? { sourceTag: overrides.sourceTag } : {}),
  };
}

test("mergeProposedItems keeps highest confidence and preserves needsReview", () => {
  const high = makeItem({
    id: "ring_a",
    confidence: "high",
    needsReview: false,
    notes: "Polished silver ring.",
    equippedEffects: [{ id: "eff_init", type: "stat_bonus", label: "Initiative Bonus", statKey: "initiative", statValue: 1 }],
  });
  const low = makeItem({
    id: "ring_b",
    confidence: "low",
    needsReview: true,
    notes: "No bonus to AC, maybe grants +1 AC.",
    equippedEffects: [{ id: "eff_ac", type: "stat_bonus", label: "AC Bonus", statKey: "armorClass", statValue: 1 }],
  });

  const merged = mergeProposedItems(high, low);

  assert.equal(merged.confidence, "high");
  assert.equal(merged.needsReview, true);
  assert.equal(merged._mergedCount, 2);

  const labels = (merged.equippedEffects ?? []).map((e) => e.label).sort();
  assert.deepEqual(labels, ["AC Bonus", "Initiative Bonus"]);
});

test("deduplicateItems merges duplicate names into existing entries", () => {
  const existing = [
    makeItem({ id: "existing_1", name: "The Ring of Steady Aim", quantity: 1, confidence: "high" }),
  ];
  const incoming = [
    makeItem({ id: "incoming_1", name: "Ring of Steady Aim", quantity: 2, confidence: "low", needsReview: true }),
  ];

  const result = deduplicateItems(incoming, existing);

  assert.equal(result.deduped.length, 0);
  assert.equal(result.updatedExisting.length, 1);
  assert.equal(result.updatedExisting[0]?.id, "existing_1");
  assert.equal(result.updatedExisting[0]?.quantity, 2);
  assert.equal(result.updatedExisting[0]?.confidence, "high");
  assert.equal(result.updatedExisting[0]?.needsReview, true);
});

test("deduplicateItems keeps sourceTag official if any side is official", () => {
  const incoming = [
    makeItem({ id: "a", name: "Moon Charm", sourceTag: "custom", officialMatch: false }),
    makeItem({ id: "b", name: "Moon Charm", sourceTag: "official", officialMatch: true }),
  ];

  const result = deduplicateItems(incoming);

  assert.equal(result.updatedExisting.length, 0);
  assert.equal(result.deduped.length, 1);
  assert.equal(result.deduped[0]?.sourceTag, "official");
});
