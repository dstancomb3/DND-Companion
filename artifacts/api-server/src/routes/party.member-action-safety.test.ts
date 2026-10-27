import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const {db}=await import("@workspace/db");
const {partySessions,partyMembers,partyRuntimeSnapshots}=await import("@workspace/db/schema");
const {default:router}=await import("./party");
const stack=router as unknown as {stack:Array<{route?:{path:string;stack:Array<{handle:(req:unknown,res:unknown)=>Promise<void>}>}}>};
const owner=issuePartyHostToken(),other=issuePartyHostToken(),host=issuePartyHostToken();let serial=0;
const operations=[
 {name:"initiative",path:"/party/:code/initiative/roll",body:{memberId:"member",initiativeRoll:12,initiativeBonus:2}},
 {name:"roll response",path:"/party/:code/roll-requests/:requestId/respond",body:{memberId:"member",roll:12,modifier:2,total:999}},
 {name:"rest request",path:"/party/:code/rest-requests",body:{memberId:"member",restType:"short_rest"}},
 {name:"rest acknowledgement",path:"/party/:code/rest-requests/:requestId/ack",body:{memberId:"member"}},
 {name:"loot claim",path:"/party/:code/loot-assignments/:assignmentId/claim",body:{memberId:"member"}},
];
const handler=(path:string)=>stack.stack.find(layer=>layer.route?.path===path)!.route!.stack[0].handle;
function response(){return {statusCode:200,body:{} as Record<string,unknown>,status(code:number){this.statusCode=code;return this;},json(body:Record<string,unknown>){this.body=body;return this;}};}
for(const op of operations){
 for(const [label,header,hash,exists,expired] of [
  ["missing proof",undefined,owner.hostTokenHash,true,false],
  ["other member",`Bearer ${other.hostToken}`,owner.hostTokenHash,true,false],
  ["host substitute",`Bearer ${host.hostToken}`,owner.hostTokenHash,true,false],
  ["legacy member",`Bearer ${owner.hostToken}`,null,true,false],
  ["removed/cross-party member",`Bearer ${owner.hostToken}`,null,false,false],
  ["expired without proof",undefined,owner.hostTokenHash,true,true],
 ] as const){
  test(`${op.name} refuses ${label} before activity, expiration or runtime access`,async t=>{
   const code=`member-denial-${++serial}`,reads:unknown[]=[],writes:unknown[]=[];
   t.mock.method(db,"select",(()=>({from:(table:unknown)=>{reads.push(table);return {where:(condition:never)=>{
    if(table===partyMembers)assert.deepEqual(new PgDialect().sqlToQuery(condition).params,["member",code]);
    return Promise.resolve(table===partySessions?[{lastActivityAt:expired?new Date(0):new Date(),hostTokenHash:host.hostTokenHash}]:exists?[{memberTokenHash:hash}]:[]);
   }};}})) as never);
   for(const method of ["insert","update","delete"] as const)t.mock.method(db,method,((...args:unknown[])=>{writes.push(args);throw new Error("Denied request wrote data");}) as never);
   const res=response();await handler(op.path)({params:{code,requestId:"request",assignmentId:"loot"},body:{...op.body,memberToken:owner.hostToken,isDmOverride:true},get:()=>header},res);
   assert.equal(res.statusCode,403);assert.equal(res.body.code,"party_member_required");assert.deepEqual(reads,[partySessions,partyMembers]);assert.deepEqual(writes,[]);
  });
 }
 test(`${op.name} requires member ID before DB work`,async t=>{
  t.mock.method(db,"select",(()=>assert.fail("Unexpected read")) as never);
  const res=response();await handler(op.path)({params:{code:"PARTY"},body:{},get:()=>`Bearer ${owner.hostToken}`},res);assert.equal(res.statusCode,400);
 });
 test(`${op.name} refuses unknown party without writes`,async t=>{
  t.mock.method(db,"select",(()=>({from:()=>({where:async()=>[]})})) as never);
  t.mock.method(db,"update",(()=>assert.fail("Unexpected write")) as never);
  const res=response();await handler(op.path)({params:{code:"missing"},body:op.body,get:()=>`Bearer ${owner.hostToken}`},res);assert.equal(res.statusCode,404);
 });
}
for(const op of operations){
 const scenarios=op.name==="roll response"||op.name==="rest acknowledgement"||op.name==="loot claim"?["owner","foreign target"]:["owner"];
 for(const scenario of scenarios){
  test(`${op.name}: authenticated ${scenario} retains business checks and persists allowed action`,async t=>{
   const code=`member-success-${++serial}`,now=new Date(),target=scenario==="foreign target"?"other":"member";
   let durable:Record<string,unknown>={partyCode:code,schemaVersion:1,stateRevision:1,updatedAt:now,snapshot:{
    rollRequests:[{id:"request",statKey:"dexterity",label:"Dexterity",targetMemberIds:[target],requestedAt:now.toISOString(),responses:[]}],
    restRequests:op.name==="rest request"?[]:[{id:"request",restType:"short_rest",requestedByMemberId:"member",targetMemberIds:[target],requestedAt:now.toISOString(),status:"approved",acknowledgements:[]}],
    lootAssignments:[{id:"loot",targetMemberId:target,item:{name:"Torch",quantity:2,category:"gear"},assignedAt:now.toISOString()}],
   }};
   let writes=0;
   t.mock.method(db,"select",(()=>({from:(table:unknown)=>({where:(condition:never)=>{
    if(table===partyMembers){const args=new PgDialect().sqlToQuery(condition).params;assert.deepEqual(args,args.length===2?["member",code]:[code]);}
    const rows=table===partySessions?[{lastActivityAt:now}]:table===partyMembers?[{id:"member",memberTokenHash:owner.hostTokenHash,characterName:"Player",characterClass:"Wizard",maxHp:10,armorClass:12,updatedAt:now}]:[durable];
    return Object.assign(Promise.resolve(rows),{limit:async()=>rows});
   }})})) as never);
   t.mock.method(db,"update",((table:unknown)=>({set:(value:Record<string,unknown>)=>({where:()=>Object.assign(Promise.resolve([]),{returning:async()=>{assert.equal(table,partyRuntimeSnapshots);writes++;durable={...durable,...value};return [durable];}})})})) as never);
   const res=response();await handler(op.path)({params:{code,requestId:"request",assignmentId:"loot"},body:op.body,get:()=>`Bearer ${owner.hostToken}`},res);
   assert.equal(res.statusCode,scenario==="foreign target"?403:200);assert.equal(writes,scenario==="foreign target"?0:1);
   if(scenario==="foreign target")return;
   const saved=durable.snapshot as Record<string,any>;
   if(op.name==="initiative")assert.equal(saved.initiativeByMember.member.initiativeTotal,14);
   if(op.name==="roll response")assert.equal(saved.rollRequests[0].responses[0].total,14);
   if(op.name==="rest request")assert.ok(saved.restRequests.some((r:any)=>r.requestedByMemberId==="member"&&r.status==="pending"));
   if(op.name==="rest acknowledgement")assert.deepEqual(saved.restRequests[0].acknowledgements,["member"]);
   if(op.name==="loot claim")assert.equal(saved.lootAssignments[0].claimedBy,"member");
   for(const secret of [owner.hostToken,owner.hostTokenHash])assert.equal(JSON.stringify(res.body).includes(secret),false);
  });
 }
}
