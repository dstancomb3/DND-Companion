/**
 * Rule Compiler & Validator
 * 
 * Validates rule definitions and produces CompiledRule or error list.
 */

import {
  RuleDefinition,
  CompiledRule,
  TriggerType,
  ConditionType,
  EffectType,
  StatKey,
  EffectDefinition,
} from "./schema";

const VALID_TRIGGER_TYPES: TriggerType[] = [
  "manual",
  "long_rest",
  "short_rest",
  "equip_item",
  "unequip_item",
  "turn_start",
  "turn_end",
];

const VALID_CONDITION_TYPES: ConditionType[] = [
  "always",
  "has_class",
  "has_subclass",
  "level_minimum",
  "item_equipped",
  "has_condition",
  "feature_enabled",
  "expression",
];

const VALID_EFFECT_TYPES: EffectType[] = [
  "modify_stat",
  "add_action",
  "remove_action",
  "consume_resource",
  "restore_resource",
  "add_condition",
  "remove_condition",
  "grant_spell",
  "revoke_spell",
];

const VALID_STAT_KEYS: StatKey[] = [
  "armorClass",
  "initiative",
  "speed",
  "proficiencyBonus",
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
  "maxHp",
  "tempHpMax",
];

/**
 * Validate a rule definition
 * Returns list of validation errors (empty = valid)
 */
export function validateRule(rule: Partial<RuleDefinition>): string[] {
  const errors: string[] = [];

  // Basic structure
  if (!rule.id) {
    errors.push("Rule must have id");
  }
  if (!rule.name) {
    errors.push("Rule must have name");
  }
  if (!rule.trigger) {
    errors.push("Rule must have trigger");
  }
  if (!rule.condition) {
    errors.push("Rule must have condition");
  }
  if (!rule.effects || rule.effects.length === 0) {
    errors.push("Rule must have at least one effect");
  }

  // Trigger validation
  if (rule.trigger) {
    if (!VALID_TRIGGER_TYPES.includes(rule.trigger.type)) {
      errors.push(`Invalid trigger type: ${rule.trigger.type}`);
    }
    // itemId is optional for equip/unequip triggers; when omitted, trigger applies to any item.
  }

  // Condition validation
  if (rule.condition) {
    if (!VALID_CONDITION_TYPES.includes(rule.condition.type)) {
      errors.push(`Invalid condition type: ${rule.condition.type}`);
    }
    if (rule.condition.type === "level_minimum" && typeof rule.condition.minLevel !== "number") {
      errors.push("level_minimum condition requires minLevel");
    }
  }

  // Effect validation
  if (rule.effects) {
    rule.effects.forEach((effect, idx) => {
      const effectErrors = validateEffect(effect);
      effectErrors.forEach((err) => {
        errors.push(`Effect ${idx}: ${err}`);
      });
    });
  }

  return errors;
}

/**
 * Validate a single effect definition
 */
export function validateEffect(effect: EffectDefinition): string[] {
  const errors: string[] = [];

  if (!VALID_EFFECT_TYPES.includes(effect.type)) {
    errors.push(`Invalid effect type: ${effect.type}`);
  }

  switch (effect.type) {
    case "modify_stat":
      if (!effect.statKey || !VALID_STAT_KEYS.includes(effect.statKey)) {
        errors.push(`modify_stat requires valid statKey`);
      }
      if (typeof effect.statValue !== "number" && typeof effect.replacementValue !== "number") {
        errors.push(`modify_stat requires statValue or replacementValue`);
      }
      break;

    case "add_action":
    case "remove_action":
      if (!effect.actionName) {
        errors.push(`${effect.type} requires actionName`);
      }
      break;

    case "consume_resource":
    case "restore_resource":
      if (!effect.resourceId && !effect.resourceName) {
        errors.push(`${effect.type} requires resourceId or resourceName`);
      }
      if (typeof effect.amount !== "number") {
        errors.push(`${effect.type} requires amount`);
      }
      break;

    case "add_condition":
      if (!effect.conditionName) {
        errors.push("add_condition requires conditionName");
      }
      break;

    case "remove_condition":
      if (!effect.conditionName) {
        errors.push("remove_condition requires conditionName");
      }
      break;

    case "grant_spell":
    case "revoke_spell":
      if (!effect.spellId && !effect.spellName) {
        errors.push(`${effect.type} requires spellId or spellName`);
      }
      break;
  }

  return errors;
}

/**
 * Compile a rule definition
 * Returns CompiledRule if valid, else null + errors
 */
export function compileRule(definition: RuleDefinition): { valid: boolean; errors: string[]; compiled?: CompiledRule } {
  const errors = validateRule(definition);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const compiled: CompiledRule = {
    ...definition,
    _compiled: true,
    _errors: [],
  };

  return { valid: true, errors: [], compiled };
}

/**
 * Batch compile multiple rules
 */
export function compileRules(definitions: RuleDefinition[]): {
  valid: boolean;
  count: number;
  compiled: CompiledRule[];
  errors: Record<string, string[]>;
} {
  const compiled: CompiledRule[] = [];
  const errors: Record<string, string[]> = {};
  let validCount = 0;

  definitions.forEach((def) => {
    const result = compileRule(def);
    if (result.valid && result.compiled) {
      compiled.push(result.compiled);
      validCount++;
    } else {
      errors[def.id] = result.errors;
    }
  });

  return {
    valid: validCount === definitions.length,
    count: validCount,
    compiled,
    errors,
  };
}

/**
 * Create a CompiledRule from partial definition (with defaults)
 */
export function createCompiledRule(partial: Partial<RuleDefinition>): { valid: boolean; errors: string[]; compiled?: CompiledRule } {
  const full: RuleDefinition = {
    id: partial.id || `rule_${Date.now()}`,
    schemaVersion: 1,
    name: partial.name || "Unnamed Rule",
    description: partial.description,
    trigger: partial.trigger || { type: "manual" },
    condition: partial.condition || { type: "always" },
    effects: partial.effects || [],
    source: partial.source || "manual",
    sourceId: partial.sourceId,
    scope: partial.scope || "character",
    priority: partial.priority || 0,
    repeatable: partial.repeatable !== false,
    createdAt: Date.now(),
    disabled: false,
  };

  return compileRule(full);
}
