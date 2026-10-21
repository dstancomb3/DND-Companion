import assert from "node:assert/strict";
import test from "node:test";

import type { Character, CharacterSnapshot } from "../../types/index.ts";
import { getClassProgression } from "../../rules/engine.ts";
import { auditLevelUp } from "../../data/progression/engine.ts";
import { getActiveRules } from "../../rules/registry.ts";
import {
  assemblePortableCharacterSnapshot,
  normalizeCharacterSnapshotMechanics,
} from "../../utils/mechanics/characterSnapshotMechanicsAdapters.ts";

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "char-1",
    name: "Test Character",
    class: "Monk",
    subclass: "",
    level: 1,
    race: "Human",
    background: "Soldier",
    proficiencyBonus: 2,
    armorClass: 15,
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    speed: 30,
    initiative: 2,
    abilityScores: {
      strength: 10,
      dexterity: 14,
      constitution: 12,
      intelligence: 10,
      wisdom: 14,
      charisma: 8,
    },
    savingThrows: [],
    skills: [],
    passivePerception: 12,
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    notes: "",
    ...overrides,
  };
}

function makeSnapshot(characterOverrides: Partial<Character> = {}): CharacterSnapshot {
  return {
    _version: 1,
    character: makeCharacter(characterOverrides),
    attacks: [],
    resources: [],
    inventory: [],
    conditions: [],
    notes: [],
  };
}

test("rules engine progression derives action unlocks for active features", () => {
  const progression = getClassProgression(makeCharacter({ class: "Fighter", level: 2 }));
  const actionNames = progression.actions.map((a) => a.name.toLowerCase());

  assert.ok(actionNames.includes("second wind"), "Second Wind should be surfaced as an action unlock");
});

test("rules engine progression derives key class resources", () => {
  const monk = getClassProgression(makeCharacter({ class: "Monk", level: 2 }));
  const fighter = getClassProgression(makeCharacter({ class: "Fighter", level: 17 }));

  const ki = monk.resources.find((r) => r.name === "Ki");
  const actionSurge = fighter.resources.find((r) => r.name === "Action Surge");

  assert.ok(ki, "Ki should be present for monks at level 2+");
  assert.equal(ki?.max, 2);
  assert.ok(actionSurge, "Action Surge resource should be present for fighters");
  assert.equal(actionSurge?.max, 2, "Action Surge should scale to 2 uses at level 17");
});

test("deterministic level-up explicitly guards multiclass labels", () => {
  const audit = auditLevelUp({
    currentLevel: 4,
    charClass: "Fighter/Warlock",
    subclass: "",
    race: "Human",
  });

  assert.equal(audit.supported, false);
  assert.equal(audit.unsupportedReason, "multiclass_unsupported");
  assert.ok(
    audit.summary.toLowerCase().includes("single-class"),
    "Multiclass guardrail summary should explain the limitation"
  );
});

test("rules registry accepts validated homebrew rules and drops invalid entries", () => {
  const validHomebrewRule = {
    id: "hb-rule-1",
    schemaVersion: 1,
    name: "Homebrew AC",
    trigger: { type: "manual" },
    condition: { type: "always" },
    effects: [{ type: "modify_stat", statKey: "armorClass", statValue: 1 }],
  };

  const invalidHomebrewRule = {
    id: "hb-rule-invalid",
    schemaVersion: 1,
    name: "Broken Rule",
    trigger: { type: "manual" },
    condition: { type: "always" },
    effects: [{ type: "modify_stat", statKey: "armorClass" }],
  };

  const result = getActiveRules({
    character: makeCharacter({
      homebrewRules: [validHomebrewRule, invalidHomebrewRule],
    }),
    currentAction: "manual",
    includeDemoFallback: false,
  });

  assert.equal(result.rules.length, 1);
  assert.equal(result.rules[0].id, "hb-rule-1");
  assert.ok(result.byId["hb-rule-1"]);
});

test("character snapshot portability preserves progression-sensitive defenses", () => {
  const input = makeSnapshot({
    damageResistances: ["Fire", "Cold"],
    damageImmunities: ["Poison"],
    conditionImmunities: ["Poisoned"],
  });

  const normalized = normalizeCharacterSnapshotMechanics(input);
  const portable = assemblePortableCharacterSnapshot(normalized);

  assert.deepEqual(portable.character.damageResistances, ["Fire", "Cold"]);
  assert.deepEqual(portable.character.damageImmunities, ["Poison"]);
  assert.deepEqual(portable.character.conditionImmunities, ["Poisoned"]);
});
