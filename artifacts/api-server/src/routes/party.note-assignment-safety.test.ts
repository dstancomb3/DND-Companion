import assert from "node:assert/strict";
import test from "node:test";
import { issuePartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router } = await import("./party");
const handler = (router as unknown as {stack:Array<{route?:{path:string;stack:Array<{handle:(req:unknown,res:unknown)=>Promise<void>}>}}>}).stack.find(layer=>layer.route?.path==="/party/:code/note-assignments")!.route!.stack[0].handle;
const host=issuePartyHostToken(), other=issuePartyHostToken();
const payload={targetMemberIds:["member"],assignedBy:"dm",isDmOverride:true,payload:{quests:[{id:"quest",name:"A real quest",type:"main",status:"active",createdAt:1}],people:[],locations:[]}};
function response(){return {statusCode:200,body:{} as Record<string,unknown>,status(code:number){this.statusCode=code;return this;},json(body:Record<string,unknown>){this.body=body;return this;}};}
for(const [label,header,storedHash,expired] of [
 ["party code alone",undefined,host.hostTokenHash,false],
 ["another party host",`Bearer ${other.hostToken}`,host.hostTokenHash,false],
 ["a player capability",`Bearer ${issuePartyHostToken().hostToken}`,host.hostTokenHash,false],
 ["a forged DM flag","Bearer isDmOverride=true",host.hostTokenHash,false],
 ["a stored hash as a token",`Bearer ${host.hostTokenHash}`,host.hostTokenHash,false],
 ["an unclaimed legacy session",`Bearer ${host.hostToken}`,null,false],
 ["a malformed header",host.hostToken,host.hostTokenHash,false],
 ["an expired party without proof",undefined,host.hostTokenHash,true],
] as const){
 test(`DM notes refuse ${label} before activity, expiration, members or runtime work`,async t=>{
  const reads:unknown[]=[],writes:unknown[]=[];
  t.mock.method(db,"select",(()=>({from:(table:unknown)=>{reads.push(table);return {where:async()=>[{hostTokenHash:storedHash,lastActivityAt:expired?new Date(0):new Date()}]};}})) as never);
  for(const method of ["insert","update","delete"] as const)t.mock.method(db,method,((...args:unknown[])=>{writes.push(args);throw new Error("No denied-request writes allowed");}) as never);
  const res=response();await handler({params:{code:`denied-${label}`},body:{...payload,hostToken:host.hostToken},get:()=>header},res);
  assert.equal(res.statusCode,403);assert.equal(res.body.code,"party_host_required");
  assert.deepEqual(reads,[partySessions]);assert.deepEqual(writes,[]);
 });
}
test("unknown party returns 404 without activity or runtime writes",async t=>{
 t.mock.method(db,"select",(()=>({from:()=>({where:async()=>[]})})) as never);
 for(const method of ["insert","update","delete"] as const)t.mock.method(db,method,(()=>assert.fail("Unexpected write")) as never);
 const res=response();await handler({params:{code:"missing"},body:payload,get:()=>`Bearer ${host.hostToken}`},res);assert.equal(res.statusCode,404);
});
test("authorized host sends normalized notes and server stamps origin without exposing proof",async t=>{
 const rows:Record<string,unknown>[]=[];const now=new Date();const updates:unknown[]=[];
 t.mock.method(db,"select",(()=>({from:(table:unknown)=>({where:()=>{
  const data=table===partySessions?[{hostTokenHash:host.hostTokenHash,lastActivityAt:now}]:table===partyMembers?[{id:"member",characterName:"Player",characterClass:"Wizard",maxHp:10,armorClass:12,updatedAt:now}]:rows;
  return Object.assign(Promise.resolve(data),{limit:async()=>data});
 }})})) as never);
 t.mock.method(db,"update",((table:unknown)=>{updates.push(table);return {set:()=>({where:async()=>[]})};}) as never);
 t.mock.method(db,"insert",((table:unknown)=>{assert.equal(table,partyRuntimeSnapshots);return {values:(row:Record<string,unknown>)=>({returning:async()=>{rows.push(row);return [row];}})};}) as never);
 const res=response();await handler({params:{code:"host-note-success"},body:{...payload,assignedBy:"forged-person"},get:()=>`Bearer ${host.hostToken}`},res);
 assert.equal(res.statusCode,200);const assignments=res.body.assignments as Array<Record<string,unknown>>;
 assert.equal(assignments.length,1);assert.equal(assignments[0].targetMemberId,"member");assert.equal(assignments[0].assignedBy,"dm");
 assert.equal((assignments[0].payload as {quests:Array<{name:string}>}).quests[0].name,"A real quest");
 assert.deepEqual(updates,[partySessions]);assert.equal(rows.length,1);
 const saved=rows[0].snapshot as {noteAssignments:unknown[];eventLog:Array<{type:string}>};
 assert.equal(saved.noteAssignments.length,1);assert.ok(saved.eventLog.some(event=>event.type==="notes_assigned"));
 for(const secret of [host.hostToken,host.hostTokenHash])assert.equal(JSON.stringify(res.body).includes(secret),false);
});
test("authorized invalid payload retains existing validation without runtime hydration",async t=>{
 const reads:unknown[]=[];
 t.mock.method(db,"select",(()=>({from:(table:unknown)=>{reads.push(table);return {where:async()=>[{hostTokenHash:host.hostTokenHash,lastActivityAt:new Date()}]};}})) as never);
 t.mock.method(db,"update",(()=>({set:()=>({where:async()=>[]})})) as never);
 const res=response();await handler({params:{code:"invalid-note"},body:{},get:()=>`Bearer ${host.hostToken}`},res);
 assert.equal(res.statusCode,400);assert.ok(reads.every(table=>table===partySessions));
});

