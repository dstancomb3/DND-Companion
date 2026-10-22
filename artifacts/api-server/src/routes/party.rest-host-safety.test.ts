import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router } = await import("./party");
const handler = (router as unknown as {stack:Array<{route?:{path:string;stack:Array<{handle:(req:unknown,res:unknown)=>Promise<void>}>}}>}).stack.find(layer=>layer.route?.path==="/party/:code/rest-requests/:requestId")!.route!.stack[0].handle;
const host=issuePartyHostToken(), other=issuePartyHostToken();
const payload={status:"approved",resolvedBy:"dm",isDmOverride:true};
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
 test(`Rest resolution refuses ${label} before activity, expiration, members or runtime work`,async t=>{
  const reads:unknown[]=[],writes:unknown[]=[];
  t.mock.method(db,"select",(()=>({from:(table:unknown)=>{reads.push(table);return {where:async(condition:never)=>{assert.deepEqual(new PgDialect().sqlToQuery(condition).params,[`denied-rest-${label}`]);return [{hostTokenHash:storedHash,lastActivityAt:expired?new Date(0):new Date()}];}};}})) as never);
  for(const method of ["insert","update","delete"] as const)t.mock.method(db,method,((...args:unknown[])=>{writes.push(args);throw new Error("No denied-request writes allowed");}) as never);
  const res=response();await handler({params:{code:`denied-rest-${label}`,requestId:"rest"},body:{...payload,hostToken:host.hostToken},get:()=>header},res);
  assert.equal(res.statusCode,403);assert.equal(res.body.code,"party_host_required");
  assert.deepEqual(reads,[partySessions]);assert.deepEqual(writes,[]);
 });
}
test("unknown party returns 404 without activity or runtime writes",async t=>{
 t.mock.method(db,"select",(()=>({from:()=>({where:async()=>[]})})) as never);
 for(const method of ["insert","update","delete"] as const)t.mock.method(db,method,(()=>assert.fail("Unexpected write")) as never);
 const res=response();await handler({params:{code:"missing",requestId:"rest"},body:payload,get:()=>`Bearer ${host.hostToken}`},res);assert.equal(res.statusCode,404);
});

for (const status of ["approved", "denied"] as const) {
 for (const scenario of ["existing", "missing", "invalid status", "expired session"] as const) {
  test(`host rest ${status}: ${scenario} preserves validation and persistence`, async t => {
   const code=`rest-${status}-${scenario}`,now=new Date();
   const rest={id:"rest",restType:"long_rest",requestedByMemberId:"member",targetMemberIds:["member"],requestedAt:now.toISOString(),status:"pending",acknowledgements:[]};
   let durable:Record<string,unknown>={partyCode:code,schemaVersion:1,stateRevision:1,updatedAt:now,snapshot:{restRequests:scenario==="missing"?[]:[rest]}};
   let runtimeWrites=0;const reads:unknown[]=[],deletes:unknown[]=[];
   t.mock.method(db,"select",(()=>({from:(table:unknown)=>{reads.push(table);return {where:()=>{
    const data=table===partySessions?[{hostTokenHash:host.hostTokenHash,lastActivityAt:scenario==="expired session"?new Date(0):now}]:table===partyMembers?[]:[durable];
    return Object.assign(Promise.resolve(data),{limit:async()=>data});
   }};}})) as never);
   t.mock.method(db,"update",((table:unknown)=>({set:(value:Record<string,unknown>)=>({where:()=>Object.assign(Promise.resolve([]),{returning:async()=>{assert.equal(table,partyRuntimeSnapshots);runtimeWrites++;durable={...durable,...value};return [durable];}})})})) as never);
   t.mock.method(db,"delete",((table:unknown)=>{deletes.push(table);return {where:async()=>[]};}) as never);
   const res=response();await handler({params:{code,requestId:"rest"},body:{status:scenario==="invalid status"?"pending":status,resolvedBy:"forged-player"},get:()=>`Bearer ${host.hostToken}`},res);
   assert.equal(res.statusCode,scenario==="existing"?200:scenario==="invalid status"?400:404);
   assert.equal(runtimeWrites,scenario==="existing"?1:0);
   if(scenario==="invalid status")assert.ok(reads.every(table=>table===partySessions));
   if(scenario!=="expired session")assert.deepEqual(deletes,[]);
   if(scenario!=="existing")return;
   const saved=durable.snapshot as {restRequests:Array<Record<string,unknown>>;eventLog:Array<{type:string}>};
   assert.equal(saved.restRequests[0].status,status);assert.equal(saved.restRequests[0].resolvedBy,"dm");assert.ok(saved.restRequests[0].resolvedAt);
   assert.deepEqual(saved.restRequests[0].acknowledgements,[]);
   assert.equal(saved.eventLog.filter(event=>event.type===`rest_${status}`).length,1);
   assert.deepEqual(res.body.request,saved.restRequests[0]);
   for(const secret of [host.hostToken,host.hostTokenHash])assert.equal(JSON.stringify(res.body).includes(secret),false);
  });
 }
}
