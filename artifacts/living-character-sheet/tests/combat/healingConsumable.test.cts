import assert from "node:assert/strict";
import test from "node:test";
const { getConsumableHealingRoll, rollConsumableHealing } = require("../../utils/combat/healingConsumable");

test("standard healing potion restores 2d4+2 hit points", () => {
  const roll = getConsumableHealingRoll({name:"Health Potion"});
  assert.deepEqual(roll,{dice:2,sides:4,bonus:2});
  assert.equal(rollConsumableHealing(roll,()=>0),4);
  assert.equal(rollConsumableHealing(roll,()=>0.999),10);
});
test("rarer potion tiers have correct recovery dice", () => {
  assert.deepEqual(getConsumableHealingRoll({name:"Potion of Greater Healing"}),{dice:4,sides:4,bonus:4});
  assert.deepEqual(getConsumableHealingRoll({name:"Superior Healing Potion"}),{dice:8,sides:4,bonus:8});
  assert.deepEqual(getConsumableHealingRoll({name:"Potion of Supreme Healing"}),{dice:10,sides:4,bonus:20});
});
test("custom items require an explicit bounded healing expression", () => {
  assert.deepEqual(getConsumableHealingRoll({name:"Restorative Draught",notes:"Restore 2d6 + 3 HP."}),{dice:2,sides:6,bonus:3});
  assert.equal(getConsumableHealingRoll({name:"Bottle of Water",notes:"Refreshing drink."}),null);
  assert.equal(getConsumableHealingRoll({name:"Potion of Fire Resistance"}),null);
});
