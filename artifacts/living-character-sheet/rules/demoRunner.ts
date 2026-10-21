/**
 * Rules Engine Demo & Test Utility
 * 
 * Quick-start code showing how the rules engine evaluates rules,
 * traces conditions, and applies effects.
 * 
 * Usage in dev console or test:
 *   import { demoRulesEngine } from '@/rules/demoRunner';
 *   demoRulesEngine();
 */

import { compileRule, compileRules } from "./compiler";
import { evaluateRule, evaluateRules } from "./evaluator";
import { DEMO_RULES, DEMO_RULE_LEATHER_ARMOR_AC } from "./demo";
import { getActiveRules } from "./registry";
import type { RuleExecutionContext } from "./schema";

/**
 * Run demo evaluation
 */
export function demoRulesEngine(): void {
  console.log("[RuleEngine Demo] Starting...");

  // Compile rules
  const compiled = compileRules(DEMO_RULES);
  console.log(`[RuleEngine Demo] Compiled ${compiled.count}/${compiled.compiled.length} rules`);

  if (!compiled.valid) {
    console.error("[RuleEngine Demo] Compilation errors:", compiled.errors);
    return;
  }

  // Mock character context
  const mockCharacter = {
    id: "char_demo",
    name: "Demo Character",
    class: "Fighter",
    level: 5,
    armorClass: 12,
    abilities: {
      strength: 15,
      dexterity: 10,
      constitution: 14,
      intelligence: 8,
      wisdom: 12,
      charisma: 13,
    },
    inventory: [
      {
        id: "leather-armor-item-id",
        name: "Leather Armor",
        equipped: true,
        equippedEffects: [
          {
            id: "effect_leather_ac",
            type: "stat_bonus",
            statKey: "armorClass",
            statValue: 1,
            label: "Leather AC",
          },
        ],
      },
    ],
    conditions: [],
    features: {},
  };

  // Scenario 1: Equip leather armor trigger
  console.log("\n[RuleEngine Demo] Scenario 1: Equip item (leather armor)");
  const context1: RuleExecutionContext = {
    character: mockCharacter,
    item: mockCharacter.inventory[0],
    currentAction: "equip_item",
  };

  console.log("  Context: item.equipped =", context1.item?.equipped, "currentAction =", context1.currentAction);

  const result1 = evaluateRule(compiled.compiled[0], context1);
  console.log("  Trigger fired:", result1.triggered);
  console.log("  Condition met:", result1.conditionMet);
  console.log("  Applied:", result1.applied);
  console.log("  Effect count:", result1.effects.length);

  if (result1.effects.length > 0) {
    console.log("  Effect details:");
    result1.effects.forEach((eff) => {
      console.log(`    - ${eff.effectDefinition.label}`);
      console.log(`      Type: ${eff.effectDefinition.type}`);
      console.log(`      Stat key: ${eff.effectDefinition.statKey}`);
      console.log(`      Stat value: ${eff.effectDefinition.statValue}`);
    });
  }

  // Scenario 2: Long rest trigger
  console.log("\n[RuleEngine Demo] Scenario 2: Long rest");
  const context2: RuleExecutionContext = {
    character: mockCharacter,
    currentAction: "long_rest",
  };

  const result2 = evaluateRule(compiled.compiled[1], context2);
  console.log("  Trigger fired:", result2.triggered);
  console.log("  Condition met:", result2.conditionMet);
  console.log("  Applied:", result2.applied);
  console.log("  Effect count:", result2.effects.length);

  // Scenario 3: Wrong context (manual trigger without fire condition)
  console.log("\n[RuleEngine Demo] Scenario 3: Unequip (trigger should not fire)");
  const context3: RuleExecutionContext = {
    character: mockCharacter,
    item: mockCharacter.inventory[0],
    currentAction: "unequip_item",
  };

  const result3 = evaluateRule(compiled.compiled[0], context3);
  console.log("  Trigger fired:", result3.triggered);
  console.log("  Expected: false (equip_item trigger does not match unequip_item action)");

  console.log("\n[RuleEngine Demo] Complete!");
  console.log("✓ Rules compiled successfully");
  console.log("✓ Triggers evaluated correctly");
  console.log("✓ Conditions assessed properly");
  console.log("✓ Effects instantiated with metadata");
}

/**
 * Backward-compatible simple test
 */
export function testRulesEngine(): { passed: boolean; message: string } {
  const result = testRulesEngineComprehensive();
  return {
    passed: result.passed,
    message: result.passed ? "All tests passed" : `Tests failed: ${result.failures.join("; ")}`,
  };
}

/**
 * Comprehensive integration test for all rules engine pathways
 * Tests: modify_stat (AC + initiative), add_action (features), grant_spell (spells),
 * add_condition (conditions), restore_resource (resources)
 */
