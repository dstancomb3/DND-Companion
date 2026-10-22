const path = require('path');
const root = path.resolve(__dirname, '../..');
const assert = require('node:assert/strict');
const Module = require('module');
const original = Module._load;
let batches, current, calls;
const react = {createContext:()=>({Provider:'provider'}), useCallback:f=>f, useContext:()=>({}), useEffect:()=>{}, useState:()=>[batches,()=>{}], createElement:(_type,props)=>({props})};
Module._load = function(id,parent,isMain) {
 if(id==='react') return react;
 if(id==='react/jsx-runtime') return {jsx:(_type,props)=>({props}),jsxs:(_type,props)=>({props})};
 if(id==='@react-native-async-storage/async-storage') return {getItem:async()=>null,setItem:async()=>{}};
 if(id==='@/utils/mutationUndoSafety') return original.call(this,path.join(root,'artifacts/living-character-sheet/utils/mutationUndoSafety.ts'),parent,isMain);
 if(id==='@/context/CharacterContext') return {useCharacter:()=>current};
 return original.call(this,id,parent,isMain);
};
const {MutationHistoryProvider}=require(path.join(root,'artifacts/living-character-sheet/context/MutationHistoryContext.tsx'));
async function probe(label,snapshot){
 calls=[]; batches=[{id:'batch',applied:true,undone:false,beforeSnapshot:snapshot}];
 current={character:{currentHp:15,tempHp:0,currency:{cp:0,sp:0,ep:0,gp:30,pp:0}},resources:[{id:'r',name:'R',current:2}],currentCharacterId:'character',updateHp:delta=>calls.push(['hp',delta]),updateCurrency:delta=>calls.push(['currency',delta]),applyResourceChanges:delta=>calls.push(['resources',delta]),addCondition:()=>calls.push(['addCondition']),removeCondition:()=>calls.push(['removeCondition'])};
 const element=MutationHistoryProvider({children:null});const result=await element.props.value.undoBatch('batch');
 assert.equal(result.status,'unavailable');
 return {label,calls,result};
}
(async()=>{
 const results=[];
 results.push(await probe('incomplete temp HP and condition history is refused',{tempHp:7,conditionsBefore:[{id:'old',name:'Prone'}]}));
 results.push(await probe('old HP history is refused instead of overwriting later HP',{currentHp:10}));
 results.push(await probe('HP-only history is refused instead of overwriting unrelated currency/resources',{currentHp:15,currency:{cp:0,sp:0,ep:0,gp:10,pp:0},resourceStates:[{id:'r',name:'R',priorCurrent:5}]}));
 assert.deepEqual(results[0].calls, []);
 assert.deepEqual(results[1].calls, []);
 assert.deepEqual(results[2].calls, []);
 console.log(JSON.stringify(results,null,2));
 require('fs').writeFileSync(path.join(root,'docs/audits/undo-safety-containment-probes.json'),JSON.stringify({method:'Containment regression: actual MutationHistoryProvider.undoBatch refuses incomplete records without character mutations; mocked React/hooks and storage, no browser/database.',results},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{Module._load=original;});
