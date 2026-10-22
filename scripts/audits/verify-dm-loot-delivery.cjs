const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..'), client = path.join(root,'artifacts/living-character-sheet');
const original = Module._load, store = new Map();
let values=[], refs=[], slot=0, refSlot=0;
const react={createContext:()=>({Provider:'provider'}),useContext:()=>({}),useEffect:()=>{},useCallback:f=>f,
 createElement:(_type,props)=>({props}),useRef:initial=>{const i=refSlot++;return refs[i]??(refs[i]={current:initial});},
 useState:initial=>{const i=slot++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];}};
Module._load=function(id,parent,isMain){
 if(id==='react')return react;
 if(id==='react/jsx-runtime')return {jsx:(_type,props)=>({props})};
 if(id==='@react-native-async-storage/async-storage')return {getItem:async key=>store.get(key)??null,setItem:async(key,value)=>store.set(key,value),removeItem:async key=>store.delete(key)};
 if(id.startsWith('@/'))return original.call(this,path.join(client,id.slice(2)),parent,isMain);
 return original.call(this,id,parent,isMain);
};
const {upsertDmItem,getDmNotesPayload}=require(path.join(client,'utils/dmNotesStorage.ts'));
const {deduplicateItems}=require(path.join(client,'utils/lootReviewMerge.ts'));
const {CharacterProvider}=require(path.join(client,'context/CharacterContext.tsx'));
const {mockLyraSnapshot}=require(path.join(client,'data/mockCharacter.ts'));
function render(){slot=0;refSlot=0;return CharacterProvider({children:null}).props.value;}
(async()=>{
 const {createDmLootDraft,dmLootDraftFromProposal,toDmLootAssignment}=require(path.join(client,'utils/dmLootDraft.ts'));
 const mechanics={schemaVersion:'v1',ownerType:'item',mechanics:[],review:{reviewStatus:'unsupported',confidence:'low',unsupportedSegments:[{rawText:'Reflects 1d8 fire',reason:'missing_required_detail'}]}};
 const proposal={id:'proposal',name:'Fire Ward',quantity:2,category:'weapon',confidence:'high',needsReview:true,weight:0,value:0,subtype:'Rapier',attackAbility:'dexterity',isProficient:false,useAbilityModifierForDamage:false,damageDice:'1d8',damageModifier:2,damageType:'fire',additionalDamage:[{dice:'1d4',damageType:'cold'}],equippedEffects:[{id:'uses',type:'spell',label:'Shield',uses:2,resetOn:'dawn'}],mechanics};
 const draft=createDmLootDraft(dmLootDraftFromProposal(proposal));
 const received=JSON.parse(JSON.stringify(toDmLootAssignment({...draft,reviewAcknowledged:true})));
 let provider=render();provider.loadCharacter({...structuredClone(mockLyraSnapshot),inventory:[]});provider=render();
 // app/party.tsx's existing snapshot branch removes incoming id, forces assigned count and unequipped state, then calls addItem.
 const {id:_ignored,...snapshot}=received.inventoryItem;
 provider.addItem({...snapshot,quantity:received.quantity,equipped:false});provider=render();
 const added=provider.inventory.find(i=>i.name==='Fire Ward');
 for(const key of ['quantity','category','weight','value','subtype','attackAbility','isProficient','useAbilityModifierForDamage','damageDice','damageModifier','damageType','additionalDamage']) assert.deepEqual(added[key],proposal[key],key);
 assert.deepEqual(added.mechanics,mechanics);assert.equal(added.equipped,false);assert.notEqual(added.id,proposal.id);
 const shield=added.equippedEffects.find(e=>e.label==='Shield');assert.equal(shield.uses,2);assert.equal(shield.resetOn,'dawn');
 console.log('DM loot delivery provider checks passed: proposal → draft → serialized payload → actual inventory; unsupported review, limited uses and combat fields preserved. React mocked; no server/database/device acceptance.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Module._load=original;});
