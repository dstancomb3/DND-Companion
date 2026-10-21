import assert from "node:assert/strict";
import test from "node:test";

import { applyLocalResolvedHpMutation } from "../../utils/combat/localResolvedHpMutation.ts";

test("applies local resolved damage then healing with max HP clamp", () => {
  const result = applyLocalResolvedHpMutation({
    prevHp: 10,
    maxHp: 12,
    prevTempHp: 3,
    requestedHpDamage: 5,
    requestedHpHealing: 7,
    requestedTempAbsorbed: 3,
  });

  assert.equal(result.actualTempAbsorbed, 3);
  assert.equal(result.actualHpDamage, 5);
  assert.equal(result.actualHpHealing, 7);
  assert.equal(result.nextTempHp, 0);
  assert.equal(result.nextHp, 12);
  assert.equal(result.changed, true);
});

test("healing-only local mutation is applied and marked changed", () => {
  const result = applyLocalResolvedHpMutation({
    prevHp: 4,
    maxHp: 12,
    prevTempHp: 0,
    requestedHpDamage: 0,
    requestedHpHealing: 5,
    requestedTempAbsorbed: 0,
  });

  assert.equal(result.actualHpDamage, 0);
  assert.equal(result.actualHpHealing, 5);
  assert.equal(result.nextHp, 9);
  assert.equal(result.changed, true);
});

test("no-op local mutation remains unchanged", () => {
  const result = applyLocalResolvedHpMutation({
    prevHp: 9,
    maxHp: 12,
    prevTempHp: 1,
    requestedHpDamage: 0,
    requestedHpHealing: 0,
    requestedTempAbsorbed: 0,
  });

  assert.equal(result.nextHp, 9);
  assert.equal(result.nextTempHp, 1);
  assert.equal(result.actualHpDamage, 0);
  assert.equal(result.actualHpHealing, 0);
  assert.equal(result.actualTempAbsorbed, 0);
  assert.equal(result.changed, false);
});
