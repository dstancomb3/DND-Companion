import assert from "node:assert/strict";
import test from "node:test";
import { shouldResumeNarrationAfterRoll } from "./aiDmRollContinuation";

const ready = {
  confirmed: true,
  isInitiative: false,
  encounterGateActive: false,
  remainingTargetedRolls: 0,
};

test("only confirmed final non-encounter check resumes narration", () => {
  assert.equal(shouldResumeNarrationAfterRoll(ready), true);
  assert.equal(shouldResumeNarrationAfterRoll({ ...ready, confirmed: false }), false);
  assert.equal(shouldResumeNarrationAfterRoll({ ...ready, isInitiative: true }), false);
  assert.equal(shouldResumeNarrationAfterRoll({ ...ready, encounterGateActive: true }), false);
  assert.equal(shouldResumeNarrationAfterRoll({ ...ready, remainingTargetedRolls: 1 }), false);
});
