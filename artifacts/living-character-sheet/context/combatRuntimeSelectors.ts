import type { PartyCombatState, PlayerTurnEconomy, CombatNpc } from "@/utils/partyApi";

export function selectMemberBattleId(
  combatState: PartyCombatState | null | undefined,
  memberId: string | null | undefined
): string | null {
  if (!combatState || !memberId) return null;
  return combatState.participantBattleById?.[memberId] ?? null;
}

export function selectBattleTurnOrder(
  combatState: PartyCombatState | null | undefined,
  battleId: string | null | undefined
): string[] {
  if (!combatState || !battleId) return [];
  return combatState.battleTurnOrderById?.[battleId] ?? [];
}

export function selectBattleCurrentTurnId(
  combatState: PartyCombatState | null | undefined,
  battleId: string | null | undefined
): string | null {
  if (!combatState || !battleId) return null;
  return combatState.currentTurnIdByBattle?.[battleId] ?? null;
}

export function selectMemberEconomy(
  combatState: PartyCombatState | null | undefined,
  memberId: string | null | undefined
): PlayerTurnEconomy | null {
  if (!combatState || !memberId) return null;
  return combatState.playerEconomyByMember?.[memberId] ?? null;
}

export function selectBattleNpcs(
  combatState: PartyCombatState | null | undefined,
  battleId: string | null | undefined
): CombatNpc[] {
  if (!combatState) return [];
  if (!battleId) return combatState.combatNpcs ?? [];
  const participantBattleById = combatState.participantBattleById ?? {};
  return (combatState.combatNpcs ?? []).filter((npc) => participantBattleById[npc.id] === battleId);
}
