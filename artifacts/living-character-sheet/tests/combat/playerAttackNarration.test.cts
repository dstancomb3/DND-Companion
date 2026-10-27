import assert from "node:assert/strict";
import test from "node:test";
const { buildConfirmedPlayerAttackNarration } = require("../../utils/combat/playerAttackNarration");

function action(status = "hit", damage = 7, extras: any = {}) {
  return {
    commandId: "committed-attack-123",
    status: "accepted",
    remoteApplication: { ok: true, replayed: false, appliedCount: 1,
      targetResults: [{ targetId: "guard", status: "applied", requestIndex: 0 }] },
    targetResults: [{
      targetId: "guard",
      hitOutcome: { status },
      damageBreakdown: damage === null ? undefined : {
        hpDamage: damage, rawTotal: damage, adjustedTotal: damage,
        tempHpAbsorbed: 0, packets: [{ damageType: "bludgeoning", immune: false, resisted: false }]
      },
    }],
    ...extras,
  };
}
function narrate(result: any, attackName = "Quarterstaff") {
  return buildConfirmedPlayerAttackNarration({
    actorName: "Lyra", attackName, targets: [{ id: "guard", name: "Guard" }], result,
  });
}
test("confirmed hit describes weapon action, target and damage without AI call", () => {
  const result = action();
  const text = narrate(result)!;
  assert.match(text, /Lyra/);
  assert.match(text, /Quarterstaff/);
  assert.match(text, /Guard/);
  assert.match(text, /7 bludgeoning damage/);
  assert.equal(narrate(result), text);
});
test("miss never says hit or damage dealt", () => {
  const text = narrate(action("miss", null))!;
  assert.match(text, /misses|avoids|goes wide/);
  assert.doesNotMatch(text, /dealing [0-9]+/);
});
test("damage immunity and resistance are distinguished", () => {
  const immune = action("hit", 0);
  immune.targetResults[0].damageBreakdown.rawTotal = 10;
  immune.targetResults[0].damageBreakdown.adjustedTotal = 0;
  immune.targetResults[0].damageBreakdown.packets[0].immune = true;
  assert.match(narrate(immune)!, /immune/);
  const resisted = action("hit", 3);
  resisted.targetResults[0].damageBreakdown.packets[0].resisted = true;
  assert.match(narrate(resisted)!, /resisted/);
});
test("missing outcome data does not fabricate damage", () => {
  const text = narrate(action("unresolved", null))!;
  assert.match(text, /unresolved/);
  assert.doesNotMatch(text, /dealing [0-9]+/);
});
test("replays, rejects and uncommitted targets produce no narration", () => {
  assert.equal(narrate(action("hit", 7, { status: "rejected" })), null);
  assert.equal(narrate(action("hit", 7, { remoteApplication: { ok: true, replayed: true, appliedCount: 1 } })), null);
  assert.equal(narrate(action("hit", 7, { remoteApplication: { ok: true, replayed: false, appliedCount: 0, targetResults: [] } })), null);
});

test("critical wording requires a confirmed natural twenty, not an assumed critical", () => {
  const result = action("hit", 12);
  result.targetResults[0].hitOutcome.attackRoll = 20;
  assert.match(narrate(result)!, /critical strike/i);
  result.targetResults[0].hitOutcome.attackRoll = 19;
  assert.doesNotMatch(narrate(result)!, /critical strike/i);
});
