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
 const results=[];
 const saved=await upsertDmItem({name:'Fire Ward',properties:'Negates fire; reflects 1d8',equippedEffects:[{id:'fire',type:'feature',label:'Fire Ward'}],mechanics:{schemaVersion:'v1',ownerType:'item',mechanics:[{mechanicId:'fire'}]}});
 const loaded=(await getDmNotesPayload()).items[0];
 assert.equal(loaded.mechanics,undefined);assert.equal(loaded.equippedEffects,undefined);assert.equal(loaded.properties,'Negates fire; reflects 1d8');
 results.push({probe:'DM notes save/load preserves prose but drops structured mechanics',idPreserved:saved.id===loaded.id,properties:loaded.properties,hasMechanics:'mechanics'in loaded,hasEquippedEffects:'equippedEffects'in loaded});
 const proposal=(extra={})=>({id:'proposal',name:'Twin',quantity:1,category:'weapon',confidence:'high',needsReview:false,notes:'Iron',...extra});
 const deduped=deduplicateItems([proposal({id:'weapon',damageDice:'1d6',officialMatch:true}),proposal({id:'armor',category:'armor',confidence:'low',damageDice:'1d8'})]).deduped;
 assert.equal(deduped.length,1);assert.equal(deduped[0].quantity,1);
 results.push({probe:'client dedupe merges different categories by name and uses max quantity',output:deduped[0]});
 let provider=render();provider.loadCharacter({...structuredClone(mockLyraSnapshot),inventory:[{id:'existing',name:'Twin',category:'weapon',quantity:1,equipped:false,damageDice:'1d6'}]});provider=render();
 provider.applyProposedItems([proposal({category:'armor',damageDice:'1d8'})]);provider=render();
 const collision=provider.inventory.find(i=>i.name==='Twin');assert.equal(collision.quantity,2);assert.equal(collision.category,'weapon');assert.equal(collision.damageDice,'1d6');
 results.push({probe:'inventory application merges same names across categories and keeps old weapon fields',quantity:collision.quantity,category:collision.category,damageDice:collision.damageDice});
 const fresh=proposal({name:'Unique',weight:3,subtype:'Longsword'});
 provider.applyProposedItems([fresh]);provider=render();provider.applyProposedItems([fresh]);provider=render();
 const duplicated=provider.inventory.find(i=>i.name==='Unique');assert.equal(duplicated.quantity,2);assert.equal(duplicated.weight,undefined);assert.equal(duplicated.subtype,undefined);
 results.push({probe:'reapplying the same proposal ID adds again and metadata is omitted',quantity:duplicated.quantity,weightPresent:'weight'in duplicated,subtypePresent:'subtype'in duplicated});
 fs.mkdirSync(path.join(root,'docs/audits'),{recursive:true});
 fs.writeFileSync(path.join(root,'docs/audits/item-client-probes.json'),JSON.stringify({baseline:'d4cacecb75bc408f13fc90809e9f364e7899f805',method:'Actual client store/dedupe/provider functions; React hooks and AsyncStorage mocked; no device or network calls. Assertions characterize existing gaps.',results},null,2)+'\n');
 console.log(`Item client audit probes passed: ${results.length}`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Module._load=original;});
