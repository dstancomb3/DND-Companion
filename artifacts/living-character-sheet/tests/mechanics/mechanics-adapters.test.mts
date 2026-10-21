import assert from "node:assert/strict";
import test from "node:test";

import type { ItemEffect, ItemMechanicsBlock } from "../../types/index.ts";
import {
  itemMechanicsBlockToLegacyCompatibility,
  legacyItemToItemMechanicsBlock,
} from "../../utils/mechanics/itemMechanicsAdapters.ts";
import { envelopeToRuntimeCompatibilityItem } from "../../utils/mechanics/mechanicsEnvelopeAdapters.ts";
import {
  mergeItemMechanicsBlocks,
  projectRuntimeItemCompatibility,
} from "../../utils/mechanics/runtimeMechanicsCompatibility.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttackDamageEffect(overrides: Partial<ItemEffect> = {}): ItemEffect {
  return {
    id: "effect-1",
    type: "attack_damage",
    label: "Sword Strike",
    attackDamageDice: "1d8",
    attackDamageType: "slashing",
    attackDamageBonus: 2,
    ...overrides,
  };
}

function makeMinimalMechanicsBlock(overrides: Partial<ItemMechanicsBlock> = {}): ItemMechanicsBlock {
  return {
    schemaVersion: "v1",
    ownerType: "item",
    mechanics: [],
    review: { reviewStatus: "supported", confidence: "high" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// legacyItemToItemMechanicsBlock: attack_damage effect → action mechanic
// ---------------------------------------------------------------------------

test("legacyItemToItemMechanicsBlock: attack_damage effect produces action mechanic with activation='action'", () => {
  const block = legacyItemToItemMechanicsBlock({
    name: "Longsword",
    equippedEffects: [makeAttackDamageEffect()],
  });

  assert.equal(block.mechanics.length, 1);
  const mech = block.mechanics[0];
  assert.equal(mech.kind, "action");
  assert.ok("action" in mech, "mech must have action property");
  if (mech.kind === "action") {
    assert.equal(mech.action.activation, "action");
  }
});

test("legacyItemToItemMechanicsBlock: attack_damage effect produces mechanic targeting enemies", () => {
  const block = legacyItemToItemMechanicsBlock({
    name: "Dagger",
    equippedEffects: [makeAttackDamageEffect({ attackDamageDice: "1d4" })],
  });

  const mech = block.mechanics[0];
  if (mech.kind === "action") {
    assert.equal(mech.action.target.selectionMode, "single");
    assert.deepEqual(mech.action.target.targetKinds, ["enemy"]);
  }
});

// ---------------------------------------------------------------------------
// legacyItemToItemMechanicsBlock: canonical weapon fields → mechanics
// ---------------------------------------------------------------------------

test("legacyItemToItemMechanicsBlock: canonical damageDice+damageType without equippedEffects produces weapon mechanic", () => {
  const block = legacyItemToItemMechanicsBlock({
    name: "Hand Axe",
    damageDice: "1d6",
    damageType: "slashing",
    equippedEffects: [],
  });

  assert.equal(block.mechanics.length, 1, "Should produce one mechanic from canonical weapon fields");
  const mech = block.mechanics[0];
  assert.equal(mech.kind, "action");
  if (mech.kind === "action") {
    assert.equal(mech.action.actionType, "attack");
    assert.equal(mech.action.activation, "action");
  }
});

test("legacyItemToItemMechanicsBlock: canonical weapon fields NOT synthesized when attack_damage effect already present", () => {
  // Effect already handles it; do not double-count
  const block = legacyItemToItemMechanicsBlock({
    name: "Battleaxe",
    damageDice: "1d8",
    damageType: "slashing",
    equippedEffects: [makeAttackDamageEffect({ attackDamageDice: "1d8", attackDamageType: "slashing" })],
  });

  assert.equal(block.mechanics.length, 1, "Should have exactly one mechanic — effect, not canonical duplicate");
});

test("legacyItemToItemMechanicsBlock: no mechanic synthesized when damageDice and damageType are absent", () => {
  const block = legacyItemToItemMechanicsBlock({
    name: "Shield",
    equippedEffects: [],
  });

  assert.equal(block.mechanics.length, 0);
});

// ---------------------------------------------------------------------------
// envelopeToRuntimeCompatibilityItem: v1 envelope → clean block
// ---------------------------------------------------------------------------

test("envelopeToRuntimeCompatibilityItem: valid v1 envelope produces supported block", () => {
  const innerBlock = makeMinimalMechanicsBlock({
    mechanics: [],
  });
  const envelope = {
    schemaVersion: "v1",
    ownerType: "item",
    mechanics: innerBlock,
  };

  const result = envelopeToRuntimeCompatibilityItem(envelope);
  assert.equal(result.validationErrors.length, 0, "No validation errors for valid v1");
  assert.equal(result.mechanicsBlock.ownerType, "item");
});

// ---------------------------------------------------------------------------
// envelopeToRuntimeCompatibilityItem: unknown schemaVersion → degraded, NOT empty
// ---------------------------------------------------------------------------

test("envelopeToRuntimeCompatibilityItem: unknown schemaVersion preserves mechanics array (no data loss)", () => {
  const fakeMechanic = {
    schemaVersion: "v1",
    mechanicId: "m-1",
    kind: "action",
    name: "Test Attack",
    sourceType: "item",
    review: { reviewStatus: "supported", confidence: "high" },
    action: {
      actionType: "attack",
      activation: "action",
      effects: [],
      target: { selectionMode: "single", targetKinds: ["enemy"], quantity: { mode: "exact", value: 1 } },
      resolution: { mode: "attack_roll", attackType: "melee_weapon", damageParts: [] },
    },
  };

  const envelope = {
    schemaVersion: "v99", // unknown future version
    ownerType: "item",
    mechanics: {
      schemaVersion: "v99",
      ownerType: "item",
      mechanics: [fakeMechanic],
      review: { reviewStatus: "supported", confidence: "high" },
    },
  };

  const result = envelopeToRuntimeCompatibilityItem(envelope);
  assert.ok(result.validationErrors.length > 0, "Should report schemaVersion validation error");
  assert.equal(result.mechanicsBlock.mechanics.length, 1, "Mechanics MUST be preserved, not discarded");
  assert.notEqual(result.mechanicsBlock.review.reviewStatus, "unsupported", "Should NOT fall back to full unsupported status");
});

test("envelopeToRuntimeCompatibilityItem: unknown schemaVersion with empty mechanics block returns degraded not fallback", () => {
  const envelope = {
    schemaVersion: "v2",
    ownerType: "item",
    mechanics: {
      schemaVersion: "v2",
      ownerType: "item",
      mechanics: [],
      review: { reviewStatus: "supported", confidence: "high" },
    },
  };

  const result = envelopeToRuntimeCompatibilityItem(envelope);
  assert.ok(result.validationErrors.some((e) => e.includes("schemaVersion")));
  assert.equal(result.mechanicsBlock.review.reviewStatus, "needs_review");
});

// ---------------------------------------------------------------------------
// mergeItemMechanicsBlocks: undefined inputs pass-through
// ---------------------------------------------------------------------------

test("mergeItemMechanicsBlocks: both undefined returns undefined", () => {
  assert.equal(mergeItemMechanicsBlocks(undefined, undefined), undefined);
});

test("mergeItemMechanicsBlocks: existing only returns existing", () => {
  const block = makeMinimalMechanicsBlock();
  assert.deepEqual(mergeItemMechanicsBlocks(block, undefined), block);
});

test("mergeItemMechanicsBlocks: incoming only returns incoming", () => {
  const block = makeMinimalMechanicsBlock();
  assert.deepEqual(mergeItemMechanicsBlocks(undefined, block), block);
});

// ---------------------------------------------------------------------------
// mergeItemMechanicsBlocks: quality-aware selection
// ---------------------------------------------------------------------------

test("mergeItemMechanicsBlocks: incoming with more mechanics wins", () => {
  const weak = makeMinimalMechanicsBlock({
    mechanics: [],
    review: { reviewStatus: "supported", confidence: "low" },
  });
  const rich = makeMinimalMechanicsBlock({
    mechanics: [
      { schemaVersion: "v1", mechanicId: "m-1", kind: "passive", name: "Bonus", sourceType: "item",
        review: { reviewStatus: "supported", confidence: "high" },
        passive: { passiveType: "condition_immunity", condition: "frightened" } },
    ],
    review: { reviewStatus: "supported", confidence: "high" },
  });

  const merged = mergeItemMechanicsBlocks(weak, rich);
  assert.ok(merged, "Result must not be undefined");
  assert.equal(merged!.mechanics.length, 1, "Should preserve rich block's mechanics");
});

test("mergeItemMechanicsBlocks: existing richer block wins over incoming weaker", () => {
  const richExisting = makeMinimalMechanicsBlock({
    mechanics: [
      { schemaVersion: "v1", mechanicId: "m-1", kind: "passive", name: "AC Bonus", sourceType: "item",
        review: { reviewStatus: "supported", confidence: "high" },
        passive: { passiveType: "condition_immunity", condition: "frightened" } },
      { schemaVersion: "v1", mechanicId: "m-2", kind: "passive", name: "Resist", sourceType: "item",
        review: { reviewStatus: "supported", confidence: "high" },
        passive: { passiveType: "condition_immunity", condition: "paralyzed" } },
    ],
    review: { reviewStatus: "supported", confidence: "high" },
  });
  const thinIncoming = makeMinimalMechanicsBlock({
    mechanics: [],
    review: { reviewStatus: "needs_review", confidence: "low" },
    unresolvedSegments: [{ rawText: "unknown segment", reason: "missing_required_detail" }],
  });

  const merged = mergeItemMechanicsBlocks(richExisting, thinIncoming);
  assert.ok(merged, "Result must not be undefined");
  assert.equal(merged!.mechanics.length, 2, "Should keep richer existing mechanics");
});

// ---------------------------------------------------------------------------
// mergeItemMechanicsBlocks: unresolvedSegments union
// ---------------------------------------------------------------------------

test("mergeItemMechanicsBlocks: unresolvedSegments from both sides are unioned", () => {
  const blockA = makeMinimalMechanicsBlock({
    unresolvedSegments: [{ rawText: "issue A", reason: "missing_required_detail" }],
    review: { reviewStatus: "supported", confidence: "high" },
  });
  const blockB = makeMinimalMechanicsBlock({
    unresolvedSegments: [{ rawText: "issue B", reason: "missing_required_detail" }],
    review: { reviewStatus: "supported", confidence: "high" },
  });

  const merged = mergeItemMechanicsBlocks(blockA, blockB);
  assert.ok(merged, "Result must not be undefined");
  assert.equal(merged!.unresolvedSegments?.length ?? 0, 2, "Both unresolved segments should be present");
});

// ---------------------------------------------------------------------------
// Round-trip: legacyItemToItemMechanicsBlock → itemMechanicsBlockToLegacyCompatibility
// ---------------------------------------------------------------------------

test("Round-trip: attack_damage effect survives legacyItemToItemMechanicsBlock → itemMechanicsBlockToLegacyCompatibility", () => {
  const effect = makeAttackDamageEffect({ attackDamageDice: "1d6", attackDamageType: "fire", attackDamageBonus: 3 });
  const block = legacyItemToItemMechanicsBlock({
    name: "Flame Dagger",
    equippedEffects: [effect],
  });

  // Action mechanics with damageParts come back as AdditionalDamage, not equippedEffects.
  // That is the expected round-trip behavior for attack_damage effects.
  const roundTripped = itemMechanicsBlockToLegacyCompatibility(block);
  const attackEntry = roundTripped.additionalDamage?.[0];
  assert.ok(attackEntry, "attack damage info must survive the round-trip as additionalDamage");
  assert.equal(attackEntry?.dice, "1d6");
  assert.equal(attackEntry?.damageType, "fire");
  assert.equal(attackEntry?.damageModifier, 3);
});

test("projectRuntimeItemCompatibility: preserves explicit useAbilityModifierForDamage=false", () => {
  const projected = projectRuntimeItemCompatibility({
    id: "weapon-1",
    name: "Greatclub",
    useAbilityModifierForDamage: false,
    damageDice: "1d8",
    damageType: "bludgeoning",
  });

  assert.equal(projected.compatibility.useAbilityModifierForDamage, false);
});
