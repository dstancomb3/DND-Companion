import assert from "node:assert/strict";
import test from "node:test";
import { extractCommittedNpcNarrationFacts } from "../../utils/combat/npcCommittedNarration.ts";

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
