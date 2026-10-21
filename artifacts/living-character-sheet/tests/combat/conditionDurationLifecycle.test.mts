import assert from "node:assert/strict";
import test from "node:test";

import {
  initializeConditionDuration,
  normalizeConditionDuration,
  shouldConditionExpire,
  decrementConditionDuration,
  getConditionDurationDisplay,
} from "../../utils/combat/conditionDurationLifecycle";
import type { ActiveCondition } from "../../types";

function createTestCondition(overrides: Partial<ActiveCondition> = {}): ActiveCondition {
  return {
    id: "test-1",
    name: "Test Condition",
    removeOn: ["manual"],
    ...overrides,
  };
}

test("initializeConditionDuration sets duration fields safely", () => {
  const cond = createTestCondition();

  const withRounds = initializeConditionDuration(cond, "rounds", 3);
  assert.equal(withRounds.durationType, "rounds");
  assert.equal(withRounds.durationValue, 3);
  assert.equal(withRounds.remainingDuration, 3);

  const withTurns = initializeConditionDuration(cond, "turns", 2);
  assert.equal(withTurns.durationType, "turns");
  assert.equal(withTurns.durationValue, 2);
  assert.equal(withTurns.remainingDuration, 2);

  // Manual and permanent are no-ops
  const withManual = initializeConditionDuration(cond, "manual");
  assert.equal(withManual.durationType, undefined);
  assert.equal(withManual.durationValue, undefined);

  const withPermanent = initializeConditionDuration(cond, "permanent");
  assert.equal(withPermanent.durationType, undefined);
});

test("initializeConditionDuration defaults value to 1 if not provided", () => {
  const cond = createTestCondition();
  const result = initializeConditionDuration(cond, "rounds");
  assert.equal(result.durationValue, 1);
  assert.equal(result.remainingDuration, 1);
});

test("initializeConditionDuration ignores invalid values", () => {
  const cond = createTestCondition();
  const result = initializeConditionDuration(cond, "rounds", 0);
  // Should not initialize if value is <= 0
  assert.equal(result.durationType, undefined);
});

test("normalizeConditionDuration fixes missing fields", () => {
  const cond = createTestCondition({ durationType: "rounds" });
  const normalized = normalizeConditionDuration(cond);

  assert.equal(normalized.durationType, "rounds");
  assert.equal(normalized.durationValue, 1);
  assert.equal(normalized.remainingDuration, 1);
  assert.equal(normalized.tickTiming, "onTargetTurnEnd");
});

test("normalizeConditionDuration preserves valid fields", () => {
  const cond = createTestCondition({
    durationType: "rounds",
    durationValue: 4,
    remainingDuration: 2,
    tickTiming: "onRoundAdvance",
  });
  const normalized = normalizeConditionDuration(cond);

  assert.equal(normalized.durationType, "rounds");
  assert.equal(normalized.durationValue, 4);
  assert.equal(normalized.remainingDuration, 2);
  assert.equal(normalized.tickTiming, "onRoundAdvance");
});

test("shouldConditionExpire returns false for manual/permanent", () => {
  const manual = createTestCondition({ durationType: "manual" });
  assert.equal(shouldConditionExpire(manual), false);

  const permanent = createTestCondition({ durationType: "permanent" });
  assert.equal(shouldConditionExpire(permanent), false);
});

test("shouldConditionExpire detects zero or negative remaining duration", () => {
  const expired = createTestCondition({
    durationType: "rounds",
    remainingDuration: 0,
  });
  assert.equal(shouldConditionExpire(expired), true);

  const alsoExpired = createTestCondition({
    durationType: "rounds",
    remainingDuration: -1,
  });
  assert.equal(shouldConditionExpire(alsoExpired), true);

  const notExpired = createTestCondition({
    durationType: "rounds",
    remainingDuration: 1,
  });
  assert.equal(shouldConditionExpire(notExpired), false);
});

