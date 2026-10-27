import assert from "node:assert/strict";
import test from "node:test";
const { planNpcBehavior } = require("../../utils/combat/npcBehaviorBrain");

const readiness = { status: "ready", npcId: "guard", battleId: "battle", choices: [
  { weaponId: "sword", weaponName: "Sword", targetId: "lyra", attackBonus: 5, damageDice: "1d8", damageModifier: 3, damageType: "slashing" },
  { weaponId: "club", weaponName: "Club", targetId: "lyra", attackBonus: 2, damageDice: "1d4", damageModifier: 1, damageType: "bludgeoning" },
] };
test("aggressive profiles propose a stable attack without executing combat", () => {
  const input = { profile: "aggressive", readiness, commandSeed: "round:1" };
  assert.deepEqual(planNpcBehavior(input), planNpcBehavior(input));
  assert.equal(planNpcBehavior(input).kind, "attack");
});
test("passive refuses hostilities and sneaky repositions", () => {
  assert.equal(planNpcBehavior({ profile: "passive", readiness, commandSeed: "1" }).kind, "hold");
  assert.equal(planNpcBehavior({ profile: "sneaky", readiness, commandSeed: "1" }).kind, "reposition");
});
test("low-health cautious combatants retreat", () => {
  assert.equal(planNpcBehavior({ profile: "cautious", readiness, hpFraction: 0.2, commandSeed: "1" }).kind, "retreat");
});
test("NPCs with no legal actions require adjudication", () => {
  const blocked = { status: "needs_adjudication", npcId: "guard", battleId: "battle", reason: "no_valid_attack" };
  assert.equal(planNpcBehavior({ profile: "aggressive", readiness: blocked, commandSeed: "1" }).kind, "hold");
});
