import type { PartyCombatState } from "@/utils/partyApi";
import type { CampaignRuntimeTurnEncounterIntent } from "@/utils/adventure/aiDmCampaignRuntimeApi";

export type EncounterRollStatKey = "initiative" | "perception" | "dexterity" | "dexterity_save";

export type EncounterGateHealthReasonCode =
  | "missing_combat_state"
  | "missing_battle_context"
  | "missing_targets"
  | "stale_battle_context"
  | "awaiting_responses";

export type TargetPolicyMode = "locked_targets" | "live_targets";

export type EncounterGateOverrideMode = "none" | "acknowledge_missing_targets";

export type EncounterGateOverrideReasonCode = "missing_target_departed" | "manual_dm_ack";

export type BattleSelectionRationale = "target_coverage" | "active_turn_tiebreak" | "stable_fallback" | "preferred_current_battle";

export interface EncounterGateVisibilityState {
  isActive: boolean;
  clearConfirmed: boolean;
  confirmedAtMs?: number;
  confirmedBy?: "dm_local";
  confirmationSource?: "ui_confirm_action";
  overrideMode: EncounterGateOverrideMode;
  overrideStatus?: "active" | "revoked" | "expired";
  overrideReasonCode?: EncounterGateOverrideReasonCode;
  overrideAtMs?: number;
  overrideExpiresAtMs?: number;
  overrideRevokedAtMs?: number;
  overrideRevokedBy?: "dm_local";
  overrideBy?: "dm_local";
  reason: string;
  status: "pending" | "partially_ready" | "blocked" | "cleared";
  requiredRolls: EncounterRollStatKey[];
  createdRolls: EncounterRollStatKey[];
  failedRolls: EncounterRollStatKey[];
  resolvedRolls: EncounterRollStatKey[];
  unresolvedRolls: EncounterRollStatKey[];
  summary: string;
  completionSummary: string;
  healthReasonCode?: EncounterGateHealthReasonCode;
  healthReason?: string;
  gateAgeMs?: number;
  timeoutStatus?: "normal" | "watch" | "delayed";
  timeoutSummary?: string;
}

export interface EncounterRollCompletionState {
  resolvedRolls: EncounterRollStatKey[];
  unresolvedRolls: EncounterRollStatKey[];
  canEvaluate: boolean;
  healthReasonCode?: EncounterGateHealthReasonCode;
  healthReason?: string;
  evaluatedBattleId?: string;
  evaluatedTargetCount?: number;
  evaluationRationale?: BattleSelectionRationale;
  targetPolicyMode?: TargetPolicyMode;
}

export function describeEncounterGateHealthReason(code: EncounterGateHealthReasonCode): string {
  if (code === "missing_combat_state") return "Waiting for live combat state.";
  if (code === "missing_battle_context") return "Waiting for authoritative battle context.";
  if (code === "missing_targets") return "Waiting for target member resolution.";
  if (code === "stale_battle_context") return "Waiting for refreshed battle context after encounter state changed.";
  return "Waiting for required roll responses.";
}

