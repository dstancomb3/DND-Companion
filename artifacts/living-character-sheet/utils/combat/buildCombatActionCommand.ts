import type {
  CombatActionCommand,
  CombatActionKind,
  CombatActionMode,
  CombatActionSourceType,
} from "@/types/combatResolution";

export interface BuildCombatActionCommandInput {
  sourceType: CombatActionSourceType;
  sourceId: string;
  sourceName: string;
  actionKind: CombatActionKind;
  mode?: CombatActionMode;
  memberId?: string;
  battleId?: string;
  itemId?: string;
  targetIds?: string[];
  selectedTargetIds?: string[];
  maxTargets?: number;
  movementFeet?: number;
  declared?: CombatActionCommand["declared"];
  reaction?: CombatActionCommand["reaction"];
  metadata?: Record<string, unknown>;
}

function generateCommandId(): string {
  return `combat_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildCombatActionCommand(input: BuildCombatActionCommandInput): CombatActionCommand {
  return {
    commandId: generateCommandId(),
    issuedAt: Date.now(),
    actor: {
      memberId: input.memberId,
      battleId: input.battleId,
    },
    source: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceName: input.sourceName,
      itemId: input.itemId,
    },
    action: {
      actionKind: input.actionKind,
      mode: input.mode ?? "use",
      movementFeet: input.movementFeet,
    },
    targets: {
      targetIds: input.targetIds ?? input.selectedTargetIds ?? [],
      maxTargets: input.maxTargets,
    },
    declared: input.declared,
    reaction: input.reaction,
    metadata: input.metadata,
  };
}

export function actionKindFromActionType(actionType: "action" | "bonus_action" | "reaction" | "free"): CombatActionKind {
  return actionType;
}
