import assert from "node:assert/strict";
import test from "node:test";

import { buildWeaponAttackProfile } from "../../utils/combat/weaponAttackProfile.ts";

test("weapon profile scales attack bonus with ability and proficiency", () => {
  const profile = buildWeaponAttackProfile({
    abilityScore: 18,
    proficiencyBonus: 4,
    isProficient: true,
    weaponDamageBonus: 1,
  });

  assert.equal(profile.abilityModifier, 4);
  assert.equal(profile.attackBonus, 8);
  assert.equal(profile.damageModifier, 5);
});

test("weapon profile excludes proficiency when not proficient but still applies ability damage", () => {
  const profile = buildWeaponAttackProfile({
    abilityScore: 14,
    proficiencyBonus: 3,
    isProficient: false,
    weaponDamageBonus: 0,
  });

  assert.equal(profile.attackBonus, 2);
  assert.equal(profile.damageModifier, 2);
});

test("weapon profile supports explicit no-ability-damage mode for unsupported edge rules", () => {
  const profile = buildWeaponAttackProfile({
    abilityScore: 20,
    proficiencyBonus: 6,
    isProficient: true,
    weaponDamageBonus: 2,
    includeAbilityModifierInDamage: false,
  });

  assert.equal(profile.attackBonus, 11);
  assert.equal(profile.damageModifier, 2);
});
