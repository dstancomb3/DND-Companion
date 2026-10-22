import assert from "node:assert/strict";
import test from "node:test";
import { createDmLootDraft, dmLootDraftFromProposal, toDmLootAssignment } from "../../utils/dmLootDraft";
import type { ItemMechanicsBlock } from "../../types";
const mechanics: ItemMechanicsBlock = {schemaVersion:"v1",ownerType:"item",mechanics:[],review:{reviewStatus:"unsupported",confidence:"low",unsupportedSegments:[{rawText:"Reflects 1d8 fire",reason:"missing_required_detail"}]}};
const proposal=(extra={})=>({id:"proposal",name:"Fire Ward",quantity:1,category:"weapon",confidence:"high",needsReview:false,damageDice:"1d8",damageType:"fire",damageModifier:2,attackAbility:"dexterity",isProficient:false,weight:0,value:0,subtype:"Rapier",tags:["Rare","Finesse"],equippedEffects:[{id:"limited",type:"spell",label:"Shield",uses:2,resetOn:"dawn"}],mechanics,...extra});
test("generation and draft construction preserve all supplied mechanics and false/zero fields",()=>{
 const raw=proposal(); const before=structuredClone(raw);
 const draft=createDmLootDraft(dmLootDraftFromProposal(raw));
 assert.equal(draft.damageDice,"1d8");assert.equal(draft.isProficient,false);assert.equal(draft.attackAbility,"dexterity");assert.equal(draft.value,0);
 assert.equal(draft.inventoryItem?.weight,0);assert.equal(draft.inventoryItem?.damageModifier,2);
 assert.deepEqual(draft.inventoryItem?.mechanics,mechanics);assert.equal(draft.inventoryItem?.equippedEffects?.[0].uses,2);
 assert.deepEqual(raw,before);
});
test("review acknowledgement is required and does not promote unsupported mechanics",()=>{
 const draft=dmLootDraftFromProposal(proposal());assert.equal(draft.needsReview,true);
 assert.throws(()=>toDmLootAssignment(draft),/Review and confirm/);
 const payload=JSON.parse(JSON.stringify(toDmLootAssignment({...draft,reviewAcknowledged:true})));
 assert.equal(payload.inventoryItem.mechanics.review.reviewStatus,"unsupported");assert.match(payload.notes,/not automated/);
 assert.equal(payload.inventoryItem.damageModifier,2);assert.equal(payload.inventoryItem.equippedEffects[0].resetOn,"dawn");
 assert.equal(payload.inventoryItem.id,undefined);assert.equal(payload.draftId,undefined);assert.equal(payload.reviewAcknowledged,undefined);
});
test("metadata and quantity edits appear in both transport and full snapshot",()=>{
 const draft=dmLootDraftFromProposal(proposal());
 const payload=toDmLootAssignment({...draft,name:"Revised Ward",quantity:3,value:10,notes:"Agreed description",tags:["Finesse"],rarity:"Rare",reviewAcknowledged:true});
 assert.equal(payload.name,"Revised Ward");assert.equal(payload.inventoryItem?.name,payload.name);assert.equal(payload.inventoryItem?.quantity,3);assert.equal(payload.inventoryItem?.value,10);assert.equal(payload.inventoryItem?.notes,payload.notes);assert.deepEqual(payload.inventoryItem?.tags,["Finesse","Rare"]);
});
test("conflicting edits cannot silently disagree with existing structured effects",()=>{
 const draft={...dmLootDraftFromProposal(proposal()),reviewAcknowledged:true};
 for(const patch of [{damageDice:"1d6"},{category:"armor" as const},{isProficient:true},{attackAbility:"strength" as const}]) assert.throws(()=>toDmLootAssignment({...draft,...patch}),/linked/);
});
test("plain manual weapons remain editable and arrive with real combat fields",()=>{
 const draft=createDmLootDraft({name:"Spear",category:"weapon",quantity:2});
 const payload=toDmLootAssignment({...draft,damageDice:"1d6",damageType:"piercing",weaponRange:"20/60 ft"});
 assert.equal(payload.inventoryItem?.damageDice,"1d6");assert.equal(payload.inventoryItem?.attackAbility,"strength");assert.equal(payload.inventoryItem?.weaponRange,"20/60 ft");
});
test("map images are retained and removed consistently, and local-only URIs are rejected",()=>{
 const draft=createDmLootDraft({name:"Map",quantity:1,category:"map",imageUri:"https://example.com/map.png"});
 assert.equal(toDmLootAssignment(draft).inventoryItem?.imageUri,draft.mapImageUri);
 assert.equal(toDmLootAssignment({...draft,mapImageUri:""}).inventoryItem?.imageUri,undefined);
 assert.throws(()=>toDmLootAssignment({...draft,mapImageUri:"file:///private/map.png"}),/shareable/);
});
test("transfer snapshots retain non-map images and unexposed mechanics metadata",()=>{
 const draft=createDmLootDraft({name:"Potion",quantity:1,category:"consumable",inventoryItem:{name:"Potion",quantity:1,category:"consumable",equipped:false,imageUri:"https://example.com/potion.png",imageSource:"player",useAbilityModifierForDamage:false,additionalDamage:[{dice:"1d4",damageType:"fire"}]}});
 const payload=toDmLootAssignment(draft);
 assert.equal(payload.inventoryItem?.imageSource,"player");assert.equal(payload.inventoryItem?.imageUri,"https://example.com/potion.png");assert.equal(payload.inventoryItem?.useAbilityModifierForDamage,false);assert.deepEqual(payload.inventoryItem?.additionalDamage,[{dice:"1d4",damageType:"fire"}]);
});
test("invalid generation fields fail instead of being clamped or cleared",()=>{
 for(const patch of [{quantity:0},{quantity:-1},{quantity:1.5},{quantity:Infinity},{name:""},{weight:-1},{category:"invented"},{mechanics:{nonsense:true}},{equippedEffects:42},{tags:"Rare"}]) assert.throws(()=>dmLootDraftFromProposal(proposal(patch)));
});
test("invalid draft counts cannot enter an assignment",()=>{
 for(const quantity of [0,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>toDmLootAssignment(createDmLootDraft({name:"Torch",quantity,category:"gear"})),/whole-number/);
});
test("legacy delivery-only categories map into supported inventory categories",()=>{
 for(const [category,expected] of [["currency","treasure"],["component","gear"],["junk","gear"]] as const) {
   const payload=toDmLootAssignment(createDmLootDraft({name:"Supplies",quantity:1,category}));
   assert.equal(payload.category,category);assert.equal(payload.inventoryItem?.category,expected);
 }
});

test("canonical-only mechanics are preserved without inventing legacy weapon defaults",()=>{
 const {legacyItemToItemMechanicsBlock}=require("../../utils/mechanics/itemMechanicsAdapters");
 const block=legacyItemToItemMechanicsBlock({name:"Rapier",category:"weapon",attackAbility:"dexterity",isProficient:false,damageDice:"1d8",damageType:"piercing",damageModifier:2,weaponRange:"melee"});
 const draft=createDmLootDraft({name:"Rapier",quantity:1,category:"weapon",inventoryItem:{name:"Rapier",quantity:1,category:"weapon",equipped:false,mechanics:block}});
 assert.equal(draft.attackAbility,undefined);assert.equal(draft.isProficient,undefined);assert.equal(draft.damageDice,"");
 const payload=toDmLootAssignment({...draft,reviewAcknowledged:true});
 assert.equal(payload.inventoryItem?.attackAbility,undefined);assert.equal(payload.inventoryItem?.damageDice,undefined);assert.deepEqual(payload.inventoryItem?.mechanics,block);
});