for (const scenario of ["notes only", "active quest", "completed quest", "invalid note"] as const) {
 test(`host delivery: ${scenario} preserves supported journal content and quest status`, async t => {
  const now=new Date();const rows:Record<string,unknown>[]=[];
  t.mock.method(db,"select",(()=>({from:(table:unknown)=>({where:()=>{
   const data=table===partySessions?[{hostTokenHash:host.hostTokenHash,lastActivityAt:now}]:table===partyMembers?[{id:"member",updatedAt:now}]:rows;
   return Object.assign(Promise.resolve(data),{limit:async()=>data});
  }})})) as never);
  t.mock.method(db,"update",(()=>({set:()=>({where:async()=>[]})})) as never);
  t.mock.method(db,"insert",((table:unknown)=>({values:(row:Record<string,unknown>)=>({returning:async()=>{assert.equal(table,partyRuntimeSnapshots);rows.push(row);return [row];}})})) as never);
  const note={id:"note",title:scenario==="invalid note"?"   ":" DM journal ",body:"Line one\nLine two",pinned:true,createdAt:1,updatedAt:2,sessionNumber:0,arcName:"Arc",tags:["clue",3],linkedQuests:["quest"]};
  const status=scenario==="completed quest"?"completed":"active";
  const quests=scenario.includes("quest")?[{id:"quest",name:"Unfinished quest",type:"side",status,createdAt:1}]:[];
  const res=response();await handler({params:{code:`delivery-${scenario}`},body:{targetMemberIds:["member"],payload:{notes:[note],quests,people:[],locations:[]}},get:()=>`Bearer ${host.hostToken}`},res);
  if(scenario==="invalid note"){assert.equal(res.statusCode,400);assert.equal(rows.length,0);return;}
  assert.equal(res.statusCode,200);
  const sent=(res.body.assignments as Array<{payload:{notes:Array<Record<string,unknown>>;quests:Array<{status:string}>}}>)[0].payload;
  assert.equal(sent.notes[0].title,"DM journal");assert.equal(sent.notes[0].body,note.body);assert.equal(sent.notes[0].pinned,true);assert.equal(sent.notes[0].sessionNumber,0);
  assert.deepEqual(sent.notes[0].tags,["clue"]);assert.deepEqual(sent.notes[0].linkedQuests,["quest"]);
  assert.equal(sent.quests.length,quests.length);if(quests.length)assert.equal(sent.quests[0].status,status);
  const stored=rows[0].snapshot as {noteAssignments:Array<{payload:unknown}>};assert.deepEqual(stored.noteAssignments[0].payload,sent);
 });
}
