import type { CombatDamageBreakdown, DamagePacketInput, DamagePacketBreakdown } from "@/types/combatOutcome";

export interface ApplyDamagePacketInput {
  packets: DamagePacketInput[];
  isCritical?: boolean;
  currentHp: number;
  tempHp: number;
  damageResistances?: string[];
  damageImmunities?: string[];
  vulnerabilityMultiplier?: number;
}

function normalizeSet(input?: string[]): Set<string> {
  return new Set((input ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function normalizeAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeSignedAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value);
}

export function applyDamagePacket(input: ApplyDamagePacketInput): {
  breakdown: CombatDamageBreakdown;
  nextHp: number;
  nextTempHp: number;
  hpDelta: number;
} {
  const resistances = normalizeSet(input.damageResistances);
  const immunities = normalizeSet(input.damageImmunities);
  const vulnerabilityMultiplier =
    typeof input.vulnerabilityMultiplier === "number" && Number.isFinite(input.vulnerabilityMultiplier) && input.vulnerabilityMultiplier > 1
      ? input.vulnerabilityMultiplier
      : 1;

  const packetBreakdowns: DamagePacketBreakdown[] = [];
  let rawTotal = 0;
  let postCriticalTotal = 0;
  let adjustedDamageTotal = 0;
  let adjustedHealingTotal = 0;

  for (const packet of input.packets) {
    const signedAmount = normalizeSignedAmount(packet.rawAmount);
    const isHealingPacket = signedAmount < 0;
    const rawAmount = Math.abs(signedAmount);
    const postCriticalAmount = packet.criticalEligible && input.isCritical ? rawAmount * 2 : rawAmount;
    const normalizedType = (packet.damageType ?? "").trim().toLowerCase();

    const immune = !isHealingPacket && normalizedType.length > 0 && immunities.has(normalizedType);
    const resisted = !isHealingPacket && !immune && normalizedType.length > 0 && resistances.has(normalizedType);

    let adjustedAmount = postCriticalAmount;
    if (isHealingPacket) {
      adjustedHealingTotal += adjustedAmount;
    } else if (immune) {
      adjustedAmount = 0;
    } else {
      if (resisted) adjustedAmount = Math.floor(adjustedAmount / 2);
      if (vulnerabilityMultiplier > 1) adjustedAmount = Math.floor(adjustedAmount * vulnerabilityMultiplier);
      adjustedDamageTotal += adjustedAmount;
    }

    rawTotal += rawAmount;
    postCriticalTotal += postCriticalAmount;

    packetBreakdowns.push({
      sourceLabel: packet.sourceLabel,
      damageType: packet.damageType,
      rawAmount,
      postCriticalAmount,
      adjustedAmount,
      resisted,
      immune,
    });
  }

  const tempHp = normalizeAmount(input.tempHp);
  const currentHp = normalizeAmount(input.currentHp);
  const tempHpAbsorbed = Math.min(tempHp, adjustedDamageTotal);
  const hpDamage = Math.max(0, adjustedDamageTotal - tempHpAbsorbed);
  const hpHealing = Math.max(0, adjustedHealingTotal);
  const nextTempHp = Math.max(0, tempHp - tempHpAbsorbed);
  const nextHp = Math.max(0, currentHp - hpDamage + hpHealing);

  const breakdown: CombatDamageBreakdown = {
    rawTotal,
    postCriticalTotal,
    adjustedTotal: adjustedDamageTotal,
    vulnerabilityMultiplier,
    tempHpAbsorbed,
    hpDamage,
    hpHealing,
    packets: packetBreakdowns,
  };

  return {
    breakdown,
    nextHp,
    nextTempHp,
    hpDelta: hpHealing - hpDamage,
  };
}
