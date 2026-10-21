import type { AdditionalDamage } from "@/types";

function normalizeConditionName(value: string): string {
  return value.trim().toLowerCase();
}

export function shouldApplyConditionalAdditionalDamage(input: {
  damage: AdditionalDamage;
  selectedTargetIds: string[];
  targetConditionsById: Record<string, string[]>;
}): boolean {
  const { damage, selectedTargetIds, targetConditionsById } = input;

  if (damage.triggerType !== "vs_condition" || !damage.triggerCondition) {
    return true;
  }

  // Bounded and conservative: only apply conditional extras for a single, explicit target.
  if (selectedTargetIds.length !== 1) {
    return false;
  }

  const targetId = selectedTargetIds[0];
  const targetConditions = targetConditionsById[targetId] ?? [];
  const expectedCondition = normalizeConditionName(damage.triggerCondition);

  return targetConditions.some((condition) => normalizeConditionName(condition) === expectedCondition);
}
