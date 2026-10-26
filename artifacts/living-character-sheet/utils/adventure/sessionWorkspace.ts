import type { PartyCombatState, PartyMemberSummary } from "../partyApi";

export type SessionMode = "human_dm" | "ai_one_off" | "ai_campaign";
export type HostCapabilityStatus = "checking" | "present" | "absent";

// Presentation capabilities only. Every command still requires server proof.
export interface SessionAuthority {
  role: "disconnected" | "checking" | "host" | "member";
  canManageEncounter: boolean;
  canOrchestrateAi: boolean;
}

export function projectSessionAuthority(input: {
  mode: SessionMode;
  connected: boolean;
  hostCapability: HostCapabilityStatus;
}): SessionAuthority {
  const role = !input.connected ? "disconnected"
    : input.hostCapability === "checking" ? "checking"
    : input.hostCapability === "present" ? "host" : "member";
  return {
    role,
    canManageEncounter: role === "host",
    canOrchestrateAi: role === "host" && input.mode !== "human_dm",
  };
}

export interface SessionEncounterView {
  status: "disconnected" | "loading" | "exploration" | "combat";
  battleId: string | null;
  currentActorName: string | null;
  isPlayerTurn: boolean;
  participantCount: number;
}

// Initial shared view-model slice. Narrative, inventory and objectives still use
// their existing owners; this projection does not create another runtime.
export interface SessionViewModel {
  mode: SessionMode;
  encounter: SessionEncounterView;
}

export function projectSessionView(input: {
  mode: SessionMode;
  partyCode: string | null;
  memberId: string | null;
  members: readonly PartyMemberSummary[];
  combatState: PartyCombatState | null;
}): SessionViewModel {
  const state = input.combatState?.code === input.partyCode ? input.combatState : null;
  const battleId = input.memberId && state?.participantBattleById[input.memberId] || null;
  const currentId = battleId ? state?.currentTurnIdByBattle[battleId] ?? null : null;
  const currentActorName = currentId
    ? input.members.find(m => m.partyCode === input.partyCode && m.id === currentId)?.characterName
      ?? state?.combatNpcs.find(n => n.id === currentId)?.name ?? "Combatant"
    : null;
  return {
    mode: input.mode,
    encounter: {
      status: !input.partyCode ? "disconnected" : !state ? "loading" : battleId ? "combat" : "exploration",
      battleId,
      currentActorName,
      isPlayerTurn: Boolean(currentId && currentId === input.memberId),
      participantCount: battleId ? state?.battleTurnOrderById[battleId]?.length ?? 0 : 0,
    },
  };
}
