import assert from "node:assert/strict";
import test from "node:test";
import { createRollSubmissionGate } from "./aiDmRollSubmissionGate";

test("the same roll cannot be submitted twice until released", () => {
  const gate = createRollSubmissionGate();
  assert.equal(gate.begin("roll-1"), true);
  assert.equal(gate.begin("roll-1"), false);
  assert.equal(gate.begin("roll-2"), true);
  gate.end("roll-1");
  assert.equal(gate.begin("roll-1"), true);
  gate.end("roll-1");
  gate.end("roll-2");
});

test("rejected empty ids and duplicate cleanup do not block future rolls", () => {
  const gate = createRollSubmissionGate();
  assert.equal(gate.begin(""), false);
  gate.end("x");
  assert.equal(gate.begin("x"), true);
  gate.end("x");
  gate.end("x");
  assert.equal(gate.begin("x"), true);
});
