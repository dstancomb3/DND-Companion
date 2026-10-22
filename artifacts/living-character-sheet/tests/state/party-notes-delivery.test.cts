import assert from "node:assert/strict";
import test from "node:test";
import { mergeAssignedNotesPayload } from "../../utils/partyNotesMerge";
import type { Quest, Note } from "../../types";
const note:Note={id:"dm-note",title:"A clue",body:"First line\nSecond line",pinned:true,createdAt:1,updatedAt:2,tags:["clue"],sessionNumber:0,arcName:"Arc"};
function merge(quests:Quest[],existingQuests:Quest[]=[],notes?:Note[]){return mergeAssignedNotesPayload({payload:{notes,quests,people:[],locations:[]},existingQuests,existingPeople:[],existingLocations:[]});}
test("standalone DM journal notes become local note operations with text and metadata intact",()=>{
 const result=merge([],[],[note]);
 const {id,createdAt,updatedAt,...expected}=note;
 assert.deepEqual(result.notes,[expected]);assert.deepEqual(result.quests,[]);assert.equal(note.id,"dm-note");
});
test("legacy assignments without notes still merge",()=>assert.deepEqual(merge([]).notes,[]));
for(const status of ["active","completed","failed"] as const){
 test(`delivery preserves ${status} quest status for inserts and updates`,()=>{
  const quest:Quest={id:"quest",name:"Test quest",type:"side",status,createdAt:1,locationTags:[]};
  const inserted=merge([quest]);assert.equal(inserted.quests[0].data.status,status);assert.equal(inserted.quests[0].id,undefined);
  const existing={...quest,id:"local-quest",status:"completed" as const};
  const updated=merge([quest],[existing]);assert.equal(updated.quests[0].id,"local-quest");assert.equal(updated.quests[0].data.status,status);
  assert.equal(quest.status,status);
 });
}
