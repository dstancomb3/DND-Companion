export type ReactionTriggerType =
  | "opportunity_attack"
  | "counterspell"
  | "shield"
  | "readied_action"
  | "custom";

export type SupportedReactionDeclarationKind =
  | "opportunity_attack"
  | "counterspell"
  | "shield"
  | "readied_action";

export interface CombatDeclaredReaction {
  reactionKind: SupportedReactionDeclarationKind;
  reactionName: string;
  triggerKind: ReactionTriggerType | string;
  sourceHint?: "weapon" | "spell" | "class_feature" | "item" | "custom";
  targetHint?: "self" | "single_target" | "single_attacker" | "none" | "unknown";
  effectHints?: Array<
    | {
        effectType: "ac_bonus";
        bonus: number;
        durationText?: string;
      }
    | {
        effectType: "counterspell_attempt";
        counterLevel?: number;
      }
    | {
        effectType: "readied_action_execute";
        details?: string;
      }
    | {
        effectType: "opportunity_attack";
        details?: string;
      }
  >;
}

export interface PendingReactionWindow {
  windowId: string;
  triggerType: ReactionTriggerType | string;
  sourceCommandId?: string;
  expiresAtTurnKey: number;
  metadata?: Record<string, unknown>;
}

export type ReactionDecision = "accept" | "decline";
