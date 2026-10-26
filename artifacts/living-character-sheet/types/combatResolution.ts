import type {
  CombatResolutionSummary,
  CombatSaveOutcome,
  CombatTargetResolutionResult,
  DamagePacketInput,
} from "./combatOutcome";
import type { CombatDeclaredConditionEffect } from "./combatConditions";
import type { CombatDeclaredReaction, PendingReactionWindow, ReactionDecision, ReactionTriggerType } from "./combatReaction";

export type CombatActionSourceType =
  | "attack"
  | "class_feature"
  | "prepared_spell"
  | "item_spell"
  | "consumable"
  | "item_action"
  | "free_action";

export type CombatActionKind =
  | "action"
  | "bonus_action"
  | "reaction"
  | "free"
  | "movement"
  | "none";

export type CombatActionMode = "use" | "undo";

export interface CombatActionCommand {
  commandId: string;
  issuedAt: number;
  actor: {
    memberId?: string;
    battleId?: string;
  };
  source: {
    sourceType: CombatActionSourceType;
    sourceId: string;
    sourceName: string;
    itemId?: string;
  };
  action: {
    actionKind: CombatActionKind;
    mode: CombatActionMode;
    movementFeet?: number;
  };
  targets: {
    targetIds: string[];
    maxTargets?: number;
  };
  declared?: {
    attackRoll?: number;
    damageRolls?: number[];
    damagePackets?: DamagePacketInput[];
    conditionEffects?: CombatDeclaredConditionEffect[];
    spellLevel?: number;
    resourceCostText?: string;
    spell?: {
      mode?: "attack" | "save" | "attack_and_save" | "effect_only";
      targetScopeHint?: "single" | "multi" | "area" | "self" | "unknown";
      concentration?: {
        required: boolean;
        durationText?: string;
      };
      scaling?: {
        supported: boolean;
        source: "none" | "name_rule" | "text_pattern";
        baseLevel: number;
        castLevel: number;
        levelsAboveBase: number;
        summary?: string;
      };
      damageModel?: "none" | "fixed" | "dice" | "mixed";
      parsingConfidence?: "high" | "partial" | "limited";
    };
    save?: {
      saveAbility?: string;
      dc?: number;
      onSave?: CombatSaveOutcome["onSave"];
      targetRolls?: Record<string, number>;
    };
  };
  reaction?: {
    windowId?: string;
    triggerType?: ReactionTriggerType | string;
    sourceCommandId?: string;
    decision?: ReactionDecision;
    declared?: CombatDeclaredReaction;
  };
  metadata?: Record<string, unknown>;
}

export type CombatActionResultStatus = "accepted" | "rejected" | "noop";

export type CombatActionResultReasonCode =
  | "combat_inactive"
  | "not_your_turn"
  | "actor_incapacitated"
  | "movement_blocked_by_condition"
  | "no_action_available"
  | "no_bonus_action_available"
  | "reaction_unavailable"
  | "reaction_window_required"
  | "reaction_window_mismatch"
  | "reaction_trigger_mismatch"
  | "reaction_declaration_mismatch"
  | "reaction_window_expired"
  | "insufficient_movement"
  | "invalid_target"
  | "invalid_resolution_input"
  | "unresolved_target_stats"
  | "undo_not_allowed_in_active_combat"
  | "unsupported_mode"
  | "unknown";

export interface RemoteCombatApplyReceipt {
  ok: true;
  appliedCount: number;
  replayed: boolean;
  targetResults?: Array<{
    requestIndex: number;
    targetType?: string;
    targetId?: string;
    status: "applied" | "skipped_invalid" | "skipped_missing_target" | "skipped_noop";
    reason?: string;
  }>;
}

export interface CombatActionResult {
  remoteApplication?: RemoteCombatApplyReceipt;
  remoteApplicationError?: string;
  commandId: string;
  resolvedAt: number;
  status: CombatActionResultStatus;
  reasonCode?: CombatActionResultReasonCode;
  economyDelta: {
    actionUsedDelta: number;
    bonusActionUsedDelta: number;
    reactionUsedChanged: boolean;
    movementUsedDeltaFeet: number;
  };
  sideEffects?: {
    shouldConsumeSpellSlot?: boolean;
    shouldConsumeItemUse?: boolean;
    shouldApplySpellEffectUse?: boolean;
  };
  event?: {
    type?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  };
  targetResults?: CombatTargetResolutionResult[];
  resolutionSummary?: CombatResolutionSummary;
  concentrationCheckNeeded?: { dc: number; spellId: string; damageTaken: number };
  reactionWindow?: PendingReactionWindow;
  debug?: {
    pathway: "local" | "party";
    notes?: string[];
  };
}
