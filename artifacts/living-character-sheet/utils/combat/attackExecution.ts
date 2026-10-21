import type { Attack } from "@/types";
import type { DamagePacketInput } from "@/types/combatOutcome";
import { shouldApplyConditionalAdditionalDamage } from "@/utils/combat/conditionalAttackDamage";

interface BuildAttackDamagePacketsInput {
  attack: Attack;
  parsedDamageRolls: number[];
  selectedTargetIds: string[];
  targetConditionsById: Record<string, string[]>;
}

export function buildAttackDamagePackets({
  attack,
  parsedDamageRolls,
  selectedTargetIds,
  targetConditionsById,
}: BuildAttackDamagePacketsInput): DamagePacketInput[] {
  const packets: DamagePacketInput[] = [];
  const primaryRoll = parsedDamageRolls[0];
  const extras = attack.additionalDamage ?? [];

  if (!Number.isNaN(primaryRoll)) {
    packets.push({
      sourceLabel: attack.name,
      rawAmount: Math.max(0, primaryRoll + attack.damageModifier),
      damageType: attack.damageType,
      criticalEligible: true,
    });
  }

  for (let index = 0; index < extras.length; index += 1) {
    const parsed = parsedDamageRolls[index + 1];
    if (Number.isNaN(parsed)) {
      continue;
    }
    const extra = extras[index];
    if (!shouldApplyConditionalAdditionalDamage({
      damage: extra,
      selectedTargetIds,
      targetConditionsById,
    })) {
      continue;
    }
    packets.push({
      sourceLabel: extra.sourceLabel ?? `${attack.name} extra ${index + 1}`,
      rawAmount: Math.max(0, parsed + (extra.damageModifier ?? 0)),
      damageType: extra.damageType,
      criticalEligible: true,
    });
  }

  return packets;
}
