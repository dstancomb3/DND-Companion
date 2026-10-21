/**
 * Rule Schema
 * 
 * Core data structures for the rules-expression engine.
 * All types include schemaVersion for migration safety.
 */

export type TriggerType = "manual" | "long_rest" | "short_rest" | "equip_item" | "unequip_item" | "turn_start" | "turn_end";

export type ConditionType = "always" | "has_class" | "has_subclass" | "level_minimum" | "item_equipped" | "has_condition" | "feature_enabled" | "expression";

export type EffectType = 
  | "modify_stat" 
  | "add_action" 
  | "remove_action" 
  | "consume_resource" 
  | "restore_resource" 
  | "add_condition" 
  | "remove_condition"
  | "grant_spell"
  | "revoke_spell";

export type StatKey = 
  | "armorClass" 
  | "initiative" 
  | "speed" 
  | "proficiencyBonus" 
  | "strength" 
  | "dexterity" 
  | "constitution" 
  | "intelligence" 
  | "wisdom" 
  | "charisma"
  | "maxHp"
  | "tempHpMax";

/**
 * Trigger Definition
 * Describes what event activates a rule
 */
export interface TriggerDefinition {
  type: TriggerType;
  itemId?: string;           // For equip/unequip triggers
  conditionName?: string;    // For apply/remove condition triggers
}

/**
 * Condition Definition
 * Guard that must be true for effects to apply
 */
export interface ConditionDefinition {
  type: ConditionType;
  value?: string;            // Class name, subclass name, item ID, condition name, etc.
  minLevel?: number;         // For level_minimum
  expression?: string;       // For expression type (safe math)
}

/**
 * Effect Definition
 * Action to apply if condition passes
 */
export interface EffectDefinition {
  type: EffectType;
  
  // For modify_stat effects
  statKey?: StatKey;
  statValue?: number;        // Additive modifier
  replacementValue?: number; // Replacement (takes precedence over additive)
  
  // For resource effects
  resourceId?: string;
  resourceName?: string;
  amount?: number;           // Positive = restore, negative = consume
  
  // For action effects
  actionName?: string;
  actionType?: "action" | "bonus_action" | "reaction";
  
  // For spell effects
  spellId?: string;
  spellName?: string;
  
  // For condition effects
  conditionName?: string;
  durationRounds?: number;
  removeOn?: ("short_rest" | "long_rest" | "save" | "manual")[];
  
  // Metadata
  label?: string;           // User-facing label for UI/logging
  description?: string;     // Longer explanation
}

/**
 * Rule Definition
 * Complete rule: when trigger fires + condition passes, apply effects
 */
export interface RuleDefinition {
  id: string;                    // Unique rule ID
  schemaVersion: number;         // Migration version (currently 1)
  name: string;
  description?: string;
  
  trigger: TriggerDefinition;
  condition: ConditionDefinition;
  effects: EffectDefinition[];
  
  // Metadata
  source?: string;               // "class_feature", "item", "spell", "homebrew", etc.
  sourceId?: string;             // ID of originating feature/item/spell
  scope?: "character" | "item" | "overlay" | "companion"; // Where this rule applies
  priority?: number;             // Higher = applied later (for precedence)
  repeatable?: boolean;          // Can trigger multiple times or only once per condition
  
  // Lifecycle
  createdAt?: number;            // Timestamp
  disabled?: boolean;            // Can be disabled without removal
}

/**
 * Compiled Rule
 * Internal representation after validation
 */
export interface CompiledRule extends RuleDefinition {
  _compiled: true;
  _errors: string[];             // Empty if valid
}

/**
 * Applied Effect Instance
 * Record of a rule effect that was applied and can be reverted
 */
export interface AppliedEffectInstance {
  id: string;                    // Unique per application
  ruleId: string;
  effectIndex: number;           // Which effect in the rule's effects array
  effectDefinition: EffectDefinition;
  
  // When this effect was applied
  appliedAt: number;             // Timestamp
  
  // Lifetime
  lifetime?: "permanent" | "until_unequip" | "until_remove_condition" | "concentration" | "rounds";
  expiresAt?: number;            // Timestamp or round number
  linkedEntity?: string;         // Item ID, condition ID, etc. that triggers expiration
  
  // Reversal metadata
  reversible: boolean;           // Can this effect be reverted?
  revertAction?: {               // How to revert if not standard undo
    type: string;
    payload: any;
  };
  
  // Metadata
  source?: {
    type: "item" | "feature" | "spell" | "condition" | "rule";
    id: string;
    label: string;
  };
}

/**
 * Rule Execution Context
 * Input to the evaluator
 */
export interface RuleExecutionContext {
  character: any;                // Full Character object
  item?: any;                    // If item-scoped
  overlay?: any;                 // If overlay-scoped
  companion?: any;               // If companion-scoped
  currentTurn?: number;          // For turn-based triggers
  currentAction?: string;        // For action-scoped triggers
  
  // Feature flag for gradual rollout
  featureFlags?: Record<string, boolean>;
}

/**
 * Rule Execution Result
 * Output from the evaluator
 */
export interface RuleExecutionResult {
  ruleId: string;
  triggered: boolean;            // Did trigger fire?
  conditionMet: boolean;         // Did condition pass?
  applied: boolean;              // Were effects applied?
  
  effects: AppliedEffectInstance[];
  
  // Diagnostics
  errors?: string[];
  warnings?: string[];
  trace?: {
    trigger: boolean;
    condition: boolean;
    conditionReason?: string;
  };
}

/**
 * Derived Contribution
 * One contributor to a derived value (for explainability)
 */
export interface DerivedContribution {
  source: "base" | "ability" | "item" | "condition" | "rule" | "spell" | "feature" | "override";
  sourceId?: string;            // Item ID, rule ID, condition ID, etc.
  sourceLabel: string;          // "Dexterity modifier", "Leather Armor", "Haste spell", etc.
  
  modifier: number;             // +/-/= value
  operation: "add" | "replace" | "multiply";
  
  active: boolean;              // Is this contributor currently active?
  reason?: string;              // Why inactive if !active
  
  ruleProvenance?: {
    ruleId: string;
    trigger: string;
    condition: string;
  };
}

/**
 * Explained Value
 * Final value plus contribution chain (for UI inspection)
 */
export interface ExplainedValue<T = number> {
  baseValue: T;
  finalValue: T;
  
  contributions: DerivedContribution[];
  
  // For debugging
  calculationOrder?: string[];   // Order contributions were applied
  suppressedContributors?: DerivedContribution[];
  
  errors?: string[];
}
