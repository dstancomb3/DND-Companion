import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const {db}=await import("@workspace/db");
const {partySessions,partyMembers,partyRuntimeSnapshots}=await import("@workspace/db/schema");
const {default:router}=await import("./party");
const handlers=router as unknown as {stack:Array<{route?:{path:string;stack:Array<{handle:(req:unknown,res:unknown)=>Promise<void>}>}}>};
const handler=(action:string)=>handlers.stack.find(layer=>layer.route?.path===`/party/:code/note-assignments/:assignmentId/${action}`)!.route!.stack[0].handle;
const owner=issuePartyHostToken(),other=issuePartyHostToken(),host=issuePartyHostToken();let serial=0;
function response(){return {statusCode:200,body:{} as Record<string,unknown>,status(code:number){this.statusCode=code;return this;},json(body:Record<string,unknown>){this.body=body;return this;}};}
for(const action of ["accept","decline"]){
 for(const [label,header,hash,exists,expired] of [
  ["code and recipient ID alone",undefined,owner.hostTokenHash,true,false],
  ["another member's proof",`Bearer ${other.hostToken}`,owner.hostTokenHash,true,false],
  ["host proof substituted for recipient",`Bearer ${host.hostToken}`,owner.hostTokenHash,true,false],
  ["a legacy member",`Bearer ${owner.hostToken}`,null,true,false],
  ["a removed/cross-party member",`Bearer ${owner.hostToken}`,null,false,false],
  ["expired session without proof",undefined,owner.hostTokenHash,true,true],
 ] as const){
  test(`${action} rejects ${label} before any session/runtime writes or hydration`,async t=>{
   const code=`denied-note-${++serial}`,reads:unknown[]=[],writes:unknown[]=[];
   t.mock.method(db,"select",(()=>({from:(table:unknown)=>{reads.push(table);return {where:(condition:never)=>{
    if(table===partyMembers)assert.deepEqual(new PgDialect().sqlToQuery(condition).params,["member",code]);
    return Promise.resolve(table===partySessions?[{hostTokenHash:host.hostTokenHash,lastActivityAt:expired?new Date(0):new Date()}]:exists?[{memberTokenHash:hash}]:[]);
   }};}})) as never);
   for(const method of ["insert","update","delete"] as const)t.mock.method(db,method,((...args:unknown[])=>{writes.push(args);throw new Error("No denied-request writes");}) as never);
   const res=response();await handler(action)({params:{code,assignmentId:"note"},body:{memberId:"member",memberToken:owner.hostToken,isDmOverride:true},get:()=>header},res);
   assert.equal(res.statusCode,403);assert.equal(res.body.code,"party_member_required");assert.deepEqual(writes,[]);assert.deepEqual(reads,[partySessions,partyMembers]);
  });
 }
 test(`${action} requires a member ID before database access`,async t=>{
  t.mock.method(db,"select",(()=>assert.fail("No read for missing member")) as never);
  const res=response();await handler(action)({params:{code:"party",assignmentId:"note"},body:{},get:()=>`Bearer ${owner.hostToken}`},res);assert.equal(res.statusCode,400);
 });
}
for(const action of ["accept","decline"]){
 for(const scenario of ["owner","wrong recipient","missing assignment","already accepted"]){
  test(`${action}: authenticated ${scenario} respects assignment target and transition`,async t=>{
   const code=`recipient-${++serial}`,now=new Date(),memberId=scenario==="wrong recipient"?"other":"member";
   const assignment={id:"note",targetMemberId:"member",payload:{notes:[{id:"note-entry",title:"Journal note",body:"Clue",pinned:false,createdAt:1,updatedAt:1}],quests:[{id:"quest",name:"Still active",type:"side",status:"active",createdAt:1}],people:[],locations:[]},assignedAt:now.toISOString(),...(scenario==="already accepted"?{acceptedAt:now.toISOString(),acceptedBy:"member"}:{})};
   let durable:Record<string,unknown>={partyCode:code,schemaVersion:1,stateRevision:1,updatedAt:now,snapshot:{noteAssignments:scenario==="missing assignment"?[]:[assignment]}};
   let runtimeWrites=0;
   t.mock.method(db,"select",(()=>({from:(table:unknown)=>({where:(condition:never)=>{
    if(table===partyMembers)assert.deepEqual(new PgDialect().sqlToQuery(condition).params,[memberId,code]);
    const rows=table===partySessions?[{lastActivityAt:now}]:table===partyMembers?[{id:memberId,memberTokenHash:owner.hostTokenHash}]:[durable];
    return Object.assign(Promise.resolve(rows),{limit:async()=>rows});
   }})})) as never);
   t.mock.method(db,"update",((table:unknown)=>({set:(value:Record<string,unknown>)=>({where:()=>Object.assign(Promise.resolve([]),{returning:async()=>{assert.equal(table,partyRuntimeSnapshots);runtimeWrites++;durable={...durable,...value};return [durable];}})})})) as never);
   const res=response();await handler(action)({params:{code,assignmentId:"note"},body:{memberId},get:()=>`Bearer ${owner.hostToken}`},res);
   const expected=scenario==="wrong recipient"?403:scenario==="missing assignment"?404:scenario==="already accepted"&&action==="decline"?409:200;
   assert.equal(res.statusCode,expected);
   if(expected!==200){assert.equal(runtimeWrites,0);return;}
   assert.equal(runtimeWrites,1);
   const snapshot=durable.snapshot as {noteAssignments:Array<Record<string,unknown>>;eventLog:Array<{type:string}>};
   if(action==="accept"){
    assert.deepEqual(snapshot.noteAssignments[0].payload,assignment.payload);
    assert.equal(snapshot.noteAssignments[0].acceptedBy,"member");assert.ok(snapshot.noteAssignments[0].acceptedAt);
    if(scenario!=="already accepted")assert.equal(snapshot.eventLog.filter(e=>e.type==="notes_accepted").length,1);
   }else assert.deepEqual(snapshot.noteAssignments,[]);
   for(const secret of [owner.hostToken,owner.hostTokenHash])assert.equal(JSON.stringify(res.body).includes(secret),false);
  });
 }
}
