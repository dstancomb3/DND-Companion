import assert from "node:assert/strict";
import test from "node:test";
const { canTransferNpcGear } = require("../../utils/combat/lootEligibility");

test("only physical equipment is transferable", () => {
  for (const name of ["Unarmed Strike", "Claw", "Bite", "Tail", "Multiattack"]) {
    assert.equal(canTransferNpcGear({id:"gear-"+name,name,category:"weapon"}),false,name);
  }
  assert.equal(canTransferNpcGear({id:"intrinsic-unarmed-strike",name:"Fist",category:"weapon"}),false);
  assert.equal(canTransferNpcGear({id:"monster-action-0",name:"Scimitar",category:"weapon"}),false);
  assert.equal(canTransferNpcGear({id:"carried-scimitar",name:"Scimitar",category:"weapon"}),true);
  assert.equal(canTransferNpcGear({id:"satchel",name:"Leather Satchel",category:"gear"}),true);
  assert.equal(canTransferNpcGear({id:"not-equipment",name:"Secret",category:"other"}),false);
});