export function getEncounterGateTimeoutState(gateAgeMs: number | undefined): {
  status: "normal" | "watch" | "delayed";
  summary?: string;
} {
  if (typeof gateAgeMs !== "number" || !Number.isFinite(gateAgeMs) || gateAgeMs < 30_000) {
    return { status: "normal" };
  }
  if (gateAgeMs < 90_000) {
    return {
      status: "watch",
      summary: "Gate still pending after 30s; waiting for authoritative roll responses.",
    };
  }
  return {
    status: "delayed",
    summary: "Gate pending longer than 90s; still waiting for authoritative combat updates.",
  };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function isGenericHostileName(value: string): boolean {
  const normalized = normalizeName(value);
  return normalized === "unknown beast" || normalized === "unknown creature" || normalized === "hostile creature";
}

function hasSameTargetSet(expected: string[], actual: string[]): boolean {
  if (expected.length !== actual.length) return false;
  const actualSet = new Set(actual.map((id) => id.trim()).filter((id) => id.length > 0));
  return expected.every((id) => actualSet.has(id));
}

function hasExistingRollRequest(input: {
  combatState: PartyCombatState | null | undefined;
  battleId: string;
  statKey: EncounterRollStatKey;
  targetMemberIds: string[];
}): boolean {
  const requests = input.combatState?.rollRequests ?? [];
  return requests.some((request) => {
    if (request.statKey !== input.statKey) return false;
    if (request.battleId !== input.battleId) return false;
    return hasSameTargetSet(input.targetMemberIds, request.targetMemberIds ?? []);
  });
}

export interface EncounterHostileNpcIdentity {
  id: string;
  name: string;
  sourceType: "manual" | "monster";
  sourceId?: string;
}

export function findHostileNpcInBattle(
  combatState: PartyCombatState | null | undefined,
  battleId: string | null | undefined,
  encounterIntent: CampaignRuntimeTurnEncounterIntent,
): EncounterHostileNpcIdentity | null {
  if (!combatState || !battleId) return null;
  const wanted = normalizeName(encounterIntent.hostileCreatureName);
  if (!wanted) return null;

  const wantedSourceType = encounterIntent.hostileCreatureSourceType;
  const wantedSourceId = encounterIntent.hostileCreatureSourceId?.trim();

  const matchedNpc = (combatState.combatNpcs ?? []).find((npc) => {
    const npcBattleId = combatState.participantBattleById?.[npc.id];
    const sameSource =
      wantedSourceType === "monster"
      && typeof wantedSourceId === "string"
      && wantedSourceId.length > 0
      && npc.sourceType === "monster"
      && npc.sourceId?.trim() === wantedSourceId;

    return (
      npc.disposition === "hostile" &&
      npcBattleId === battleId &&
      (sameSource || normalizeName(npc.name) === wanted)
    );
  });

  if (!matchedNpc) {
    const hostileInBattle = (combatState.combatNpcs ?? []).filter((npc) => {
      const npcBattleId = combatState.participantBattleById?.[npc.id];
      return npc.disposition === "hostile" && npcBattleId === battleId;
    });
    if (
      hostileInBattle.length === 1
      && isGenericHostileName(hostileInBattle[0]?.name ?? "")
      && !isGenericHostileName(encounterIntent.hostileCreatureName)
    ) {
      const single = hostileInBattle[0];
      return {
        id: single.id,
        name: encounterIntent.hostileCreatureName,
        sourceType: single.sourceType === "monster" ? "monster" : "manual",
        sourceId: typeof single.sourceId === "string" && single.sourceId.trim().length > 0 ? single.sourceId.trim() : undefined,
      };
    }
    return null;
  }

  if (isGenericHostileName(matchedNpc.name) && !isGenericHostileName(encounterIntent.hostileCreatureName)) {
    return {
      id: matchedNpc.id,
      name: encounterIntent.hostileCreatureName,
      sourceType: matchedNpc.sourceType === "monster" ? "monster" : "manual",
      sourceId: typeof matchedNpc.sourceId === "string" && matchedNpc.sourceId.trim().length > 0 ? matchedNpc.sourceId.trim() : undefined,
    };
  }

  return {
    id: matchedNpc.id,
    name: matchedNpc.name,
    sourceType: matchedNpc.sourceType === "monster" ? "monster" : "manual",
    sourceId: typeof matchedNpc.sourceId === "string" && matchedNpc.sourceId.trim().length > 0 ? matchedNpc.sourceId.trim() : undefined,
  };
}

export function selectReusableBattleId(
  combatState: PartyCombatState | null | undefined,
  targetMemberIds: string[],
): string | null {
  if (!combatState) return null;

  // Prefer any battle currently containing one of our target members.
  for (const memberId of targetMemberIds) {
    const battleId = combatState.participantBattleById?.[memberId];
    if (typeof battleId === "string" && battleId.length > 0) {
      return battleId;
    }
  }

  // Fallback to any battle with a turn order.
  const byOrder = Object.entries(combatState.battleTurnOrderById ?? {}).find(([, order]) => Array.isArray(order) && order.length > 0);
  if (byOrder && byOrder[0]) return byOrder[0];

  // Fallback to any tracked battle id.
  const tracked = Object.keys(combatState.currentTurnIdByBattle ?? {});
  return tracked[0] ?? null;
}

export function hasHostileNpcInBattle(
  combatState: PartyCombatState | null | undefined,
  battleId: string | null | undefined,
  encounterIntent: CampaignRuntimeTurnEncounterIntent,
): boolean {
  return findHostileNpcInBattle(combatState, battleId, encounterIntent) !== null;
}

export function getConnectedTargetMemberIds(memberIds: string[]): string[] {
  const next = new Set<string>();
  for (const id of memberIds) {
    const trimmed = id.trim();
    if (trimmed.length > 0) next.add(trimmed);
  }
  return [...next];
}

export interface CampaignEncounterOrchestrationDeps {
  startPartyInitiative: (
    code: string,
    includeEnvironment: boolean,
    targetMemberIds?: string[],
  ) => Promise<{ battleId: string }>;
  addCombatNpc: (code: string, payload: {
    name: string;
    sourceType: "manual" | "monster";
    sourceId?: string;
    disposition: "hostile";
    battleId: string;
    coreStats: {
      speed: number;
      initiativeBonus: number;
      strength: number;
      dexterity: number;
      constitution: number;
      intelligence: number;
      wisdom: number;
      charisma: number;
    };
    dummyState: {
      maxHp: number;
      currentHp: number;
      armorClass: number;
      actionUsed: boolean;
    };
  }) => Promise<unknown>;
  createPartyRollRequest: (code: string, payload: {
    statKey: EncounterRollStatKey;
    label: string;
    targetMemberIds: string[];
    battleId: string;
  }) => Promise<unknown>;
  refreshCombatState: (code: string) => Promise<unknown>;
}

export interface CampaignEncounterOrchestrationResult {
  handled: boolean;
  startedNewEncounter: boolean;
  npcAlreadyPresent: boolean;
  hostileNpcId?: string;
  hostileNpcIds?: string[];
  hostileNpcName?: string;
  hostileNpcSourceType?: "manual" | "monster";
  hostileNpcSourceId?: string;
  requiredRolls: EncounterRollStatKey[];
  createdRolls: EncounterRollStatKey[];
  failedRolls: EncounterRollStatKey[];
  battleId: string | null;
  targetMemberIds: string[];
  systemMessage?: string;
  toolMessage?: string;
  clearEncounterGate: boolean;
}

function uniqueRollKeys(values: EncounterRollStatKey[]): EncounterRollStatKey[] {
  return [...new Set(values)];
}

export function getRequiredEncounterRolls(encounterIntent: CampaignRuntimeTurnEncounterIntent): EncounterRollStatKey[] {
  const rolls: EncounterRollStatKey[] = encounterIntent.promptRolls.map((prompt) => prompt.statKey);
  if (encounterIntent.narrationBlockedUntilResolved && !rolls.includes("initiative")) {
    rolls.unshift("initiative");
  }
  return uniqueRollKeys(rolls);
}

export function buildEncounterGateVisibilityState(input: {
  reason: string;
  requiredRolls: EncounterRollStatKey[];
  createdRolls: EncounterRollStatKey[];
  failedRolls: EncounterRollStatKey[];
  resolvedRolls?: EncounterRollStatKey[];
  healthReasonCode?: EncounterGateHealthReasonCode;
  healthReason?: string;
  gateAgeMs?: number;
  clearEncounterGate: boolean;
  clearConfirmed?: boolean;
  confirmedAtMs?: number;
  confirmedBy?: "dm_local";
  confirmationSource?: "ui_confirm_action";
  targetPolicyMode?: TargetPolicyMode;
  overrideMode?: EncounterGateOverrideMode;
  overrideStatus?: "active" | "revoked" | "expired";
  overrideReasonCode?: EncounterGateOverrideReasonCode;
  overrideAtMs?: number;
  overrideExpiresAtMs?: number;
  overrideRevokedAtMs?: number;
  overrideRevokedBy?: "dm_local";
  overrideBy?: "dm_local";
}): EncounterGateVisibilityState {
  const requiredRolls = uniqueRollKeys(input.requiredRolls);
  const createdRolls = uniqueRollKeys(input.createdRolls);
  const failedRolls = uniqueRollKeys(input.failedRolls);
  const resolvedRolls = uniqueRollKeys(input.resolvedRolls ?? []);
  const createdRequired = requiredRolls.filter((roll) => createdRolls.includes(roll));
  const failedRequired = requiredRolls.filter((roll) => failedRolls.includes(roll));
  const resolvedRequired = requiredRolls.filter((roll) => resolvedRolls.includes(roll));
  const unresolvedRolls = requiredRolls.filter((roll) => !resolvedRequired.includes(roll));

  const status: EncounterGateVisibilityState["status"] = input.clearEncounterGate
    ? "cleared"
    : failedRequired.length > 0
      ? "blocked"
      : createdRequired.length > 0
        ? "partially_ready"
        : "pending";

  // Reopen is fail-closed: if completion regresses, confirmation is invalidated.
  const clearConfirmed = input.clearEncounterGate ? (input.clearConfirmed ?? false) : false;
  const overrideMode: EncounterGateOverrideMode =
    input.targetPolicyMode === "locked_targets" && input.overrideMode === "acknowledge_missing_targets"
      ? "acknowledge_missing_targets"
      : "none";
  const overrideStatus = overrideMode === "acknowledge_missing_targets" ? input.overrideStatus ?? "active" : undefined;
  const overrideActive = overrideMode === "acknowledge_missing_targets" && overrideStatus === "active";
  const overrideRevoked = overrideMode === "acknowledge_missing_targets" && overrideStatus === "revoked";
  const overrideExpired = overrideMode === "acknowledge_missing_targets" && overrideStatus === "expired";

  const summary = overrideActive
    ? "Encounter gate override acknowledged for missing locked target. Story narration can continue."
    : overrideRevoked
      ? "Encounter gate override revoked. Gate re-evaluating under normal rules."
      : overrideExpired
        ? "Encounter gate override expired. Gate re-evaluated under normal rules."
    : input.clearEncounterGate
      ? clearConfirmed
        ? "Required encounter prompts resolved. Story narration can continue."
        : "Required encounter prompts resolved. Confirm to continue story narration."
      : `Resolved ${createdRequired.length}/${requiredRolls.length} required prompts.`;

  const completionSummary = input.clearEncounterGate
    ? `Roll completion ${resolvedRequired.length}/${requiredRolls.length}.`
    : `Roll completion ${resolvedRequired.length}/${requiredRolls.length}.`;

  const timeout = getEncounterGateTimeoutState(input.gateAgeMs);

  return {
    isActive: overrideActive ? false : (input.clearEncounterGate ? !clearConfirmed : true),
    clearConfirmed,
    confirmedAtMs: clearConfirmed ? input.confirmedAtMs : undefined,
    confirmedBy: clearConfirmed ? input.confirmedBy : undefined,
    confirmationSource: clearConfirmed ? input.confirmationSource : undefined,
    overrideMode,
    overrideStatus,
    overrideReasonCode: overrideActive ? input.overrideReasonCode : undefined,
    overrideAtMs: overrideActive ? input.overrideAtMs : undefined,
    overrideExpiresAtMs: overrideMode === "acknowledge_missing_targets" ? input.overrideExpiresAtMs : undefined,
    overrideRevokedAtMs: overrideRevoked ? input.overrideRevokedAtMs : undefined,
    overrideRevokedBy: overrideRevoked ? input.overrideRevokedBy : undefined,
    overrideBy: overrideActive ? input.overrideBy : undefined,
    reason: input.reason,
    status,
    requiredRolls,
    createdRolls,
    failedRolls,
    resolvedRolls: resolvedRequired,
    unresolvedRolls,
    summary,
    completionSummary,
    healthReasonCode: input.healthReasonCode,
    healthReason: input.healthReason,
    gateAgeMs: input.gateAgeMs,
    timeoutStatus: timeout.status,
    timeoutSummary: timeout.summary,
  };
}

export function canAcknowledgeMissingTargetOverride(input: {
  targetPolicyMode?: TargetPolicyMode;
  healthReasonCode?: EncounterGateHealthReasonCode;
  isActive: boolean;
}): boolean {
  if (!input.isActive) return false;
  if (input.targetPolicyMode !== "locked_targets") return false;
  return input.healthReasonCode === "missing_targets" || input.healthReasonCode === "stale_battle_context";
}

function hasExactTargetSet(targetIds: string[], requestTargetIds: string[]): boolean {
  if (targetIds.length !== requestTargetIds.length) return false;
  const requestSet = new Set(requestTargetIds);
  return targetIds.every((id) => requestSet.has(id));
}

export interface BattleCandidate {
  battleId: string;
  targetMemberCount: number;
  hasActiveTurnTarget: boolean;
}

export function selectRankedBattleCandidates(
  combatState: PartyCombatState | null | undefined,
  targetMemberIds: string[],
): BattleCandidate[] {
  if (!combatState || targetMemberIds.length === 0) return [];

  const targetSet = new Set(targetMemberIds);
  const candidateMap = new Map<string, { members: string[]; hasActiveTurn: boolean }>();

  // Collect all battles and their target member counts.
  for (const memberId of targetMemberIds) {
    const battleId = combatState.participantBattleById?.[memberId];
    if (typeof battleId === "string" && battleId.length > 0) {
      const candidate = candidateMap.get(battleId) || { members: [], hasActiveTurn: false };
      candidate.members.push(memberId);
      candidateMap.set(battleId, candidate);
    }
  }

  // Mark if an active turn target is in each battle.
  const currentTurnId = combatState.currentTurnId;
  const activeOwnerBattleId = currentTurnId ? combatState.participantBattleById?.[currentTurnId] : undefined;
  for (const memberId of targetMemberIds) {
    const battleId = combatState.participantBattleById?.[memberId];
    if (battleId === activeOwnerBattleId && targetSet.has(memberId)) {
      const candidate = candidateMap.get(battleId);
      if (candidate) candidate.hasActiveTurn = true;
    }
  }

  // Convert to ranked list: sorted by target count (desc), then active turn (desc), then stable battleId (asc).
  const candidates = Array.from(candidateMap.entries())
    .map(([battleId, data]) => ({
      battleId,
      targetMemberCount: data.members.length,
      hasActiveTurnTarget: data.hasActiveTurn,
    }))
    .sort((a, b) => {
      if (b.targetMemberCount !== a.targetMemberCount) {
        return b.targetMemberCount - a.targetMemberCount; // More targets first.
      }
      if (b.hasActiveTurnTarget !== a.hasActiveTurnTarget) {
        return b.hasActiveTurnTarget ? 1 : -1; // Active turn holder second.
      }
      return a.battleId.localeCompare(b.battleId); // Stable fallback.
    });

  return candidates;
}

export function determineBestBattleCandidate(
  candidates: BattleCandidate[],
  currentBattleId: string | null | undefined,
): { battleId: string; rationale: BattleSelectionRationale } | null {
  if (candidates.length === 0) return null;

  // If current battle is in candidates, prefer it for stability.
  if (currentBattleId && candidates.some((c) => c.battleId === currentBattleId)) {
    return { battleId: currentBattleId, rationale: "preferred_current_battle" };
  }

  // Otherwise pick the top-ranked candidate.
  const best = candidates[0];
  if (!best) return null;

  // Determine which rationale led to this selection.
  const secondBest = candidates[1];
  if (secondBest && best.targetMemberCount === secondBest.targetMemberCount) {
    // Tie-break between same target count.
    if (best.hasActiveTurnTarget !== secondBest.hasActiveTurnTarget) {
      return { battleId: best.battleId, rationale: "active_turn_tiebreak" };
    }
    return { battleId: best.battleId, rationale: "stable_fallback" };
  }

  return { battleId: best.battleId, rationale: "target_coverage" };
}

export function recoverEncounterGateBattleContext(input: {
  combatState: PartyCombatState | null | undefined;
  battleId: string | null | undefined;
  targetMemberIds: string[];
  targetPolicyMode?: TargetPolicyMode;
}): { battleId: string | null; targetMemberIds: string[]; recovered: boolean; rationale?: BattleSelectionRationale } {
  const policyMode = input.targetPolicyMode ?? "locked_targets";
  let targetIds = getConnectedTargetMemberIds(input.targetMemberIds);

  if (!input.combatState) {
    return { battleId: input.battleId ?? null, targetMemberIds: targetIds, recovered: false };
  }

  // For live_targets mode, recompute which targets are still connected to battles.
  if (policyMode === "live_targets") {
    const connectedTargets = targetIds.filter((memberId) => {
      const battleId = input.combatState?.participantBattleById?.[memberId];
      return typeof battleId === "string" && battleId.length > 0;
    });
    if (connectedTargets.length !== targetIds.length) {
      targetIds = connectedTargets.length > 0 ? connectedTargets : [];
    }
  }

  if (targetIds.length === 0) {
    return { battleId: input.battleId ?? null, targetMemberIds: targetIds, recovered: false };
  }

  const hasTargetInCurrentBattle =
    typeof input.battleId === "string" &&
    targetIds.some((memberId) => input.combatState?.participantBattleById?.[memberId] === input.battleId);

  if (hasTargetInCurrentBattle) {
    return { battleId: input.battleId ?? null, targetMemberIds: targetIds, recovered: false };
  }

  // Under locked_targets, only recover if the new battle has ALL original targets connected.
  // Under live_targets, any battle with some targets can be recovered to.
  if (policyMode === "locked_targets") {
    const originalTargetSet = new Set(input.targetMemberIds.filter((id) => id.trim().length > 0));
    const allOriginalConnected = Array.from(originalTargetSet).every((memberId) => {
      const battleId = input.combatState?.participantBattleById?.[memberId];
      return typeof battleId === "string" && battleId.length > 0;
    });

    if (!allOriginalConnected) {
      // Locked_targets requires all original targets connected. Don't switch battles.
      return { battleId: input.battleId ?? null, targetMemberIds: targetIds, recovered: false };
    }
  }

  // Use ranked selection for recovery.
  const candidates = selectRankedBattleCandidates(input.combatState, targetIds);
  const best = determineBestBattleCandidate(candidates, input.battleId);

  if (best && best.battleId !== input.battleId) {
    return {
      battleId: best.battleId,
      targetMemberIds: targetIds,
      recovered: true,
      rationale: best.rationale,
    };
  }

  return { battleId: input.battleId ?? null, targetMemberIds: targetIds, recovered: false };
}

export function getEncounterRollCompletionState(input: {
  combatState: PartyCombatState | null | undefined;
  battleId: string | null | undefined;
  targetMemberIds: string[];
  requiredRolls: EncounterRollStatKey[];
  targetPolicyMode?: TargetPolicyMode;
}): EncounterRollCompletionState {
  const requiredRolls = uniqueRollKeys(input.requiredRolls);
  const policyMode = input.targetPolicyMode ?? "locked_targets";

  if (!input.combatState || !input.battleId || requiredRolls.length === 0) {
    const healthReasonCode: EncounterGateHealthReasonCode | undefined = !input.combatState
      ? "missing_combat_state"
      : !input.battleId
        ? "missing_battle_context"
        : undefined;
    return {
      resolvedRolls: [],
      unresolvedRolls: requiredRolls,
      canEvaluate: false,
      healthReasonCode,
      healthReason: healthReasonCode ? describeEncounterGateHealthReason(healthReasonCode) : undefined,
      evaluatedBattleId: input.battleId ?? undefined,
      targetPolicyMode: policyMode,
    };
  }

  const targetIds = [...new Set(input.targetMemberIds.filter((id) => id.trim().length > 0))];
  if (targetIds.length === 0) {
    const healthReasonCode: EncounterGateHealthReasonCode = "missing_targets";
    return {
      resolvedRolls: [],
      unresolvedRolls: requiredRolls,
      canEvaluate: false,
      healthReasonCode,
      healthReason: describeEncounterGateHealthReason(healthReasonCode),
      evaluatedBattleId: input.battleId,
      evaluatedTargetCount: 0,
      targetPolicyMode: policyMode,
    };
  }

  const hasTargetInBattle = targetIds.some((memberId) => input.combatState?.participantBattleById?.[memberId] === input.battleId);
  if (!hasTargetInBattle) {
    const healthReasonCode: EncounterGateHealthReasonCode = "stale_battle_context";
    return {
      resolvedRolls: [],
      unresolvedRolls: requiredRolls,
      canEvaluate: false,
      healthReasonCode,
      healthReason: describeEncounterGateHealthReason(healthReasonCode),
      evaluatedBattleId: input.battleId,
      evaluatedTargetCount: 0,
      targetPolicyMode: policyMode,
    };
  }

  const requests = input.combatState.rollRequests ?? [];
  const isRollResolved = (statKey: EncounterRollStatKey): boolean => {
    const matching = requests.filter((request) => {
      if (request.statKey !== statKey) return false;
      if (request.battleId !== input.battleId) return false;
      return hasExactTargetSet(targetIds, request.targetMemberIds);
    });

    return matching.some((request) =>
      targetIds.every((memberId) => request.responses.some((response) => response.memberId === memberId)),
    );
  };

  const resolvedRolls = requiredRolls.filter((roll) => isRollResolved(roll));
  const unresolvedRolls = requiredRolls.filter((roll) => !resolvedRolls.includes(roll));
  const healthReasonCode: EncounterGateHealthReasonCode | undefined = unresolvedRolls.length > 0
    ? "awaiting_responses"
    : undefined;

  // Determine battle selection rationale for metadata.
  const candidates = selectRankedBattleCandidates(input.combatState, targetIds);
  const best = determineBestBattleCandidate(candidates, input.battleId);
  const evaluationRationale = best?.rationale;

  return {
    resolvedRolls,
    unresolvedRolls,
    canEvaluate: true,
    healthReasonCode,
    healthReason: healthReasonCode ? describeEncounterGateHealthReason(healthReasonCode) : undefined,
    evaluatedBattleId: input.battleId,
    evaluatedTargetCount: targetIds.length,
    evaluationRationale,
    targetPolicyMode: policyMode,
  };
}

export async function orchestrateCampaignEncounterIntent(input: {
  partyCode: string | null | undefined;
  memberIds: string[];
  combatState: PartyCombatState | null | undefined;
  encounterIntent: CampaignRuntimeTurnEncounterIntent;
  deps: CampaignEncounterOrchestrationDeps;
}): Promise<CampaignEncounterOrchestrationResult> {
  const requiredRolls = getRequiredEncounterRolls(input.encounterIntent);

  if (!input.partyCode) {
    return {
      handled: false,
      startedNewEncounter: false,
      npcAlreadyPresent: false,
      requiredRolls,
      createdRolls: [],
      failedRolls: [],
      battleId: null,
      targetMemberIds: [],
      systemMessage: `Encounter trigger: ${input.encounterIntent.hostileCreatureName}. Join or create a party to run initiative and requested rolls.`,
      clearEncounterGate: false,
    };
  }

  const targetMemberIds = getConnectedTargetMemberIds(input.memberIds);
  if (targetMemberIds.length === 0) {
    return {
      handled: false,
      startedNewEncounter: false,
      npcAlreadyPresent: false,
      requiredRolls,
      createdRolls: [],
      failedRolls: [],
      battleId: null,
      targetMemberIds,
      systemMessage: `Encounter trigger: ${input.encounterIntent.hostileCreatureName}. No connected party members are available for roll prompts yet.`,
      clearEncounterGate: false,
    };
  }

  let battleId = selectReusableBattleId(input.combatState, targetMemberIds);
  let startedNewEncounter = false;
  if (!battleId) {
    const initiative = await input.deps.startPartyInitiative(input.partyCode, true, targetMemberIds);
    battleId = initiative.battleId;
    startedNewEncounter = true;
  }

  const npcAlreadyPresent = hasHostileNpcInBattle(
    input.combatState,
    battleId,
    input.encounterIntent,
  );
  let hostileNpcIdentity = findHostileNpcInBattle(
    input.combatState,
    battleId,
    input.encounterIntent,
  );
  const requestedCount = Math.max(1, Math.min(8, input.encounterIntent.hostileCreatureCount ?? 1));
  const hostileNpcIds = (input.combatState?.combatNpcs ?? []).filter(npc =>
    npc.disposition === "hostile" && input.combatState?.participantBattleById?.[npc.id] === battleId &&
    (npc.name === input.encounterIntent.hostileCreatureName ||
     npc.name.startsWith(input.encounterIntent.hostileCreatureName + " ") ||
     (Boolean(input.encounterIntent.hostileCreatureSourceId) && npc.sourceId === input.encounterIntent.hostileCreatureSourceId))
  ).map(npc => npc.id);
  for (let index = hostileNpcIds.length; index < requestedCount; index++) {
    const rawHostileCreatureSourceId = input.encounterIntent.hostileCreatureSourceId;
    const useMonsterSource =
      input.encounterIntent.hostileCreatureSourceType === "monster"
      && typeof rawHostileCreatureSourceId === "string"
      && rawHostileCreatureSourceId.trim().length > 0;
    const hostileCreatureSourceId = useMonsterSource
      ? rawHostileCreatureSourceId.trim()
      : "";

    const addNpcResponse = await input.deps.addCombatNpc(input.partyCode, {
      name: requestedCount > 1 ? `${input.encounterIntent.hostileCreatureName} ${index + 1}` : input.encounterIntent.hostileCreatureName,
      sourceType: useMonsterSource ? "monster" : "manual",
      ...(useMonsterSource
        ? { sourceId: hostileCreatureSourceId }
        : {}),
      disposition: "hostile",
      battleId,
      coreStats: {
        speed: 30,
        initiativeBonus: 1,
        strength: 12,
        dexterity: 12,
        constitution: 12,
        intelligence: 8,
        wisdom: 10,
        charisma: 8,
      },
      dummyState: {
        maxHp: 24,
        currentHp: 24,
        armorClass: 12,
        actionUsed: false,
      },
    });

    const npcRecord =
      typeof addNpcResponse === "object" &&
      addNpcResponse !== null &&
      "npc" in addNpcResponse &&
      typeof (addNpcResponse as { npc?: unknown }).npc === "object" &&
      (addNpcResponse as { npc?: unknown }).npc !== null
        ? ((addNpcResponse as { npc: Record<string, unknown> }).npc)
        : null;

    if (npcRecord) {
      const npcId = typeof npcRecord.id === "string" ? npcRecord.id.trim() : "";
      if (npcId.length > 0) {
        hostileNpcIdentity = {
          id: npcId,
          name: typeof npcRecord.name === "string" ? npcRecord.name : input.encounterIntent.hostileCreatureName,
          sourceType: npcRecord.sourceType === "monster" ? "monster" : "manual",
          sourceId:
            typeof npcRecord.sourceId === "string" && npcRecord.sourceId.trim().length > 0
              ? npcRecord.sourceId.trim()
              : undefined,
        };
        hostileNpcIds.push(npcId);
      }
    }
  }

  const promptRolls = [...input.encounterIntent.promptRolls];
  if (input.encounterIntent.narrationBlockedUntilResolved && !promptRolls.some((p) => p.statKey === "initiative")) {
    promptRolls.unshift({ statKey: "initiative", label: "Roll initiative" });
  }

  const createdRolls: EncounterRollStatKey[] = [];
  const failedRolls: EncounterRollStatKey[] = [];
  for (const prompt of promptRolls) {
    if (hasExistingRollRequest({
      combatState: input.combatState,
      battleId,
      statKey: prompt.statKey,
      targetMemberIds,
    })) {
      continue;
    }
    try {
      await input.deps.createPartyRollRequest(input.partyCode, {
        statKey: prompt.statKey,
        label: prompt.label,
        targetMemberIds,
        battleId,
      });
      createdRolls.push(prompt.statKey);
    } catch {
      failedRolls.push(prompt.statKey);
    }
  }

  await input.deps.refreshCombatState(input.partyCode);

  const encounterActionText = startedNewEncounter
    ? "Initiative encounter created."
    : "Reused active encounter.";
  const npcText = npcAlreadyPresent
    ? "Hostile NPC already present; duplicate spawn skipped."
    : "Hostile NPC added.";
  const createdText = createdRolls.length > 0
    ? `Roll requests created: ${createdRolls.join(", ")}.`
    : "No roll requests were created.";
  const failedText = failedRolls.length > 0
    ? `Failed requests: ${failedRolls.join(", ")}.`
    : "";

  return {
    handled: true,
    startedNewEncounter,
    npcAlreadyPresent,
    hostileNpcId: hostileNpcIdentity?.id,
    hostileNpcName: hostileNpcIdentity?.name,
    hostileNpcSourceType: hostileNpcIdentity?.sourceType,
    hostileNpcSourceId: hostileNpcIdentity?.sourceId,
    requiredRolls,
    createdRolls,
    failedRolls,
    battleId,
    targetMemberIds,
    toolMessage: `Encounter started against ${input.encounterIntent.hostileCreatureName}. ${encounterActionText} ${npcText} ${createdText} ${failedText}`.trim(),
    clearEncounterGate: false,
  };
}
