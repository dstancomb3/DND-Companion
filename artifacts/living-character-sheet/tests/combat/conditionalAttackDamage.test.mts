import assert from "node:assert/strict";
import test from "node:test";

import { shouldApplyConditionalAdditionalDamage } from "../../utils/combat/conditionalAttackDamage.ts";

test("applies unconditional additional damage", () => {
  const applied = shouldApplyConditionalAdditionalDamage({
    damage: {
      dice: "1d4",
      damageType: "radiant",
    },
    selectedTargetIds: ["npc-1"],
    targetConditionsById: {
      "npc-1": [],
    },
  });

  assert.equal(applied, true);
});

test("applies vs_condition additional damage when selected target has condition", () => {
  const applied = shouldApplyConditionalAdditionalDamage({
    damage: {
      dice: "1d6",
      damageType: "poison",
      triggerType: "vs_condition",
      triggerCondition: "Poisoned",
    },
    selectedTargetIds: ["npc-1"],
    targetConditionsById: {
      "npc-1": ["Poisoned", "Prone"],
    },
  });

  assert.equal(applied, true);
});

test("does not apply vs_condition additional damage when selected target lacks condition", () => {
  const applied = shouldApplyConditionalAdditionalDamage({
    damage: {
      dice: "1d6",
      damageType: "poison",
      triggerType: "vs_condition",
      triggerCondition: "Poisoned",
    },
    selectedTargetIds: ["npc-1"],
    targetConditionsById: {
      "npc-1": ["Prone"],
    },
  });

  assert.equal(applied, false);
});

test("does not apply vs_condition additional damage when multiple targets are selected", () => {
  const applied = shouldApplyConditionalAdditionalDamage({
    damage: {
      dice: "1d6",
      damageType: "poison",
      triggerType: "vs_condition",
      triggerCondition: "Poisoned",
    },
    selectedTargetIds: ["npc-1", "npc-2"],
    targetConditionsById: {
      "npc-1": ["Poisoned"],
      "npc-2": ["Poisoned"],
    },
  });

  assert.equal(applied, false);
});
