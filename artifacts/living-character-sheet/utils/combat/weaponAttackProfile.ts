export interface WeaponAttackProfileInput {
  abilityScore: number;
  proficiencyBonus: number;
  isProficient: boolean;
  weaponDamageBonus?: number;
  includeAbilityModifierInDamage?: boolean;
}

export interface WeaponAttackProfile {
  abilityModifier: number;
  attackBonus: number;
  damageModifier: number;
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function buildWeaponAttackProfile(input: WeaponAttackProfileInput): WeaponAttackProfile {
  const abilityMod = abilityModifier(input.abilityScore);
  const attackBonus = abilityMod + (input.isProficient ? input.proficiencyBonus : 0);
  const baseDamageBonus = input.weaponDamageBonus ?? 0;
  const includeAbility = input.includeAbilityModifierInDamage !== false;

  return {
    abilityModifier: abilityMod,
    attackBonus,
    damageModifier: baseDamageBonus + (includeAbility ? abilityMod : 0),
  };
}
