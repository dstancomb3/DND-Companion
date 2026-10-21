export interface LocalResolvedHpMutationInput {
  prevHp: number;
  maxHp: number;
  prevTempHp: number;
  requestedHpDamage: number;
  requestedHpHealing: number;
  requestedTempAbsorbed: number;
}

export interface LocalResolvedHpMutationResult {
  nextHp: number;
  nextTempHp: number;
  actualHpDamage: number;
  actualHpHealing: number;
  actualTempAbsorbed: number;
  changed: boolean;
}

function toSafeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function applyLocalResolvedHpMutation(input: LocalResolvedHpMutationInput): LocalResolvedHpMutationResult {
  const prevHp = toSafeInt(input.prevHp);
  const maxHp = toSafeInt(input.maxHp);
  const prevTempHp = toSafeInt(input.prevTempHp);
  const requestedHpDamage = toSafeInt(input.requestedHpDamage);
  const requestedHpHealing = toSafeInt(input.requestedHpHealing);
  const requestedTempAbsorbed = toSafeInt(input.requestedTempAbsorbed);

  const actualTempAbsorbed = Math.min(prevTempHp, requestedTempAbsorbed);
  const nextTempHp = prevTempHp - actualTempAbsorbed;

  const hpAfterDamage = Math.max(0, prevHp - requestedHpDamage);
  const actualHpDamage = prevHp - hpAfterDamage;

  const nextHp = Math.min(maxHp, Math.max(0, hpAfterDamage + requestedHpHealing));
  const actualHpHealing = nextHp - hpAfterDamage;

  return {
    nextHp,
    nextTempHp,
    actualHpDamage,
    actualHpHealing,
    actualTempAbsorbed,
    changed: actualHpDamage > 0 || actualHpHealing > 0 || actualTempAbsorbed > 0,
  };
}
