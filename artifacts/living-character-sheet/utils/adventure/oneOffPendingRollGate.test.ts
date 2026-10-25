import assert from "node:assert/strict";
import test from "node:test";
import { shouldBlockStoryInputForPendingRolls } from "./oneOffPendingRollGate";

test("one-off with outstanding targeted rolls blocks story input", () => {
  assert.equal(shouldBlockStoryInputForPendingRolls({ isOneOff: true, pendingTargetedRollCount: 1 }), true);
  assert.equal(shouldBlockStoryInputForPendingRolls({ isOneOff: true, pendingTargetedRollCount: 3 }), true);
});

test("resolved one-off and campaign routes keep independent input policies", () => {
  assert.equal(shouldBlockStoryInputForPendingRolls({ isOneOff: true, pendingTargetedRollCount: 0 }), false);
  assert.equal(shouldBlockStoryInputForPendingRolls({ isOneOff: false, pendingTargetedRollCount: 1 }), false);
});
