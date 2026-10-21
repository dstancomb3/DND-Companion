export type CombatConditionTargetScope = "single" | "multi" | "area" | "self" | "unknown";

export type CombatConditionApplyWhen = "always" | "on_hit" | "on_failed_save" | "on_hit_and_failed_save";

export type CombatConditionDurationType =
  | "rounds"
  | "turns"
  | "untilShortRest"
  | "untilLongRest"
  | "encounter"
  | "concentration"
  | "manual"
  | "permanent";

export type CombatConditionTickTiming = "onTargetTurnEnd" | "onRoundAdvance" | "manualOnly";

export interface CombatConditionDurationHint {
  durationType?: CombatConditionDurationType;
  durationValue?: number;
  tickTiming?: CombatConditionTickTiming;
  text?: string;
  saveEnds?: boolean;
}

export interface CombatDeclaredConditionEffect {
  effectType: "apply_condition" | "remove_condition";
  conditionName: string;
  applyWhen: CombatConditionApplyWhen;
  targetScope?: CombatConditionTargetScope;
  sourceLabel?: string;
  durationHint?: CombatConditionDurationHint;
  concentrationLinked?: boolean;
}

export interface CombatConditionResolution {
  effectType: "apply_condition" | "remove_condition";
  conditionName: string;
  status: "applied" | "removed" | "blocked" | "unresolved" | "not_triggered";
  reason?: string;
  sourceLabel?: string;
  sourceName?: string;
  durationHint?: CombatConditionDurationHint;
  concentrationLinked?: boolean;
  concentrationLinkId?: string;
}