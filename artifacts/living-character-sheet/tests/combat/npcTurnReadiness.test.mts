import assert from "node:assert/strict";
import test from "node:test";
import { planNpcAttackChoices } from "../../utils/combat/npcTurnReadiness.ts";

const hostile = {
  id: "goblin", name: "Goblin", sourceType: "monster" as const, disposition: "hostile" as const,
  coreStats: { speed: 30, initiativeBonus: 2, strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
  visibleStatKeys: [], createdAt: new Date(0).toISOString(),
  gear: [{ id: "shortbow", name: "Shortbow", category: "weapon" as const, equipped: true,
    attackBonus: 4, damageDice: "1d6", damageModifier: 2, damageType: "piercing", range: "80/320 ft" }],
};
const state = { currentTurnIdByBattle: { battle: "goblin" }, participantBattleById: { goblin: "battle", hero: "battle", outsider: "other" }, combatNpcs: [hostile] };

test("offers equipped weapon against eligible same-battle players only", () => {
  const result = planNpcAttackChoices(state, "battle", ["hero", "outsider", "hero"]);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.choices.length, 1);
  assert.deepEqual(result.choices[0], {
    weaponId: "shortbow", weaponName: "Shortbow", targetId: "hero",
    attackBonus: 4, damageDice: "1d6", damageModifier: 2, damageType: "piercing",
  });
});
test("does not plan a player turn or unsupported friendly actor", () => {
  assert.deepEqual(planNpcAttackChoices({ ...state, currentTurnIdByBattle: { battle: "hero" } }, "battle", ["hero"]), { status: "not_npc_turn" });
  const friendly = { ...hostile, disposition: "friendly" as const };
  assert.equal(planNpcAttackChoices({ ...state, combatNpcs: [friendly] }, "battle", ["hero"]).status, "needs_adjudication");
});
test("never invents missing weapon data or targets", () => {
  const missingGear = { ...hostile, gear: [] };
  assert.deepEqual(planNpcAttackChoices({ ...state, combatNpcs: [missingGear] }, "battle", ["hero"]), {
    status: "needs_adjudication", npcId: "goblin", battleId: "battle", reason: "no_valid_attack",
  });
  assert.deepEqual(planNpcAttackChoices(state, "battle", ["outsider"]), {
    status: "needs_adjudication", npcId: "goblin", battleId: "battle", reason: "no_eligible_targets",
  });
});
test("incapacitated NPC requires adjudication, not automatic skip", () => {
  const disabled = { ...hostile, conditions: [{ id: "stun", name: "Stunned" }] };
  assert.deepEqual(planNpcAttackChoices({ ...state, combatNpcs: [disabled] }, "battle", ["hero"]), {
    status: "needs_adjudication", npcId: "goblin", battleId: "battle", reason: "incapacitated",
  });
});
