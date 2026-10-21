/**
 * Rules Registry
 *
 * Centralized source for active runtime rules.
 * This replaces direct demo imports in runtime flows and provides
 * a stable extension point for class/item/homebrew rule providers.
 */

import type { Character, InventoryItem } from "@/types";
import type { RuleDefinition } from "./schema";
import { compileRule } from "./compiler";
import {
  DEMO_RULES,
  CLASS_RULE_BARBARIAN_RAGE,
  CLASS_RULE_WIZARD_ARCANE_RECOVERY,
  CLASS_RULE_FIGHTER_SECOND_WIND,
  CLASS_RULE_ROGUE_CUNNING_ACTION,
  ITEM_RULE_PLATE_ARMOR_AC,
  ITEM_RULE_BAG_OF_HOLDING_ACTION,
  ITEM_RULE_PLUS_ONE_SWORD,
} from "./demo";

export interface RulesRegistryInput {
  character: Character;
  currentAction: string;
  item?: InventoryItem;
  includeDemoFallback?: boolean;
}

export interface ActiveRuleSet {
  rules: RuleDefinition[];
  byId: Record<string, RuleDefinition>;
}

/**
 * Future provider hooks. They are intentionally empty for now.
 * Keep these as explicit arrays so adding real providers is non-breaking.
 */
function getClassRules(character: Character): RuleDefinition[] {
  const classRuleMap: Record<string, RuleDefinition[]> = {
    Barbarian: [CLASS_RULE_BARBARIAN_RAGE],
    Wizard: [CLASS_RULE_WIZARD_ARCANE_RECOVERY],
    Fighter: [CLASS_RULE_FIGHTER_SECOND_WIND],
    Rogue: [CLASS_RULE_ROGUE_CUNNING_ACTION],
    // Additional classes can be added here
  };

  const rules = classRuleMap[character.class] || [];
  return rules;
}

function getItemRules(_character: Character, item?: InventoryItem): RuleDefinition[] {
  if (!item) return [];

  const itemRuleMap: Record<string, RuleDefinition[]> = {
    "Plate Armor": [ITEM_RULE_PLATE_ARMOR_AC],
    "Bag of Holding": [ITEM_RULE_BAG_OF_HOLDING_ACTION],
    "+1 Sword": [ITEM_RULE_PLUS_ONE_SWORD],
    // Additional items can be added here using pattern matching
  };

  const rules = itemRuleMap[item.name] || [];
  return rules;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuleDefinitionShape(value: unknown): value is RuleDefinition {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.schemaVersion === "number" &&
    isRecord(value.trigger) &&
    isRecord(value.condition) &&
    Array.isArray(value.effects)
  );
}

function getHomebrewRules(character: Character): RuleDefinition[] {
  const rawRules = character.homebrewRules;
  if (!Array.isArray(rawRules) || rawRules.length === 0) return [];

  const validRules: RuleDefinition[] = [];
  for (const raw of rawRules) {
    if (!isRuleDefinitionShape(raw)) continue;
    const compiled = compileRule(raw);
    if (!compiled.valid) continue;
    validRules.push(raw);
  }

  return validRules;
}

function dedupeById(rules: RuleDefinition[]): RuleDefinition[] {
  const seen = new Set<string>();
  const next: RuleDefinition[] = [];
  for (const rule of rules) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    next.push(rule);
  }
  return next;
}

/**
 * Build active rules for runtime execution.
 *
 * Current behavior:
 * - Uses provider stubs (class/item/homebrew) first
 * - Falls back to demo rules by default so current UX remains functional
 */
export function getActiveRules(input: RulesRegistryInput): ActiveRuleSet {
  const includeDemoFallback = input.includeDemoFallback ?? true;

  const providerRules: RuleDefinition[] = [
    ...getClassRules(input.character),
    ...getItemRules(input.character, input.item),
    ...getHomebrewRules(input.character),
  ];

  const combined = providerRules.length > 0 || !includeDemoFallback
    ? providerRules
    : DEMO_RULES;

  const rules = dedupeById(combined).filter((rule) => !rule.disabled);
  const byId = Object.fromEntries(rules.map((rule) => [rule.id, rule])) as Record<string, RuleDefinition>;

  return { rules, byId };
}
