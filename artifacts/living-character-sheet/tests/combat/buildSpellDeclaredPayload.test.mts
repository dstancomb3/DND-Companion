import assert from "node:assert/strict";
import test from "node:test";

import { buildSpellDeclaredPayload } from "../../utils/combat/buildSpellDeclaredPayload.ts";

const baseSpell = {
  id: "spell-1",
  name: "Ray of Frost",
  level: 0,
  school: "Evocation",
  castingTime: "1 action",
  range: "60 feet",
  duration: "Instantaneous",
  concentration: false,
  ritual: false,
  description: "A frigid beam strikes a creature. Make a ranged spell attack; on a hit: 1d8 cold damage.",
  prepared: true,
};

test("builds structured attack declaration with dice damage and explicit limitation when attack roll is missing", () => {
  const result = buildSpellDeclaredPayload({
    spell: baseSpell,
    characterClass: "Wizard",
    proficiencyBonus: 2,
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 16,
      wisdom: 10,
      charisma: 10,
    },
    castAtLevel: 0,
  });

  assert.equal(result.spellAttack.detected, true);
  assert.equal(result.spellAttack.attackBonus, 5);
  assert.equal(result.declared.attackRoll, undefined);
  assert.equal(result.requiresResolution, true);
  assert.equal(result.declared.spell?.mode, "attack");
  assert.equal(result.declared.spell?.targetScopeHint, "single");
  assert.equal(result.declared.spell?.damageModel, "dice");
  assert.equal(result.declared.damagePackets?.length, 1);
  assert.equal(result.declared.damagePackets?.[0]?.diceExpression, "1d8");
  assert.equal(result.declared.damagePackets?.[0]?.resolutionModel, "dice_average");
  assert.match(
    result.resolutionLimitations.join("\n"),
    /Spell uses a spell attack roll, but no declared roll input exists in current cast flow \(suggested bonus \+5\)\./,
  );
  assert.match(
    result.resolutionLimitations.join("\n"),
    /Spell damage dice were interpreted using deterministic average values/,
  );
});

test("declares spell attack roll when provided", () => {
  const result = buildSpellDeclaredPayload({
    spell: baseSpell,
    characterClass: "Wizard",
    proficiencyBonus: 3,
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
    },
    castAtLevel: 0,
    attackRollTotal: 24,
    attackRollIsCritical: true,
  });

  assert.equal(result.declared.attackRoll, 24);
  assert.equal(result.requiresResolution, true);
  assert.equal(result.spellAttack.declaredAttackRoll, 24);
  assert.equal(result.spellAttack.declaredCritical, true);
  assert.equal(result.declared.spell?.mode, "attack");
  assert.equal(result.declared.damagePackets?.length, 1);
});

test("builds save-based declaration with area hint and dice damage packets", () => {
  const result = buildSpellDeclaredPayload({
    spell: {
      ...baseSpell,
      name: "Fireball",
      level: 3,
      range: "150 feet",
      description: "A bright streak of flame explodes into a 20-ft-radius sphere within 150 ft. Creatures in the area take 8d6 fire damage (Dex save for half).",
    },
    characterClass: "Wizard",
    proficiencyBonus: 3,
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
    },
    castAtLevel: 3,
  });

  assert.equal(result.declared.spell?.mode, "save");
  assert.equal(result.declared.spell?.targetScopeHint, "area");
  assert.equal(result.declared.save?.saveAbility, "dex");
  assert.equal(result.declared.save?.dc, 15);
  assert.equal(result.declared.save?.onSave, "half");
  assert.equal(result.declared.damagePackets?.length, 1);
  assert.equal(result.declared.damagePackets?.[0]?.diceExpression, "8d6");
});

