import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDeathSaveStateAfterHpChange,
  getZeroHpState,
  recordDeathSaveOutcome,
  normalizeDeathSaveState,
  resetDeathSaveState,
  stabilizeDeathSaveState,
  hasConditionNamed,
} from "../../utils/combat/zeroHpLifecycle.ts";

test("normalizeDeathSaveState clamps values and defaults", () => {
  assert.deepEqual(normalizeDeathSaveState(undefined), {
    successes: 0,
    failures: 0,
    stable: false,
    dead: false,
  });

  assert.deepEqual(normalizeDeathSaveState({ successes: 10, failures: -2, stable: true }), {
    successes: 3,
    failures: 0,
    stable: true,
    dead: false,
  });
});

test("normalizeDeathSaveState promotes three failures to dead and clears stable", () => {
  assert.deepEqual(normalizeDeathSaveState({ successes: 2, failures: 3, stable: true }), {
    successes: 2,
    failures: 3,
    stable: false,
    dead: true,
  });
});

test("computeDeathSaveStateAfterHpChange resets when dropping to 0 from above 0", () => {
  const next = computeDeathSaveStateAfterHpChange({
    previous: { successes: 2, failures: 1, stable: true },
    prevHp: 7,
    nextHp: 0,
    tookDamageWhileDowned: false,
  });

  assert.deepEqual(next, {
    successes: 0,
    failures: 0,
    stable: false,
    dead: false,
  });
});

test("computeDeathSaveStateAfterHpChange increments failure when damaged at 0 HP", () => {
  const next = computeDeathSaveStateAfterHpChange({
    previous: { successes: 1, failures: 1, stable: true },
    prevHp: 0,
    nextHp: 0,
    tookDamageWhileDowned: true,
  });

  assert.deepEqual(next, {
    successes: 1,
    failures: 2,
    stable: false,
    dead: false,
  });
});

test("computeDeathSaveStateAfterHpChange resets on healing above 0 HP", () => {
  const next = computeDeathSaveStateAfterHpChange({
    previous: { successes: 2, failures: 2, stable: false },
    prevHp: 0,
    nextHp: 4,
    tookDamageWhileDowned: false,
  });

  assert.deepEqual(next, {
    successes: 0,
    failures: 0,
    stable: false,
    dead: false,
  });
});

test("recordDeathSaveOutcome increments success and stabilizes on third success", () => {
  const progressed = recordDeathSaveOutcome({
    previous: { successes: 1, failures: 0, stable: false },
    outcome: "success",
  });
  assert.deepEqual(progressed, {
    successes: 2,
    failures: 0,
    stable: false,
    dead: false,
  });

  const stabilized = recordDeathSaveOutcome({
    previous: { successes: 2, failures: 1, stable: false },
    outcome: "success",
  });
  assert.deepEqual(stabilized, {
    successes: 3,
    failures: 1,
    stable: true,
    dead: false,
  });
});

test("recordDeathSaveOutcome increments failure, marks dead on third failure, and stops in terminal states", () => {
  const progressed = recordDeathSaveOutcome({
    previous: { successes: 0, failures: 1, stable: false },
    outcome: "failure",
  });
  assert.deepEqual(progressed, {
    successes: 0,
    failures: 2,
    stable: false,
    dead: false,
  });

  const dead = recordDeathSaveOutcome({
    previous: { successes: 1, failures: 2, stable: false },
    outcome: "failure",
  });
  assert.deepEqual(dead, {
    successes: 1,
    failures: 3,
    stable: false,
    dead: true,
  });

  const stableNoOp = recordDeathSaveOutcome({
    previous: { successes: 3, failures: 0, stable: true },
    outcome: "failure",
  });
  assert.deepEqual(stableNoOp, {
    successes: 3,
    failures: 0,
    stable: true,
    dead: false,
  });

  const deadNoOp = recordDeathSaveOutcome({
    previous: { successes: 1, failures: 3, stable: false, dead: true },
    outcome: "success",
  });
  assert.deepEqual(deadNoOp, {
    successes: 1,
    failures: 3,
    stable: false,
    dead: true,
  });
});

test("stabilizeDeathSaveState marks downed creature stable without clearing counters", () => {
  const next = stabilizeDeathSaveState({ successes: 1, failures: 1, stable: false });
  assert.deepEqual(next, {
    successes: 1,
    failures: 1,
    stable: true,
    dead: false,
  });
});

test("stabilizeDeathSaveState does not alter dead state", () => {
  const next = stabilizeDeathSaveState({ successes: 1, failures: 3, stable: false, dead: true });
  assert.deepEqual(next, {
    successes: 1,
    failures: 3,
    stable: false,
    dead: true,
  });
});

test("resetDeathSaveState clears tracking explicitly", () => {
  assert.deepEqual(resetDeathSaveState(), {
    successes: 0,
    failures: 0,
    stable: false,
    dead: false,
  });
});

test("getZeroHpState distinguishes conscious, dying, stable, and dead states", () => {
  assert.equal(getZeroHpState({ currentHp: 5, deathSaves: undefined }), "conscious");
  assert.equal(getZeroHpState({ currentHp: 0, deathSaves: { successes: 0, failures: 1, stable: false } }), "dying");
  assert.equal(getZeroHpState({ currentHp: 0, deathSaves: { successes: 3, failures: 0, stable: true } }), "stable");
  assert.equal(getZeroHpState({ currentHp: 0, deathSaves: { successes: 1, failures: 3, stable: false } }), "dead");
});

test("hasConditionNamed ignores case and whitespace", () => {
  const conditions = [
    { id: "1", name: " Poisoned ", removeOn: ["manual"] },
    { id: "2", name: "Unconscious", removeOn: ["manual"] },
  ];

  assert.equal(hasConditionNamed(conditions, "poisoned"), true);
  assert.equal(hasConditionNamed(conditions, " unconscious "), true);
  assert.equal(hasConditionNamed(conditions, "blinded"), false);
});
