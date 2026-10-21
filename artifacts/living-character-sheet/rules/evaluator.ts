/**
 * Rule Evaluator
 * 
 * Evaluates compiled rules against execution context.
 * Does NOT mutate state; returns results for caller to apply.
 */

import {
  CompiledRule,
  RuleExecutionContext,
  RuleExecutionResult,
  AppliedEffectInstance,
  ConditionDefinition,
  TriggerDefinition,
} from "./schema";

/**
 * Simple ID generator (no external deps)
 */
function generateId(prefix: string = "id"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Evaluate trigger against context
 */
function evaluateTrigger(trigger: TriggerDefinition, context: RuleExecutionContext): boolean {
  switch (trigger.type) {
    case "manual":
      return true; // Caller explicitly triggered

    case "long_rest":
      // Caller should invoke this on rest action
      return context.currentAction === "long_rest";

    case "short_rest":
      return context.currentAction === "short_rest";

    case "equip_item":
      // When itemId is omitted, trigger applies to any equip event.
      return context.currentAction === "equip_item" && (!trigger.itemId || context.item?.id === trigger.itemId);

    case "unequip_item":
      // When itemId is omitted, trigger applies to any unequip event.
      return context.currentAction === "unequip_item" && (!trigger.itemId || context.item?.id === trigger.itemId);

    case "turn_start":
      return context.currentAction === "turn_start";

    case "turn_end":
      return context.currentAction === "turn_end";

    default:
      return false;
  }
}

/**
 * Evaluate condition against context
 */
function evaluateCondition(condition: ConditionDefinition, context: RuleExecutionContext): { met: boolean; reason?: string } {
  switch (condition.type) {
    case "always":
      return { met: true };

    case "has_class":
      return {
        met: context.character?.class === condition.value,
        reason:
          context.character?.class === condition.value
            ? undefined
            : `Character class ${context.character?.class} does not match ${condition.value}`,
      };

    case "has_subclass":
      return {
        met: context.character?.subclass === condition.value,
        reason:
          context.character?.subclass === condition.value
            ? undefined
            : `Character subclass ${context.character?.subclass} does not match ${condition.value}`,
      };

    case "level_minimum":
      if (!condition.minLevel) {
        return { met: false, reason: "minLevel not set" };
      }
      return {
        met: (context.character?.level ?? 0) >= condition.minLevel,
        reason:
          (context.character?.level ?? 0) >= condition.minLevel
            ? undefined
            : `Character level ${context.character?.level} below minimum ${condition.minLevel}`,
      };

    case "item_equipped":
      // Check if item with matching ID is in inventory and equipped
      const equipped = context.character?.inventory?.some(
        (item: any) => item.id === condition.value && item.equipped
      );
      return {
        met: !!equipped,
        reason: equipped ? undefined : `Item ${condition.value} not equipped`,
      };

    case "has_condition":
      const hasCondition = context.character?.conditions?.some(
        (cond: any) => cond.name === condition.value
      );
      return {
        met: !!hasCondition,
        reason: hasCondition ? undefined : `Condition ${condition.value} not active`,
      };

    case "feature_enabled":
      // Assumes character has features/features object
      const featureEnabled = condition.value ? (context.character?.features ?? {})[condition.value] : false;
      return {
        met: !!featureEnabled,
        reason: featureEnabled ? undefined : `Feature ${condition.value} not enabled`,
      };

    case "expression":
      // Safe expression evaluation (minimal for now)
      if (!condition.expression) {
        return { met: false, reason: "expression not set" };
      }
      try {
        // Very basic: only allow variable references and comparisons
        // In production, use a proper expression sandboxing library
        const result = evaluateSafeExpression(condition.expression, context);
        return { met: Boolean(result), reason: result ? undefined : `Expression evaluated false` };
      } catch (err) {
        return { met: false, reason: `Expression error: ${String(err)}` };
      }

    default:
      return { met: false, reason: `Unknown condition type: ${(condition as any).type}` };
  }
}

/**
 * Very basic safe expression evaluator (guards against injection)
 * Supports: "level > 5", "class == 'Wizard'", "dex > str"
 */
function evaluateSafeExpression(expr: string, context: RuleExecutionContext): boolean {
  // Whitelist safe token patterns
  const safePattern = /^[a-zA-Z_][a-zA-Z0-9_]*([\s]*[<>=!]{1,2}[\s]*([0-9]+|'[^']*'|[a-zA-Z_][a-zA-Z0-9_]*))?$/;

  if (!safePattern.test(expr.trim())) {
    throw new Error("Expression contains unsafe tokens");
  }

  // Simple variable substitution
  let safe = expr;
  safe = safe.replace(/\blevel\b/g, String(context.character?.level ?? 0));
  safe = safe.replace(/\bdex\b/g, String(context.character?.abilities?.dexterity ?? 0));
  safe = safe.replace(/\bstr\b/g, String(context.character?.abilities?.strength ?? 0));
  safe = safe.replace(/\bcon\b/g, String(context.character?.abilities?.constitution ?? 0));
  safe = safe.replace(/\bint\b/g, String(context.character?.abilities?.intelligence ?? 0));
  safe = safe.replace(/\bwis\b/g, String(context.character?.abilities?.wisdom ?? 0));
  safe = safe.replace(/\bcha\b/g, String(context.character?.abilities?.charisma ?? 0));

  // Handle string comparisons
  if (safe.includes("'")) {
    safe = safe.replace(/'([^']*)'/g, (_, val) => `"${val}"`);
  }

  // Evaluate (with Function constructor as last resort, very limited)
  try {
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + safe + ")")();
  } catch {
    throw new Error(`Cannot evaluate: ${safe}`);
  }
}

/**
 * Main rule evaluator
 */
export function evaluateRule(rule: CompiledRule, context: RuleExecutionContext): RuleExecutionResult {
  const triggered = evaluateTrigger(rule.trigger, context);

  if (!triggered) {
    return {
      ruleId: rule.id,
      triggered: false,
      conditionMet: false,
      applied: false,
      effects: [],
      trace: {
        trigger: false,
        condition: false,
      },
    };
  }

  const conditionResult = evaluateCondition(rule.condition, context);

  if (!conditionResult.met) {
    return {
      ruleId: rule.id,
      triggered: true,
      conditionMet: false,
      applied: false,
      effects: [],
      trace: {
        trigger: true,
        condition: false,
        conditionReason: conditionResult.reason,
      },
    };
  }

  // Both trigger and condition passed; create effect instances
  const effects: AppliedEffectInstance[] = rule.effects.map((effectDef, idx) => ({
    id: generateId(`effect_${rule.id}_${idx}`),
    ruleId: rule.id,
    effectIndex: idx,
    effectDefinition: effectDef,
    appliedAt: Date.now(),
    lifetime: "permanent",
    reversible: true,
    source: {
      type: "rule",
      id: rule.id,
      label: rule.name,
    },
  }));

  return {
    ruleId: rule.id,
    triggered: true,
    conditionMet: true,
    applied: true,
    effects,
    trace: {
      trigger: true,
      condition: true,
    },
  };
}

/**
 * Batch evaluate multiple rules
 */
export function evaluateRules(
  rules: CompiledRule[],
  context: RuleExecutionContext
): RuleExecutionResult[] {
  return rules.map((rule) => evaluateRule(rule, context));
}
