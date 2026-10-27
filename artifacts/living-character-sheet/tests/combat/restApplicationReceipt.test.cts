import test from "node:test";
import assert from "node:assert/strict";
const { readRestApplicationPhase, restApplicationNextStep } = require("../../utils/adventure/restApplicationReceipt");
test("new rest can apply exactly once on ordinary retry", () => {
 assert.equal(restApplicationNextStep(readRestApplicationPhase(null)), "apply");
 assert.equal(restApplicationNextStep(readRestApplicationPhase("applied")), "ack");
 assert.equal(restApplicationNextStep(readRestApplicationPhase("1")), "ack");
});
test("incomplete or invalid local receipt must not replay or acknowledge", () => {
 for (const marker of ["applying", "unexpected", ""]) {
  assert.equal(restApplicationNextStep(readRestApplicationPhase(marker)), "review");
 }
});
