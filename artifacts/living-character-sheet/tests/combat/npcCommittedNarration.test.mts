import assert from "node:assert/strict";
import test from "node:test";
import { committedWeaponTurnToNarrationFacts, extractCommittedNpcNarrationFacts } from "../../utils/combat/npcCommittedNarration.ts";

const receipt = {
  schemaVersion: 1, status: "committed", commandId: "turn-1",
  battleId: "battle", npcId: "goblin", actionId: "bow",
  sourceRevision: 9, committedRevision: 10, nextTurnId: "hero",
  result: { kind: "attack", outcome: "hit", targetIds: ["hero"], damageApplied: 6, damageType: "piercing" },
};
test("narration facts come from committed outcome, not intended roll", () => {
  assert.deepEqual(extractCommittedNpcNarrationFacts(receipt), {
    receiptId: "turn-1", npcId: "goblin", actionId: "bow",
    outcome: "hit", targetIds: ["hero"], damageApplied: 6, damageType: "piercing",
  });
});
test("never narrate preview, uncommitted or stale revision", () => {
  assert.equal(extractCommittedNpcNarrationFacts({ ...receipt, status: "preview" }), null);
  assert.equal(extractCommittedNpcNarrationFacts({ ...receipt, committedRevision: 9 }), null);
  assert.equal(extractCommittedNpcNarrationFacts({ ...receipt, commandId: "" }), null);
});
test("rejects invalid damage and target payloads", () => {
  assert.equal(extractCommittedNpcNarrationFacts({ ...receipt, result: { ...receipt.result, damageApplied: -1 } }), null);
  assert.equal(extractCommittedNpcNarrationFacts({ ...receipt, result: { ...receipt.result, targetIds: [null] } }), null);
});

const committedWeaponResponse = {
  ok: true, replayed: false, receipt: {
    schemaVersion: 1, status: "committed", commandId: "npc-42", battleId: "battle",
    npcId: "goblin", weaponId: "shortbow", targetMemberId: "hero",
    sourceRevision: 10, committedRevision: 11, naturalRoll: 18,
    attackTotal: 22, hit: true, critical: false, damageApplied: 5,
    damageToHp: 3, damageType: "piercing", nextTurnId: "hero",
  },
};
test("adapts only committed server weapon receipts for narration", () => {
  assert.deepEqual(committedWeaponTurnToNarrationFacts(committedWeaponResponse), {
    receiptId: "npc-42", npcId: "goblin", actionId: "shortbow",
    outcome: "hit", targetIds: ["hero"], damageApplied: 5, damageType: "piercing",
  });
  assert.equal(committedWeaponTurnToNarrationFacts({ ...committedWeaponResponse, ok: false }), null);
  assert.equal(committedWeaponTurnToNarrationFacts({ ...committedWeaponResponse, receipt: { ...committedWeaponResponse.receipt, status: "preview" } }), null);
  assert.equal(committedWeaponTurnToNarrationFacts({ ...committedWeaponResponse, receipt: { ...committedWeaponResponse.receipt, damageApplied: -1 } }), null);
});
