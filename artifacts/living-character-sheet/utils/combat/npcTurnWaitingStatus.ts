import type { PartyCombatState } from "../partyApi";
import { planNpcAttackChoices } from "./npcTurnReadiness";

export type NpcTurnWaitingStatus =
  | { kind: "not_waiting" }
  | { kind: "npc_turn"; npcId: string; npcName: string; battleId: string; detail: string; canResolveAutomatically: false };

/**
 * Explicitly describes an NPC turn rather than implying that the engine is
 * executing it. The endpoint is not auto-invoked until distance/LOS and
 * full combatant action legality can be authenticated.
 */
export function getNpcTurnWaitingStatus(
  state: PartyCombatState | null | undefined,
  battleId: string | null,
  memberIds: string[],
): NpcTurnWaitingStatus {
  if (!state || !battleId) return { kind: "not_waiting" };
  const currentId = state.currentTurnIdByBattle?.[battleId];
  const npc = state.combatNpcs.find(entry => entry.id === currentId);
  if (!npc) return { kind: "not_waiting" };
  const plan = planNpcAttackChoices(state, battleId, memberIds);
  const detail = plan.status === "ready"
    ? "NPC attacks are configured, but range, visibility and action legality require DM adjudication."
    : plan.status === "needs_adjudication"
      ? ({
        incapacitated: "This creature cannot currently take a normal action.",
        no_valid_attack: "This creature has no fully configured executable weapon attack.",
        no_eligible_targets: "There are no eligible player targets in this encounter.",
        unsupported_actor: "This combatant needs DM or owner control.",
      } as const)[plan.reason]
      : "The current combatant needs DM adjudication.";
  return { kind: "npc_turn", npcId: npc.id, npcName: npc.name, battleId, detail, canResolveAutomatically: false };
}
