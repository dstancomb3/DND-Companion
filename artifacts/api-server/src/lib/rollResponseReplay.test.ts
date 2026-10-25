import assert from "node:assert/strict";
import test from "node:test";
import { classifyRepeatedRoll } from "./rollResponseReplay";

test("first roll is accepted, identical retry is a replay", () => {
  const roll = { roll: 14, modifier: 3, total: 17 };
  assert.equal(classifyRepeatedRoll(undefined, roll), "new");
  assert.equal(classifyRepeatedRoll(roll, { ...roll }), "replay");
});

test("changed roll, modifier or total cannot replace a recorded response", () => {
  const prior = { roll: 14, modifier: 3, total: 17 };
  assert.equal(classifyRepeatedRoll(prior, { ...prior, roll: 15 }), "conflict");
  assert.equal(classifyRepeatedRoll(prior, { ...prior, modifier: 4 }), "conflict");
  assert.equal(classifyRepeatedRoll(prior, { ...prior, total: 18 }), "conflict");
});
