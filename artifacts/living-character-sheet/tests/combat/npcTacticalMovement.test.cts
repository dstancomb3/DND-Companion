import assert from "node:assert/strict";
import test from "node:test";
const { planNpcTacticalMovement } = require("../../utils/combat/npcTacticalMovement");
const positions = [
  {battleId:"b",combatantId:"guard",xFeet:0,yFeet:0,source:"dm_confirmed"},
  {battleId:"b",combatantId:"lyra",xFeet:20,yFeet:0,source:"dm_confirmed"},
];
const input = {battleId:"b",npcId:"guard",targetIds:["lyra"],positions,speedFeet:30};
test("reposition approaches to five-foot distance", () => {
  assert.deepEqual(planNpcTacticalMovement({...input,stance:"reposition"}),{xFeet:15,yFeet:0});
});
test("retreat uses available speed away from the target", () => {
  assert.deepEqual(planNpcTacticalMovement({...input,stance:"retreat"}),{xFeet:-30,yFeet:0});
});
test("no invented map geometry or cover", () => {
  assert.equal(planNpcTacticalMovement({...input,stance:"seek_cover"}),null);
  assert.equal(planNpcTacticalMovement({...input,positions:[],stance:"retreat"}),null);
  assert.equal(planNpcTacticalMovement({...input,speedFeet:300,stance:"retreat"}),null);
  assert.equal(planNpcTacticalMovement({...input,positions:positions.map(p=>({...p,source:"estimated"})),stance:"reposition"}),null);
});

test("occupied squares are not valid NPC movement destinations", () => {
  const blocked = [...positions, {battleId:"b", combatantId:"ally",xFeet:15,yFeet:0,source:"dm_confirmed"}];
  assert.equal(planNpcTacticalMovement({...input,positions:blocked,stance:"reposition"}),null);
});
