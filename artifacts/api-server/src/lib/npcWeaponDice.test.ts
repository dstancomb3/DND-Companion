import assert from "node:assert/strict";
import test from "node:test";
import { parseNpcWeaponDice } from "./npcWeaponDice";

test("parses actual D&D dice notation used by NPC weapons", () => {
  assert.deepEqual(parseNpcWeaponDice("1d6"), { count: 1, sides: 6, flatModifier: 0 });
  assert.deepEqual(parseNpcWeaponDice("2d8 + 3"), { count: 2, sides: 8, flatModifier: 3 });
  assert.deepEqual(parseNpcWeaponDice("1d10-2"), { count: 1, sides: 10, flatModifier: -2 });
});
test("rejects malformed or unbounded dice expressions", () => {
  for (const value of ["\\d6", "0d6", "21d6", "2d100", "2d8+999", "cast spell", "", null]) {
    assert.equal(parseNpcWeaponDice(value), null);
  }
});
