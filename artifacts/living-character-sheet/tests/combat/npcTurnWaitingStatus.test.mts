import assert from "node:assert/strict";
import test from "node:test";
import { getNpcTurnWaitingStatus } from "../../utils/combat/npcTurnWaitingStatus.ts";

const npc = {
  id: "wolf", name: "Wolf", sourceType: "monster" as const, disposition: "hostile" as const,
  coreStats: { speed: 40, initiativeBonus: 2, strength: 12, dexterity: 15, constitution: 12, intelligence: 3, wisdom: 12, charisma: 6 },
  visibleStatKeys: [], createdAt: "2026-01-01T00:00:00Z", gear: [],
};
const state = {
  currentTurnIdByBattle: { battle: "wolf" },
  participantBattleById: { wolf: "battle", hero: "battle" },
  combatNpcs: [npc],
};
test("names stalled NPC and reports missing supported action without advancing", () => {
  const result = getNpcTurnWaitingStatus(state as any, "battle", ["hero"]);
  assert.equal(result.kind, "npc_turn");
  if (result.kind !== "npc_turn") return;
  assert.equal(result.npcName, "Wolf");
  assert.match(result.detail, /no fully configured executable weapon/);
  assert.equal(result.canResolveAutomatically, false);
  assert.equal(state.currentTurnIdByBattle.battle, "wolf");
});
test("does not display NPC wait state on player's turn", () => {
  assert.deepEqual(getNpcTurnWaitingStatus({ ...state, currentTurnIdByBattle: { battle: "hero" } } as any, "battle", ["hero"]), { kind: "not_waiting" });
  assert.deepEqual(getNpcTurnWaitingStatus(null, "battle", ["hero"]), { kind: "not_waiting" });
});
