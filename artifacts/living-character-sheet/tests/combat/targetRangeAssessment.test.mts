import assert from "node:assert/strict";
import test from "node:test";
import { assessTargetRange } from "../../utils/combat/targetRangeAssessment.ts";
test("identifies melee reach from confirmed distance", () => {
  assert.equal(assessTargetRange("melee", 5), "normal");
  assert.equal(assessTargetRange("melee", 10), "out_of_range");
  assert.equal(assessTargetRange("reach 10 ft", 10), "normal");
});
test("distinguishes normal, disadvantage, and out of range", () => {
  assert.equal(assessTargetRange("80/320 ft", 60), "normal");
  assert.equal(assessTargetRange("80/320 ft", 90), "long_disadvantage");
  assert.equal(assessTargetRange("80/320 ft", 321), "out_of_range");
});
test("does not guess range from unknown values", () => {
  assert.equal(assessTargetRange("80/320 ft", null), "unknown");
  assert.equal(assessTargetRange("unparsed", 10), "unknown");
  assert.equal(assessTargetRange(undefined, 10), "unknown");
});
