import assert from "node:assert/strict";
import test from "node:test";
import { validateAiRestApproval } from "./restSceneSafety";

const safe = { dangerScore: 5, shortRestFeasible: true, longRestFeasible: true, reason: "Sheltered and secure." };
test("AI short rest accepts moderate safety but long rest requires higher safety", () => {
  assert.equal(validateAiRestApproval("short_rest", { ...safe, dangerScore: 28, longRestFeasible: false }).ok, true);
  assert.equal(validateAiRestApproval("long_rest", { ...safe, dangerScore: 28 }).ok, false);
});
test("AI long rest needs explicit feasibility and low danger", () => {
  assert.equal(validateAiRestApproval("long_rest", safe).ok, true);
  assert.equal(validateAiRestApproval("long_rest", { ...safe, longRestFeasible: false }).ok, false);
});
test("unassessed, invalid and dangerous scenes fail closed", () => {
  assert.equal(validateAiRestApproval("short_rest", null).ok, false);
  assert.equal(validateAiRestApproval("short_rest", { ...safe, dangerScore: 101 }).ok, false);
  assert.equal(validateAiRestApproval("short_rest", { ...safe, dangerScore: 60 }).ok, false);
});
