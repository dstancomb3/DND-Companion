import type { CombatActionCommand, CombatActionResult } from "@/types/combatResolution";
import type { CombatResolutionSummary, CombatResolutionTargetSnapshot, CombatTargetResolutionResult } from "@/types/combatOutcome";
import { resolveHitSaveDamage } from "@/utils/combat/resolveHitSaveDamage";

interface ActionLogPayload {
  type?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolveCombatActionDeps {
  active: boolean;
  isPartyAuthoritative: boolean;
  actorMemberId: string | null;
  currentTurnId: string | null;
  actionsUsed: number;
  actionsTotal: number;
  bonusActionsUsed: number;
  bonusActionsTotal: number;
  reactionUsed: boolean;
  remainingMovementFeet: number;
  useAction: (payload?: ActionLogPayload) => void;
  refundAction: () => void;
  useBonusAction: (payload?: ActionLogPayload) => void;
  refundBonusAction: () => void;
  toggleReaction: (payload?: ActionLogPayload) => void;
  spendMovement: (feet: number) => void;
  refundMovement: (feet: number) => void;
  targetSnapshotsById?: Record<string, CombatResolutionTargetSnapshot>;
  applyLocalTargetResult?: (result: CombatTargetResolutionResult) => void;
  actorConditions?: string[];
  pendingReactionWindowId?: string | null;
  pendingReactionExpiresAtTurnKey?: number | null;
  pendingReactionTriggerType?: string | null;
  currentTurnKey?: number;
}

function rejected(
  commandId: string,
  pathway: "local" | "party",
  reasonCode: CombatActionResult["reasonCode"],
  notes?: string[]
): CombatActionResult {
  return {
    commandId,
    resolvedAt: Date.now(),
    status: "rejected",
    reasonCode,
    economyDelta: {
      actionUsedDelta: 0,
      bonusActionUsedDelta: 0,
      reactionUsedChanged: false,
      movementUsedDeltaFeet: 0,
    },
    debug: {
      pathway,
      notes,
    },
  };
}

// Phase D: conditions that prevent an actor from taking actions or reactions.
// Named to match CONDITION_INFO key casing in data/conditions.ts.
const INCAPACITATING_CONDITIONS = new Set([
  "Incapacitated",
  "Stunned",
  "Paralyzed",
  "Unconscious",
  "Petrified",
]);

const MOVEMENT_BLOCKING_CONDITIONS = new Set([
  "Grappled",
  "Restrained",
  "Stunned",
  "Paralyzed",
  "Unconscious",
  "Petrified",
]);

function noop(commandId: string, pathway: "local" | "party", notes?: string[]): CombatActionResult {
  return {
    commandId,
    resolvedAt: Date.now(),
    status: "noop",
    economyDelta: {
      actionUsedDelta: 0,
      bonusActionUsedDelta: 0,
      reactionUsedChanged: false,
      movementUsedDeltaFeet: 0,
    },
    debug: {
      pathway,
      notes,
    },
  };
}

function accepted(
  commandId: string,
  pathway: "local" | "party",
  economyDelta: CombatActionResult["economyDelta"],
  event?: CombatActionResult["event"],
  notes?: string[],
  targetResults?: CombatTargetResolutionResult[],
  resolutionSummary?: CombatResolutionSummary,
  reactionWindow?: CombatActionResult["reactionWindow"]
): CombatActionResult {
  return {
    commandId,
    resolvedAt: Date.now(),
    status: "accepted",
    economyDelta,
    event,
    targetResults,
    resolutionSummary,
    reactionWindow,
    debug: {
      pathway,
      notes,
    },
  };
}

function isReactionWindowExpired(
  currentTurnKey: number | undefined,
  pendingReactionExpiresAtTurnKey: number | null | undefined
): boolean {
  if (typeof currentTurnKey !== "number") return false;
  if (typeof pendingReactionExpiresAtTurnKey !== "number") return false;
  return currentTurnKey > pendingReactionExpiresAtTurnKey;
}

function offeredReactionWindow(
  command: CombatActionCommand,
  deps: ResolveCombatActionDeps
): CombatActionResult["reactionWindow"] | undefined {
  if (command.action.mode !== "use") return undefined;
  if (command.action.actionKind === "reaction") return undefined;

  const triggerType = typeof command.metadata?.["reactionTriggerType"] === "string"
    ? (command.metadata["reactionTriggerType"] as string)
    : undefined;
  if (!triggerType) return undefined;

  const explicitWindowId = typeof command.metadata?.["reactionWindowId"] === "string"
    ? (command.metadata["reactionWindowId"] as string)
    : undefined;
  const sourceCommandId = typeof command.metadata?.["reactionSourceCommandId"] === "string"
    ? (command.metadata["reactionSourceCommandId"] as string)
    : command.commandId;
  const metadata = typeof command.metadata?.["reactionWindowMetadata"] === "object" && command.metadata?.["reactionWindowMetadata"]
    ? (command.metadata["reactionWindowMetadata"] as Record<string, unknown>)
    : undefined;
  const turnOffsetRaw = command.metadata?.["reactionWindowTurnOffset"];
  const turnOffset = typeof turnOffsetRaw === "number" && Number.isFinite(turnOffsetRaw) && turnOffsetRaw > 0
    ? Math.floor(turnOffsetRaw)
    : 1;
  const currentTurnKey = typeof deps.currentTurnKey === "number" ? deps.currentTurnKey : 0;

  return {
    windowId: explicitWindowId ?? `${command.commandId}:reaction-window`,
    triggerType,
    sourceCommandId,
    expiresAtTurnKey: currentTurnKey + turnOffset,
    ...(metadata ? { metadata } : {}),
  };
}

function normalizeReactionValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function expectedReactionKindForTrigger(triggerType: string): string | null {
  const normalized = normalizeReactionValue(triggerType);
  if (normalized === "opportunity_attack") return "opportunity_attack";
  if (normalized === "shield") return "shield";
  if (normalized === "counterspell") return "counterspell";
  if (normalized === "readied_action") return "readied_action";
  return null;
}

function shouldResolveTargetOutcomes(command: CombatActionCommand): boolean {
  if (command.action.mode !== "use") return false;
  if ((command.targets?.targetIds?.length ?? 0) <= 0) return false;
  if (command.metadata?.["requiresResolution"] === true) return true;
  if ((command.declared?.damagePackets?.length ?? 0) > 0) return true;
  if (command.declared?.save) return true;
  return false;
}

function asEventPayload(command: CombatActionCommand): ActionLogPayload | undefined {
  const type = typeof command.metadata?.["eventType"] === "string" ? (command.metadata["eventType"] as string) : undefined;
  const message = typeof command.metadata?.["eventMessage"] === "string" ? (command.metadata["eventMessage"] as string) : undefined;
  const metadata = typeof command.metadata?.["eventMetadata"] === "object" && command.metadata?.["eventMetadata"]
    ? (command.metadata["eventMetadata"] as Record<string, unknown>)
    : undefined;

  if (!type && !message && !metadata) return undefined;
  return { type, message, metadata };
}

function canApplyTargetResultLocally(result: CombatTargetResolutionResult): boolean {
  return result.applyState === "applied_local" && result.authority.canApplyLocally;
}

export function resolveCombatAction(
  command: CombatActionCommand,
  deps: ResolveCombatActionDeps
): CombatActionResult {
  const pathway = deps.isPartyAuthoritative ? "party" : "local";

  if (!command?.commandId) {
    return rejected("unknown", pathway, "unknown");
  }

  if (typeof command.targets?.maxTargets === "number" && command.targets.maxTargets > 0 && command.targets.targetIds.length > command.targets.maxTargets) {
    return rejected(command.commandId, pathway, "invalid_target");
  }

  const debugNotes: string[] = [];
  const actorId = command.actor.memberId ?? deps.actorMemberId;
  if (deps.active && deps.currentTurnId && !actorId) {
    debugNotes.push("turn ownership check skipped: actorId missing while currentTurnId is set");
  }
  if (deps.active && deps.currentTurnId && actorId && deps.currentTurnId !== actorId) {
    return rejected(command.commandId, pathway, "not_your_turn", debugNotes);
  }

  const eventPayload = asEventPayload(command);
  const event = {
    type: eventPayload?.type,
    message: eventPayload?.message,
    metadata: eventPayload?.metadata,
  };

  const { actionKind, mode } = command.action;
  const reactionWindow = offeredReactionWindow(command, deps);

  // Phase D: gate actions/bonus actions/reactions when actor has an incapacitating condition.
  if (
    mode === "use" &&
    (actionKind === "action" || actionKind === "bonus_action" || actionKind === "reaction") &&
    deps.actorConditions?.some((c) => INCAPACITATING_CONDITIONS.has(c))
  ) {
    return rejected(command.commandId, pathway, "actor_incapacitated", debugNotes);
  }

  if (
    mode === "use" &&
    actionKind === "movement" &&
    deps.actorConditions?.some((c) => MOVEMENT_BLOCKING_CONDITIONS.has(c))
  ) {
    return rejected(command.commandId, pathway, "movement_blocked_by_condition", debugNotes);
  }

  if (!deps.active && mode === "use" && (actionKind === "action" || actionKind === "bonus_action" || actionKind === "reaction" || actionKind === "movement")) {
    return rejected(command.commandId, pathway, "combat_inactive", debugNotes);
  }

  let targetResults: CombatTargetResolutionResult[] | undefined;
  let resolutionSummary: CombatResolutionSummary | undefined;
  if (shouldResolveTargetOutcomes(command)) {
    const resolution = resolveHitSaveDamage({
      command,
      targetSnapshotsById: deps.targetSnapshotsById ?? {},
    });
    if (!resolution.ok) {
      return rejected(command.commandId, pathway, resolution.reasonCode ?? "invalid_resolution_input", debugNotes);
    }
    targetResults = resolution.targetResults;
    resolutionSummary = resolution.summary;
    if (resolution.reasonCode === "unresolved_target_stats") {
      debugNotes.push("target outcome includes unresolved stats");
    }
  }

  const applyLocalOutcomes = () => {
    if (!targetResults || !deps.applyLocalTargetResult) return;
    for (const targetResult of targetResults) {
      if (!canApplyTargetResultLocally(targetResult)) continue;
      deps.applyLocalTargetResult(targetResult);
    }
  };

  if (mode === "undo") {
    if (deps.active) {
      return rejected(command.commandId, pathway, "undo_not_allowed_in_active_combat", debugNotes);
    }

    if (actionKind === "action") {
      if (deps.actionsUsed <= 0) return noop(command.commandId, pathway, debugNotes);
      deps.refundAction();
      return accepted(command.commandId, pathway, {
        actionUsedDelta: -1,
        bonusActionUsedDelta: 0,
        reactionUsedChanged: false,
        movementUsedDeltaFeet: 0,
      }, event, debugNotes, targetResults, resolutionSummary);
    }

    if (actionKind === "bonus_action") {
      if (deps.bonusActionsUsed <= 0) return noop(command.commandId, pathway, debugNotes);
      deps.refundBonusAction();
      return accepted(command.commandId, pathway, {
        actionUsedDelta: 0,
        bonusActionUsedDelta: -1,
        reactionUsedChanged: false,
        movementUsedDeltaFeet: 0,
      }, event, debugNotes, targetResults, resolutionSummary);
    }

    if (actionKind === "reaction") {
      if (!deps.reactionUsed) return noop(command.commandId, pathway, debugNotes);
      deps.toggleReaction();
      return accepted(command.commandId, pathway, {
        actionUsedDelta: 0,
        bonusActionUsedDelta: 0,
        reactionUsedChanged: true,
        movementUsedDeltaFeet: 0,
      }, event, debugNotes, targetResults, resolutionSummary);
    }

    if (actionKind === "movement") {
      const feet = command.action.movementFeet ?? 0;
      if (feet <= 0) return rejected(command.commandId, pathway, "unsupported_mode", debugNotes);
      deps.refundMovement(feet);
      return accepted(command.commandId, pathway, {
        actionUsedDelta: 0,
        bonusActionUsedDelta: 0,
        reactionUsedChanged: false,
        movementUsedDeltaFeet: -feet,
      }, event, debugNotes, targetResults, resolutionSummary);
    }

    return noop(command.commandId, pathway, debugNotes);
  }

  if (actionKind === "action") {
    if (deps.active && deps.actionsUsed >= deps.actionsTotal) {
      return rejected(command.commandId, pathway, "no_action_available", debugNotes);
    }
    if (deps.active) deps.useAction(eventPayload);
    const result = accepted(command.commandId, pathway, {
      actionUsedDelta: deps.active ? 1 : 0,
      bonusActionUsedDelta: 0,
      reactionUsedChanged: false,
      movementUsedDeltaFeet: 0,
    }, event, debugNotes, targetResults, resolutionSummary, reactionWindow);
    applyLocalOutcomes();
    return result;
  }

  if (actionKind === "bonus_action") {
    if (deps.active && deps.bonusActionsUsed >= deps.bonusActionsTotal) {
      return rejected(command.commandId, pathway, "no_bonus_action_available", debugNotes);
    }
    if (deps.active) deps.useBonusAction(eventPayload);
    const result = accepted(command.commandId, pathway, {
      actionUsedDelta: 0,
      bonusActionUsedDelta: deps.active ? 1 : 0,
      reactionUsedChanged: false,
      movementUsedDeltaFeet: 0,
    }, event, debugNotes, targetResults, resolutionSummary, reactionWindow);
    applyLocalOutcomes();
    return result;
  }

  if (actionKind === "reaction") {
    if (deps.active && deps.pendingReactionWindowId) {
      const providedWindowId = command.reaction?.windowId;
      if (!providedWindowId) {
        return rejected(command.commandId, pathway, "reaction_window_required", debugNotes);
      }
      if (providedWindowId !== deps.pendingReactionWindowId) {
        return rejected(command.commandId, pathway, "reaction_window_mismatch", debugNotes);
      }
      if (isReactionWindowExpired(deps.currentTurnKey, deps.pendingReactionExpiresAtTurnKey)) {
        return rejected(command.commandId, pathway, "reaction_window_expired", debugNotes);
      }

      const pendingTriggerType = normalizeReactionValue(deps.pendingReactionTriggerType);
      const declaredTriggerType = normalizeReactionValue(command.reaction?.triggerType);
      if (pendingTriggerType && declaredTriggerType && pendingTriggerType !== declaredTriggerType) {
        return rejected(command.commandId, pathway, "reaction_trigger_mismatch", debugNotes);
      }

      const declaredReaction = command.reaction?.declared;
      if (declaredReaction) {
        const supportedKinds = new Set(["opportunity_attack", "shield", "counterspell", "readied_action"]);
        if (!supportedKinds.has(declaredReaction.reactionKind)) {
          return rejected(command.commandId, pathway, "reaction_declaration_mismatch", debugNotes);
        }

        const declarationTriggerType = normalizeReactionValue(declaredReaction.triggerKind);
        if (pendingTriggerType && declarationTriggerType && pendingTriggerType !== declarationTriggerType) {
          return rejected(command.commandId, pathway, "reaction_declaration_mismatch", debugNotes);
        }

        const expectedKind = pendingTriggerType ? expectedReactionKindForTrigger(pendingTriggerType) : null;
        if (expectedKind && declaredReaction.reactionKind !== expectedKind) {
          return rejected(command.commandId, pathway, "reaction_declaration_mismatch", debugNotes);
        }
      }
    }
    if (deps.active && deps.reactionUsed) {
      return rejected(command.commandId, pathway, "reaction_unavailable", debugNotes);
    }
    if (deps.active) deps.toggleReaction(eventPayload);
    const result = accepted(command.commandId, pathway, {
      actionUsedDelta: 0,
      bonusActionUsedDelta: 0,
      reactionUsedChanged: deps.active,
      movementUsedDeltaFeet: 0,
    }, event, debugNotes, targetResults, resolutionSummary);
    applyLocalOutcomes();
    return result;
  }

  if (actionKind === "movement") {
    const feet = command.action.movementFeet ?? 0;
    if (feet <= 0) return rejected(command.commandId, pathway, "unsupported_mode", debugNotes);
    if (deps.active && deps.remainingMovementFeet < feet) {
      return rejected(command.commandId, pathway, "insufficient_movement", debugNotes);
    }
    if (deps.active) deps.spendMovement(feet);
    const result = accepted(command.commandId, pathway, {
      actionUsedDelta: 0,
      bonusActionUsedDelta: 0,
      reactionUsedChanged: false,
      movementUsedDeltaFeet: deps.active ? feet : 0,
    }, event, debugNotes, targetResults, resolutionSummary);
    applyLocalOutcomes();
    return result;
  }

  const result = accepted(command.commandId, pathway, {
    actionUsedDelta: 0,
    bonusActionUsedDelta: 0,
    reactionUsedChanged: false,
    movementUsedDeltaFeet: 0,
  }, event, debugNotes, targetResults, resolutionSummary);
  applyLocalOutcomes();
  return result;
}