test("decrementConditionDuration reduces remaining by 1", () => {
  const cond = createTestCondition({
    durationType: "rounds",
    remainingDuration: 3,
  });

  const { condition: after1, expired: exp1 } = decrementConditionDuration(cond);
  assert.equal(after1.remainingDuration, 2);
  assert.equal(exp1, false);

  const { condition: after2, expired: exp2 } = decrementConditionDuration(after1);
  assert.equal(after2.remainingDuration, 1);
  assert.equal(exp2, false);

  const { condition: after3, expired: exp3 } = decrementConditionDuration(after2);
  assert.equal(after3.remainingDuration, 0);
  assert.equal(exp3, true);
});

test("decrementConditionDuration handles manual/permanent safely", () => {
  const manual = createTestCondition({ durationType: "manual" });
  const { condition: result, expired } = decrementConditionDuration(manual);
  assert.equal(result.durationType, "manual");
  assert.equal(expired, false);
});

test("decrementConditionDuration handles missing remainingDuration", () => {
  const cond = createTestCondition({ durationType: "rounds" });
  const { condition: result, expired } = decrementConditionDuration(cond);
  assert.equal(result, cond);
  assert.equal(expired, false);
});

test("getConditionDurationDisplay shows human-readable remaining", () => {
  const rounds2 = createTestCondition({
    durationType: "rounds",
    remainingDuration: 2,
  });
  assert.equal(getConditionDurationDisplay(rounds2), "2 rounds remaining");

  const rounds1 = createTestCondition({
    durationType: "rounds",
    remainingDuration: 1,
  });
  assert.equal(getConditionDurationDisplay(rounds1), "1 round remaining");

  const turns3 = createTestCondition({
    durationType: "turns",
    remainingDuration: 3,
  });
  assert.equal(getConditionDurationDisplay(turns3), "3 turns remaining");

  const turns1 = createTestCondition({
    durationType: "turns",
    remainingDuration: 1,
  });
  assert.equal(getConditionDurationDisplay(turns1), "1 turn remaining");
});

test("getConditionDurationDisplay shows rest-based and special conditions", () => {
  const shortRest = createTestCondition({ durationType: "untilShortRest" });
  assert.equal(getConditionDurationDisplay(shortRest), "until short rest");

  const longRest = createTestCondition({ durationType: "untilLongRest" });
  assert.equal(getConditionDurationDisplay(longRest), "until long rest");

  const encounter = createTestCondition({ durationType: "encounter" });
  assert.equal(getConditionDurationDisplay(encounter), "until encounter ends");

  const concentration = createTestCondition({ durationType: "concentration" });
  assert.equal(getConditionDurationDisplay(concentration), "while concentrating");
});

test("getConditionDurationDisplay returns empty for manual/permanent", () => {
  const manual = createTestCondition({ durationType: "manual" });
  assert.equal(getConditionDurationDisplay(manual), "");

  const permanent = createTestCondition({ durationType: "permanent" });
  assert.equal(getConditionDurationDisplay(permanent), "");
});

test("conditions with duration initialized maintain compatibility with 0 HP state", () => {
  // This tests that a downed (0 HP) character can have other timed conditions
  // and they should still process correctly
  const condition = createTestCondition({
    name: "Poisoned",
    durationType: "rounds",
    remainingDuration: 2,
  });

  const { condition: after1, expired: exp1 } = decrementConditionDuration(condition);
  assert.equal(after1.name, "Poisoned");
  assert.equal(after1.remainingDuration, 1);
  assert.equal(exp1, false);

  // The condition should still be valid after character gets healed
  const healed = { ...after1, remainingDuration: after1.remainingDuration };
  assert.equal(shouldConditionExpire(healed), false);
});

test("concentration-linked conditions preserve link during duration changes", () => {
  const concentrationCondition = createTestCondition({
    name: "Hex",
    durationType: "concentration",
    concentrationLink: "spell-123",
  });

  const initialized = initializeConditionDuration(
    concentrationCondition,
    "concentration",
    1
  );
  assert.equal(initialized.concentrationLink, "spell-123");

  const normalized = normalizeConditionDuration(initialized);
  assert.equal(normalized.concentrationLink, "spell-123");
});

test("rest-based removal conditions preserve removeOn metadata", () => {
  const poison = createTestCondition({
    name: "Poisoned",
    removeOn: ["manual", "short_rest"],
    durationType: "untilShortRest",
  });

  const normalized = normalizeConditionDuration(poison);
  assert.deepEqual(normalized.removeOn, ["manual", "short_rest"]);
});
