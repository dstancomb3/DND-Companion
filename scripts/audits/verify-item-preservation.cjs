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
 const effect={id:'fire',type:'feature',label:'Fire Ward',description:'Negates fire; reflects 1d8',uses:2,resetOn:'dawn'};
 const mechanics={schemaVersion:'v1',ownerType:'item',mechanics:[],review:{reviewStatus:'needs_review',confidence:'low'}};
 const input={name:'Fire Ward',properties:'Negates fire; reflects 1d8',equippedEffects:[effect],mechanics,damageDice:'1d8',damageType:'fire'};
 const saved=await upsertDmItem(input);
 let loaded=(await getDmNotesPayload()).items[0];
 assert.deepEqual(loaded.equippedEffects,[effect]);assert.deepEqual(loaded.mechanics,mechanics);assert.equal(loaded.damageDice,'1d8');
 await upsertDmItem({...loaded,description:'Edited flavor'});
 loaded=(await getDmNotesPayload()).items[0];assert.deepEqual(loaded.mechanics,mechanics);assert.equal(saved.id,loaded.id);
 const consumed=await upsertDmItem({name:'Potion',consumptionEffects:[effect]});
 assert.deepEqual((await getDmNotesPayload()).items.find(i=>i.id===consumed.id).consumptionEffects,[effect]);
 const proposal=(extra={})=>({id:'proposal',name:'Twin',quantity:1,category:'weapon',confidence:'high',needsReview:false,...extra});
 for(const variant of [{category:'armor'},{damageDice:'1d8'},{notes:'Silvered'},{equippedEffects:[effect]},{mechanics},{sourceTag:'official'}]){
   assert.equal(deduplicateItems([proposal({damageDice:'1d6'}),proposal(variant)]).deduped.length,2);
 }
 assert.equal(deduplicateItems([proposal(),proposal({id:'other',quantity:2,confidence:'low',needsReview:true})]).deduped[0].quantity,2);
 let provider=render();provider.loadCharacter({...structuredClone(mockLyraSnapshot),inventory:[]});provider=render();
 provider.applyProposedItems([proposal({weight:3,subtype:'Longsword',damageDice:'1d6',equippedEffects:[effect],mechanics})]);provider=render();
 let first=provider.inventory.find(i=>i.name==='Twin');assert.equal(first.weight,3);assert.equal(first.subtype,'Longsword');assert.deepEqual(first.mechanics,mechanics);
 provider.applyProposedItems([proposal({category:'armor'})]);provider=render();assert.equal(provider.inventory.filter(i=>i.name==='Twin').length,2);
 provider.applyProposedItems([proposal({name:'Plain'}),proposal({name:'Plain'})]);provider=render();assert.equal(provider.inventory.find(i=>i.name==='Plain').quantity,2);
 provider.applyProposedItems([proposal({name:'Plain',quantity:0}),proposal({name:'Plain',quantity:1.5})]);provider=render();assert.equal(provider.inventory.find(i=>i.name==='Plain').quantity,2);
 const before=structuredClone(provider.inventory);provider.applyProposedItems([proposal({quantity:-1})]);provider=render();assert.deepEqual(provider.inventory,before);
 provider.applyProposedItems([proposal({name:'Plain',quantity:-1})]);provider=render();assert.equal(provider.inventory.find(i=>i.name==='Plain').quantity,1);
 console.log('Item preservation checks passed: storage roundtrip/edit, consumables, 6 variant cases, matching stacks, metadata, invalid quantities and ambiguous removal.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Module._load=original;});
