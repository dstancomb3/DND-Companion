import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDeclaredSpellSummary,
  formatSpellCastEventMessage,
} from "../../utils/combat/spellMetadataPresentation.ts";

test("formats spell cast event message with cantrip level label", () => {
  const result = formatSpellCastEventMessage("Fire Bolt", 0);
  assert.equal(result, "Cast spell: Fire Bolt (cantrip)");
});

test("formats spell cast event message with leveled spell label", () => {
  const result = formatSpellCastEventMessage("Fireball", 3);
  assert.equal(result, "Cast spell: Fireball (level 3)");
});

test("returns null when no declared save, damage, or limitations exist", () => {
  const result = formatDeclaredSpellSummary({
    declared: { spellLevel: 1 },
    resolutionLimitations: [],
  });
  assert.equal(result, null);
});

test("formats declared save, packets, and limitations", () => {
  const result = formatDeclaredSpellSummary({
    declared: {
      spellLevel: 3,
      save: {
        saveAbility: "dex",
        dc: 14,
        onSave: "half",
        targetRolls: {
          goblin_1: 12,
          goblin_2: 17,
        },
      },
      damagePackets: [
        {
          sourceLabel: "spell_text_fixed_damage",
          rawAmount: 8,
          damageType: "fire",
        },
      ],
    },
    resolutionLimitations: ["Spell attack roll is not declared in this flow."],
  });

  assert.match(result ?? "", /Save DEX DC 14 \(half on save\)/);
  assert.match(result ?? "", /Target save rolls 2 \(goblin_1: 12, goblin_2: 17\)/);
  assert.match(result ?? "", /Damage packets 1/);
  assert.match(result ?? "", /Limitations: Spell attack roll is not declared in this flow\./);
});

test("formats declared target save rolls with overflow preview", () => {
  const result = formatDeclaredSpellSummary({
    declared: {
      spellLevel: 3,
      save: {
        saveAbility: "wis",
        dc: 15,
        targetRolls: {
          a: 10,
          b: 11,
          c: 12,
          d: 13,
        },
      },
    },
    resolutionLimitations: [],
  });

  assert.match(result ?? "", /Target save rolls 4 \(a: 10, b: 11, c: 12 \(\+1 more\)\)/);
});

test("uses target names in declared save roll preview when provided", () => {
  const result = formatDeclaredSpellSummary({
    declared: {
      spellLevel: 3,
      save: {
        saveAbility: "wis",
        dc: 15,
        targetRolls: {
          npc_1: 11,
          npc_2: 18,
        },
      },
    },
    resolutionLimitations: [],
    targetNameById: {
      npc_1: "Goblin Scout",
      npc_2: "Goblin Boss",
    },
  });

  assert.match(result ?? "", /Target save rolls 2 \(Goblin Scout: 11, Goblin Boss: 18\)/);
});

test("orders target save roll preview by selected target order", () => {
  const result = formatDeclaredSpellSummary({
    declared: {
      spellLevel: 3,
      save: {
        saveAbility: "wis",
        dc: 15,
        targetRolls: {
          t3: 8,
          t1: 12,
          t2: 14,
        },
      },
    },
    resolutionLimitations: [],
    targetNameById: {
      t1: "Alpha",
      t2: "Bravo",
      t3: "Charlie",
    },
    targetOrderIds: ["t2", "t1", "t3"],
  });

  assert.match(result ?? "", /Target save rolls 3 \(Bravo: 14, Alpha: 12, Charlie: 8\)/);
});

test("formats spell attack details in declared summary", () => {
  const result = formatDeclaredSpellSummary({
    declared: {
      spellLevel: 0,
      attackRoll: 22,
    },
    resolutionLimitations: [],
    spellAttack: {
      detected: true,
      attackBonus: 7,
      declaredAttackRoll: 22,
      declaredCritical: true,
    },
  });

  assert.match(result ?? "", /Spell attack \(bonus \+7, declared roll 22, critical\)/);
});

test("formats spell attack section when only detection and bonus exist", () => {
  const result = formatDeclaredSpellSummary({
    declared: {
      spellLevel: 1,
    },
    resolutionLimitations: [],
    spellAttack: {
      detected: true,
      attackBonus: 5,
    },
  });

  assert.match(result ?? "", /Spell attack \(bonus \+5\)/);
});

test("formats structured spell metadata lines for mode, scope, scaling, and dice model", () => {
  const result = formatDeclaredSpellSummary({
    declared: {
      spellLevel: 5,
      spell: {
        mode: "save",
        targetScopeHint: "area",
        damageModel: "dice",
        scaling: {
          supported: true,
          source: "name_rule",
          baseLevel: 3,
          castLevel: 5,
          levelsAboveBase: 2,
          summary: "Applied explicit add_dice_per_level upcast scaling (+2 x 1d6).",
        },
      },
      save: {
        saveAbility: "dex",
        dc: 15,
        onSave: "half",
      },
      damagePackets: [
        {
          rawAmount: 28,
          damageType: "fire",
          resolutionModel: "dice_average",
          diceExpression: "8d6",
        },
      ],
    },
    resolutionLimitations: [],
  });

  assert.match(result ?? "", /Spell mode save/);
  assert.match(result ?? "", /Target scope area/);
  assert.match(result ?? "", /Damage model dice/);
  assert.match(result ?? "", /Dice damage 1 \(8d6 fire\)/);
  assert.match(result ?? "", /Upcast \+2 levels: supported \(name_rule\)/);
});

test("formats declared condition effect preview lines", () => {
  const result = formatDeclaredSpellSummary({
    declared: {
      spellLevel: 2,
      spell: {
        mode: "save",
      },
      conditionEffects: [
        {
          effectType: "apply_condition",
          conditionName: "Paralyzed",
          applyWhen: "on_failed_save",
          concentrationLinked: true,
        },
      ],
    },
    resolutionLimitations: [],
  });

  assert.match(result ?? "", /Condition effects 1 \(Paralyzed \(on failed save, concentration\)\)/);
});
