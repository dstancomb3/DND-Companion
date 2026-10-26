import type { PartyCombatState } from "../partyApi";
import { buildCombatantCapabilityCatalog, hasExecutableAttackDefinition } from "./combatantCapabilityCatalog";

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
  const catalog = buildCombatantCapabilityCatalog({
    combatantId: npc.id,
    inventory: (npc.gear ?? []).map((item) => ({
      id: item.id, name: item.name, category: item.category,
      quantity: 1, equipped: item.equipped,
      attackBonus: item.attackBonus, damageDice: item.damageDice,
      damageModifier: item.damageModifier, damageType: item.damageType,
      range: item.range,
    })),
  });
  const weapons = catalog.capabilities.filter(hasExecutableAttackDefinition);
  if (!weapons.length) return { status: "needs_adjudication", npcId: npc.id, battleId, reason: "no_valid_attack" };
  const targets = [...new Set(eligibleMemberIds)].filter(id => id !== npc.id && state.participantBattleById[id] === battleId);
  if (!targets.length) return { status: "needs_adjudication", npcId: npc.id, battleId, reason: "no_eligible_targets" };
  return {
    status: "ready", npcId: npc.id, battleId,
    choices: weapons.flatMap((weapon) => targets.map((targetId) => ({
      weaponId: weapon.sourceId,
      weaponName: weapon.name,
      targetId,
      attackBonus: weapon.mechanics!.attackBonus!,
      damageDice: weapon.mechanics!.damageDice!,
      damageModifier: weapon.mechanics!.damageModifier!,
      damageType: weapon.mechanics!.damageType!,
    }))),
  };
}
