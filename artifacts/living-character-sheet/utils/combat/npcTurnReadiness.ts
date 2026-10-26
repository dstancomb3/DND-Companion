import type { CombatNpc, PartyCombatState } from "../../partyApi";

export type NpcTurnReadiness =
  | { status: "not_npc_turn" }
  | { status: "needs_adjudication"; npcId: string; battleId: string; reason: "incapacitated" | "no_valid_attack" | "no_eligible_targets" | "unsupported_actor" }
  | { status: "ready"; npcId: string; battleId: string; choices: NpcAttackChoice[] };

export interface NpcAttackChoice {
  weaponId: string;
  weaponName: string;
  targetId: string;
  attackBonus: number;
  damageDice: string;
  damageModifier: number;
  damageType: string;
}

/**
 * Read-only action projection for the AI DM. This does not execute an attack,
 * roll dice, mutate HP or advance initiative. The server executor must
 * revalidate the actor/turn/weapon/targets and commit a receipt atomically.
 */
export function planNpcAttackChoices(
  state: Pick<PartyCombatState, "currentTurnIdByBattle" | "participantBattleById" | "combatNpcs">,
  battleId: string,
  eligibleMemberIds: string[],
): NpcTurnReadiness {
  const actorId = state.currentTurnIdByBattle?.[battleId];
  if (!actorId) return { status: "not_npc_turn" };
  const npc = state.combatNpcs.find((candidate) => candidate.id === actorId);
  if (!npc) return { status: "not_npc_turn" };
  if (npc.projection?.combatantKind === "companion" || npc.disposition !== "hostile") {
    return { status: "needs_adjudication", npcId: npc.id, battleId, reason: "unsupported_actor" };
  }
  if ((npc.conditions ?? []).some(c => /^(stunned|paralyzed|incapacitated|unconscious|petrified)$/i.test(c.name))
    || (npc.dummyState && npc.dummyState.currentHp <= 0)) {
    return { status: "needs_adjudication", npcId: npc.id, battleId, reason: "incapacitated" };
  }
  const weapons = (npc.gear ?? []).filter((gear) =>
    gear.category === "weapon" && gear.equipped
    && typeof gear.attackBonus === "number" && Number.isFinite(gear.attackBonus)
    && typeof gear.damageDice === "string" && /^(?:[1-9]\d*d[2468]|[1-9]\d*d10|[1-9]\d*d12)(?:\s*[+\-]\s*\d+)?$/i.test(gear.damageDice.trim())
    && typeof gear.damageType === "string" && gear.damageType.length > 0
    && (gear.range ?? "").trim().length > 0,
  );
  if (!weapons.length) return { status: "needs_adjudication", npcId: npc.id, battleId, reason: "no_valid_attack" };
  const targets = [...new Set(eligibleMemberIds)].filter(id => id !== npc.id && state.participantBattleById[id] === battleId);
  if (!targets.length) return { status: "needs_adjudication", npcId: npc.id, battleId, reason: "no_eligible_targets" };
  return {
    status: "ready", npcId: npc.id, battleId,
    choices: weapons.flatMap((weapon) => targets.map((targetId) => ({
      weaponId: weapon.id,
      weaponName: weapon.name,
      targetId,
      attackBonus: weapon.attackBonus!,
      damageDice: weapon.damageDice!,
      damageModifier: weapon.damageModifier ?? 0,
      damageType: weapon.damageType!,
    }))),
  };
}