test("declares structured condition effects for supported concentration spells", () => {
  const result = buildSpellDeclaredPayload({
    spell: {
      ...baseSpell,
      id: "spell-hold-person",
      name: "Hold Person",
      level: 2,
      range: "60 feet",
      duration: "Up to 1 minute",
      concentration: true,
      description: "A humanoid within 60 ft that fails a Wis save is paralyzed for up to 1 minute. It can repeat the save at the end of each of its turns. Concentration.",
    },
    characterClass: "Wizard",
    proficiencyBonus: 3,
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
    },
    castAtLevel: 2,
  });

  assert.equal(result.declared.save?.saveAbility, "wis");
  assert.equal(result.declared.conditionEffects?.length, 1);
  assert.equal(result.declared.conditionEffects?.[0]?.conditionName, "Paralyzed");
  assert.equal(result.declared.conditionEffects?.[0]?.applyWhen, "on_failed_save");
  assert.equal(result.declared.conditionEffects?.[0]?.concentrationLinked, true);
  assert.equal(result.declared.conditionEffects?.[0]?.durationHint?.durationType, "concentration");
});

test("adds explicit limitation when spell condition choice is not declared safely", () => {
  const result = buildSpellDeclaredPayload({
    spell: {
      ...baseSpell,
      id: "spell-blindness",
      name: "Blindness/Deafness",
      level: 2,
      range: "30 feet",
      description: "Choose a creature within 30 ft. On a failed Con save it is blinded or deafened for up to 1 minute. It repeats the save at the end of each of its turns.",
    },
    characterClass: "Wizard",
    proficiencyBonus: 3,
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
    },
    castAtLevel: 2,
  });

  assert.equal(result.declared.conditionEffects?.length ?? 0, 0);
  assert.match(
    result.resolutionLimitations.join("\n"),
    /chosen condition is not declared in the current cast flow/i,
  );
});

test("applies explicit upcast scaling rules for supported spells", () => {
  const result = buildSpellDeclaredPayload({
    spell: {
      ...baseSpell,
      name: "Fireball",
      level: 3,
      range: "150 feet",
      description: "A bright streak of flame explodes into a 20-ft-radius sphere within 150 ft. Creatures in the area take 8d6 fire damage (Dex save for half).",
    },
    characterClass: "Wizard",
    proficiencyBonus: 3,
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
    },
    castAtLevel: 5,
  });

  assert.equal(result.declared.spell?.scaling?.supported, true);
  assert.equal(result.declared.spell?.scaling?.source, "name_rule");
  assert.equal(result.declared.spell?.scaling?.levelsAboveBase, 2);
  assert.equal(result.declared.damagePackets?.length, 3);
  assert.equal(result.declared.damagePackets?.[1]?.scalingSource, "upcast");
  assert.equal(result.declared.damagePackets?.[2]?.diceExpression, "1d6");
});

test("adds honest upcast limitation when no safe scaling rule exists", () => {
  const result = buildSpellDeclaredPayload({
    spell: {
      ...baseSpell,
      name: "Ice Knife",
      level: 1,
      description: "On a hit it deals 1d10 piercing damage; it then explodes and creatures within 5 ft must succeed on a Dex save or take 2d6 cold damage.",
    },
    characterClass: "Wizard",
    proficiencyBonus: 3,
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
    },
    castAtLevel: 3,
  });

  assert.equal(result.declared.spell?.scaling?.supported, false);
  assert.match(
    result.resolutionLimitations.join("\n"),
    /no safe upcast scaling rule is implemented for this spell/i,
  );
});

test("keeps Chromatic Orb upcast partial when chosen damage type is not declared", () => {
  const result = buildSpellDeclaredPayload({
    spell: {
      ...baseSpell,
      name: "Chromatic Orb",
      level: 1,
      range: "90 feet",
      description: "Hurl a sphere of energy at a creature within 90 ft. Choose acid, cold, fire, lightning, poison, or thunder; make a ranged spell attack; on a hit: 3d8 damage of that type.",
    },
    characterClass: "Wizard",
    proficiencyBonus: 3,
    abilityScores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
    },
    castAtLevel: 3,
  });

  assert.equal(result.declared.spell?.scaling?.supported, false);
  assert.equal(result.declared.spell?.scaling?.levelsAboveBase, 2);
  const upcastPackets = (result.declared.damagePackets ?? []).filter((packet) => packet.scalingSource === "upcast");
  assert.equal(upcastPackets.length, 0);
  assert.match(
    result.resolutionLimitations.join("\n"),
    /upcast scaling depends on a chosen damage type, but the chosen type is not declared/i,
  );
});
