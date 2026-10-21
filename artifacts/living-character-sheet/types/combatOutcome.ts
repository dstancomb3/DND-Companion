import type { CombatConditionResolution } from "./combatConditions";

export interface DamagePacketInput {
  sourceLabel?: string;
  rawAmount: number;
  damageType?: string;
  criticalEligible?: boolean;
  diceExpression?: string;
  resolutionModel?: "fixed" | "dice_average" | "dice_declared_roll";
  scalingSource?: "base" | "upcast";
}

export interface CombatHitOutcome {
  status: "hit" | "miss" | "auto" | "unresolved";
  attackRoll?: number;
  attackBonus?: number;
  totalToHit?: number;
  targetArmorClass?: number;
  reason?: string;
}

export interface CombatSaveOutcome {
  status: "passed" | "failed" | "none" | "unresolved";
  saveAbility?: string;
  dc?: number;
  roll?: number;
  total?: number;
  onSave?: "full" | "half" | "none" | "negates";
  reason?: string;
}

export interface DamagePacketBreakdown {
  sourceLabel?: string;
  damageType?: string;
  rawAmount: number;
  postCriticalAmount: number;
  adjustedAmount: number;
  resisted: boolean;
  immune: boolean;
}

export interface CombatDamageBreakdown {
  rawTotal: number;
  postCriticalTotal: number;
  adjustedTotal: number;
  vulnerabilityMultiplier: number;
  tempHpAbsorbed: number;
  hpDamage: number;
  hpHealing?: number;
  packets: DamagePacketBreakdown[];
}

export type CombatTargetAuthorityMode = "local_authoritative" | "preview_only" | "skipped";

export type CombatTargetAuthorityCertainty = "confirmed" | "limited" | "unknown";

export type CombatTargetAuthorityReason =
  | "local_character"
  | "remote_member_preview_only"
  | "remote_npc_preview_only"
  | "missing_target_snapshot";

export interface CombatTargetAuthority {
  mode: CombatTargetAuthorityMode;
  canApplyLocally: boolean;
  certainty: CombatTargetAuthorityCertainty;
  reason: CombatTargetAuthorityReason;
}

export interface CombatResolutionTargetSnapshot {
  targetId: string;
  targetType: "self" | "member" | "npc";
  armorClass?: number;
  currentHp?: number;
  tempHp?: number;
  damageResistances?: string[];
  damageImmunities?: string[];
  vulnerabilityMultiplier?: number;
  mitigationKnown?: boolean;
  authority?: CombatTargetAuthority;
  isLocalCharacter?: boolean;
  conditions?: string[];
  conditionImmunities?: string[];
}

export interface CombatTargetResolutionResult {
  targetId: string;
  targetType: "self" | "member" | "npc";
  hitOutcome: CombatHitOutcome;
  saveOutcome: CombatSaveOutcome;
  damageBreakdown?: CombatDamageBreakdown;
  conditionResults?: CombatConditionResolution[];
  hpDeltaPreview: number;
  tempHpConsumedPreview: number;
  applyState: "applied_local" | "preview_only" | "skipped";
  authority: CombatTargetAuthority;
  reason?: string;
}

export interface CombatResolutionSummary {
  targetedCount: number;
  resolvedCount: number;
  appliedLocalCount: number;
  previewOnlyCount: number;
  totalHpDamageAppliedLocal: number;
  totalHpDamagePreview: number;
  notes?: string[];
}
