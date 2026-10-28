import test from "node:test";
import assert from "node:assert/strict";
const { validateSelectedRestProvisions } = require("../../utils/adventure/restProvisionSelection");
const stock = [
 {id:"ration",name:"Rations",quantity:2},
 {id:"water",name:"Waterskin",quantity:1},
 {id:"sword",name:"Longsword",quantity:1},
];
test("provisions remain opt-in",()=>{
 assert.deepEqual(validateSelectedRestProvisions(undefined,stock),{ok:true,debit:[]});
 assert.deepEqual(validateSelectedRestProvisions({enabled:false,itemIds:[]},stock),{ok:true,debit:[]});
});
test("selected food and water debit one unit each",()=>{
 assert.deepEqual(validateSelectedRestProvisions({enabled:true,itemIds:["ration","water"]},stock),{
  ok:true,debit:[{id:"ration",nextQuantity:1},{id:"water",nextQuantity:0}]
 });
});
test("missing, duplicate, empty and nonfood items reject without partial debit",()=>{
 for(const itemIds of [["missing"],["ration","ration"],["sword"]]){
   assert.equal(validateSelectedRestProvisions({enabled:true,itemIds},stock).ok,false);
 }
 assert.equal(validateSelectedRestProvisions({enabled:true,itemIds:["water"]},[{id:"water",name:"Waterskin",quantity:0}]).ok,false);
});