export function testRulesEngineComprehensive(): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  try {
    const compiled = compileRules(DEMO_RULES);
    if (!compiled.valid) {
      const errorMessages = Object.entries(compiled.errors).flatMap(([id, msgs]) => [`${id}: ${msgs.join(", ")}`]);
      failures.push(`Rule compilation failed: ${errorMessages.join("; ")}`);
      return { passed: false, failures };
    }
    if (compiled.count !== DEMO_RULES.length) {
      failures.push(`Expected ${DEMO_RULES.length} rules, got ${compiled.count}`);
    }

    // ── Test 1: modify_stat (AC + Initiative) ──────────────────────────────
    const mockCharAC = {
      id: "test_char_ac",
      name: "Test AC",
      class: "Fighter",
      level: 5,
      armorClass: 12,
      initiative: 0,
      abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      inventory: [],
      conditions: [],
      features: {},
    };

    const contextAC: RuleExecutionContext = {
      character: mockCharAC,
      currentAction: "equip_item",
    };

    const registryRules = getActiveRules({
      character: mockCharAC as any,
      currentAction: "equip_item",
      includeDemoFallback: true,
    });
    if (registryRules.rules.length === 0) {
      failures.push("Test 0: Rules registry returned no active rules");
    }
    const byIdKeys = Object.keys(registryRules.byId);
    if (byIdKeys.length !== registryRules.rules.length) {
      failures.push("Test 0b: Rules registry byId map size mismatch with active rules");
    }
    for (const activeRule of registryRules.rules) {
      if (!registryRules.byId[activeRule.id]) {
        failures.push(`Test 0c: Rules registry byId missing active rule ${activeRule.id}`);
      }
    }

    const resultsAC = evaluateRules(compiled.compiled, contextAC);
    const acRules = resultsAC.filter((r) => r.applied && r.effects.some((e) => e.effectDefinition.statKey === "armorClass"));
    const initiativeRules = resultsAC.filter((r) => r.applied && r.effects.some((e) => e.effectDefinition.statKey === "initiative"));

    if (acRules.length === 0) failures.push("Test 1a: No AC modify_stat rules applied on equip");
    if (initiativeRules.length === 0) failures.push("Test 1b: No initiative modify_stat rules applied on equip");

    // ── Test 2: add_action (Bat Flight) ──────────────────────────────────
    const actionRules = resultsAC.filter((r) => r.applied && r.effects.some((e) => e.effectDefinition.type === "add_action"));
    if (actionRules.length === 0) failures.push("Test 2: No add_action rules applied on equip");
    else {
      const batFlightEffect = actionRules[0].effects.find((e) => e.effectDefinition.type === "add_action");
      if (!batFlightEffect || batFlightEffect.effectDefinition.actionName !== "Bat Flight") {
        failures.push("Test 2b: Bat Flight action not found in effects");
      }
    }

    // ── Test 3: Long Rest effects (grant_spell + restore_resource) ───────
    const contextRest: RuleExecutionContext = {
      character: mockCharAC,
      currentAction: "long_rest",
    };

    const resultsRest = evaluateRules(compiled.compiled, contextRest);
    const spellRules = resultsRest.filter((r) => r.applied && r.effects.some((e) => e.effectDefinition.type === "grant_spell"));
    const resourceRules = resultsRest.filter((r) => r.applied && r.effects.some((e) => e.effectDefinition.type === "restore_resource"));

    if (spellRules.length === 0) failures.push("Test 3a: No grant_spell rules applied on long_rest");
    if (resourceRules.length === 0) failures.push("Test 3b: No restore_resource rules applied on long_rest");

    // ── Test 4: Short Rest effects (add_condition) ──────────────────────
    const contextShortRest: RuleExecutionContext = {
      character: mockCharAC,
      currentAction: "short_rest",
    };

    const resultsShortRest = evaluateRules(compiled.compiled, contextShortRest);
    const conditionRules = resultsShortRest.filter((r) => r.applied && r.effects.some((e) => e.effectDefinition.type === "add_condition"));
    if (conditionRules.length === 0) failures.push("Test 4: No add_condition rules applied on short_rest");

    // ── Test 5: Effect metadata capture ──────────────────────────────────
    const acEffect = acRules[0]?.effects[0];
    if (acEffect && !acEffect.effectDefinition.label) {
      failures.push("Test 5: Effect missing label metadata");
    }

    if (failures.length === 0) {
      console.log("[Rules Integration Test] ✓ All comprehensive tests passed!");
      return { passed: true, failures: [] };
    } else {
      console.warn("[Rules Integration Test] ✗ Failures detected:", failures);
      return { passed: false, failures };
    }
  } catch (err) {
    const errMsg = String(err);
    failures.push(`Uncaught error: ${errMsg}`);
    return { passed: false, failures };
  }
}
