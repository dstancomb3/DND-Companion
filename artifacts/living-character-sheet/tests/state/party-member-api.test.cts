import assert from "node:assert/strict";
import test from "node:test";
import { partyMemberApi, PartyMemberAccessError } from "../../utils/partyMemberApi";

function fixture() {
  const rows = new Map<string, string>();
  const calls: Array<{ path: string; options?: RequestInit }> = [];
  const storage = {
    getItem: async (key: string) => rows.get(key) ?? null,
    setItem: async (key: string, value: string) => { rows.set(key, value); },
    removeItem: async (key: string) => { rows.delete(key); },
  };
  let error: Error | null = null, serial = 0;
  const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
    calls.push({ path, options });
    if (error) throw error;
    if (path.endsWith("/register-member")) { serial++; return { memberId: `member-${serial}`, memberToken: `private-${serial}` } as T; }
    return { ok: true } as T;
  };
  return { rows, calls, storage, request, fail: (value: Error | null) => { error = value; } };
}

test("registration saves private proof and resumes the same character after reload", async () => {
  const f = fixture();
  assert.deepEqual(await partyMemberApi(f.request, f.storage).registerPartyMember("PARTY", "character"), { memberId: "member-1" });
  const reloaded = partyMemberApi(f.request, f.storage);
  assert.deepEqual(await reloaded.registerPartyMember("PARTY", "character"), { memberId: "member-1" });
  const payload = { partyCode: "PARTY", memberId: "member-1", currentHp: 5 };
  await reloaded.syncPartyMember(payload);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[1], { path: "/party/sync", options: { method: "PUT", body: JSON.stringify(payload), headers: { Authorization: "Bearer private-1" } } });
  assert.equal(JSON.stringify(payload).includes("private"), false);
});

test("party and character identities each get separate credentials", async () => {
  const f = fixture(), api = partyMemberApi(f.request, f.storage);
  await api.registerPartyMember("A", "character");
  await api.registerPartyMember("A", "other-character");
  await api.registerPartyMember("B", "character");
  assert.equal(f.calls.length, 3);
  assert.equal(await api.hasPartyMemberAccess("A", "member-1"), true);
  assert.equal(await api.hasPartyMemberAccess("B", "member-1"), false);
  await assert.rejects(api.syncPartyMember({ partyCode: "B", memberId: "member-1" }), PartyMemberAccessError);
  assert.equal(f.calls.length, 3);
});

test("leave sends own proof and a later join registers a new identity", async () => {
  const f = fixture(), api = partyMemberApi(f.request, f.storage);
  await api.registerPartyMember("PARTY", "character");
  await api.leaveParty("member-1", "PARTY");
  assert.equal(f.calls[1].options?.method, "DELETE");
  assert.equal((f.calls[1].options?.headers as Record<string, string>).Authorization, "Bearer private-1");
  assert.equal(await api.hasPartyMemberAccess("PARTY", "member-1"), false);
  assert.deepEqual(await api.registerPartyMember("PARTY", "character"), { memberId: "member-2" });
});

test("network failures retain credentials and registration for retry", async () => {
  const f = fixture(), api = partyMemberApi(f.request, f.storage);
  await api.registerPartyMember("PARTY", "character");
  f.fail(new Error("Offline"));
  await assert.rejects(api.syncPartyMember({ partyCode: "PARTY", memberId: "member-1" }), /Offline/);
  await assert.rejects(api.leaveParty("member-1", "PARTY"), /Offline/);
  assert.equal(await api.hasPartyMemberAccess("PARTY", "member-1"), true);
  assert.deepEqual(await api.registerPartyMember("PARTY", "character"), { memberId: "member-1" });
});

test("server rejection revokes local proof so rejoining cannot resurrect a removed member", async () => {
  const f = fixture(), api = partyMemberApi(f.request, f.storage);
  await api.registerPartyMember("PARTY", "character");
  f.fail(new PartyMemberAccessError("Member was removed"));
  await assert.rejects(api.syncPartyMember({ partyCode: "PARTY", memberId: "member-1" }), PartyMemberAccessError);
  assert.equal(await api.hasPartyMemberAccess("PARTY", "member-1"), false);
  f.fail(null);
  assert.deepEqual(await api.registerPartyMember("PARTY", "character"), { memberId: "member-2" });
});

test("missing legacy proof fails locally instead of claiming an existing identity", async () => {
  const f = fixture(), api = partyMemberApi(f.request, f.storage);
  await assert.rejects(api.syncPartyMember({ partyCode: "PARTY", memberId: "legacy" }), PartyMemberAccessError);
  await assert.rejects(api.leaveParty("legacy", "PARTY"), PartyMemberAccessError);
  assert.equal(f.calls.length, 0);
});

test("storage failure prevents successful registration acknowledgment", async () => {
  const f = fixture();
  f.storage.setItem = async () => { throw new Error("Storage unavailable"); };
  await assert.rejects(partyMemberApi(f.request, f.storage).registerPartyMember("PARTY", "character"), /Storage unavailable/);
});

for(const action of ["accept","decline"] as const){
 test(`${action} notes uses persisted recipient proof, preserves JSON and returns the response`,async()=>{
  const f=fixture();const first=partyMemberApi(f.request,f.storage);await first.registerPartyMember("PARTY","character");
  const api=partyMemberApi(f.request,f.storage);
  const result=await (action==="accept"?api.acceptPartyNoteAssignment:api.declinePartyNoteAssignment)("PARTY","note",{memberId:"member-1"});
  assert.deepEqual(result,{ok:true});assert.deepEqual(f.calls[1],{path:`/party/PARTY/note-assignments/note/${action}`,options:{method:"PUT",body:JSON.stringify({memberId:"member-1"}),headers:{"Content-Type":"application/json",Authorization:"Bearer private-1"}}});
 });
 test(`${action} notes refuses unknown party/member locally`,async()=>{
  const f=fixture(),api=partyMemberApi(f.request,f.storage);await api.registerPartyMember("PARTY","character");
  await assert.rejects((action==="accept"?api.acceptPartyNoteAssignment:api.declinePartyNoteAssignment)("OTHER","note",{memberId:"member-1"}),PartyMemberAccessError);assert.equal(f.calls.length,1);
 });
 test(`${action} notes retains proof on transport failure but revokes rejected member proof`,async()=>{
  const f=fixture(),api=partyMemberApi(f.request,f.storage);await api.registerPartyMember("PARTY","character");
  const send=()=> (action==="accept"?api.acceptPartyNoteAssignment:api.declinePartyNoteAssignment)("PARTY","note",{memberId:"member-1"});
  f.fail(new Error("Offline"));await assert.rejects(send(),/Offline/);assert.equal(await api.hasPartyMemberAccess("PARTY","member-1"),true);
  f.fail(new PartyMemberAccessError("Revoked"));await assert.rejects(send(),PartyMemberAccessError);assert.equal(await api.hasPartyMemberAccess("PARTY","member-1"),false);
 });
}

const memberActions=[
 {name:"initiative",path:"/party/PARTY/initiative/roll",method:"PUT",send:(api:ReturnType<typeof partyMemberApi>,code:string)=>api.submitInitiativeRoll(code,{memberId:"member-1",initiativeRoll:12,initiativeBonus:2}),isVoid:true},
 {name:"roll response",path:"/party/PARTY/roll-requests/request/respond",method:"PUT",send:(api:ReturnType<typeof partyMemberApi>,code:string)=>api.submitPartyRollResponse(code,"request",{memberId:"member-1",roll:12,modifier:2,total:14})},
 {name:"rest request",path:"/party/PARTY/rest-requests",method:"POST",send:(api:ReturnType<typeof partyMemberApi>,code:string)=>api.createPartyRestRequest(code,{memberId:"member-1",restType:"short_rest"})},
 {name:"rest acknowledgement",path:"/party/PARTY/rest-requests/request/ack",method:"PUT",send:(api:ReturnType<typeof partyMemberApi>,code:string)=>api.acknowledgePartyRestRequest(code,"request",{memberId:"member-1"})},
 {name:"loot claim",path:"/party/PARTY/loot-assignments/loot/claim",method:"PUT",send:(api:ReturnType<typeof partyMemberApi>,code:string)=>api.claimPartyLootAssignment(code,"loot",{memberId:"member-1"})},
];
for(const action of memberActions){
 test(`${action.name} carries exact stored member proof and JSON with compatible result`,async()=>{
  const f=fixture(),api=partyMemberApi(f.request,f.storage);await api.registerPartyMember("PARTY","character");
  const value=await action.send(partyMemberApi(f.request,f.storage),"PARTY");assert.deepEqual(value,action.isVoid?undefined:{ok:true});
  const call=f.calls[1];assert.equal(call.path,action.path);assert.equal(call.options?.method,action.method);assert.deepEqual(call.options?.headers,{"Content-Type":"application/json",Authorization:"Bearer private-1"});
  assert.equal(JSON.parse(String(call.options?.body)).memberId,"member-1");assert.equal(String(call.options?.body).includes("private-1"),false);
 });
 test(`${action.name} cannot use another party and keeps proof only on transient failure`,async()=>{
  const f=fixture(),api=partyMemberApi(f.request,f.storage);await api.registerPartyMember("PARTY","character");
  await assert.rejects(action.send(api,"OTHER"),PartyMemberAccessError);assert.equal(f.calls.length,1);
  f.fail(new Error("Offline"));await assert.rejects(action.send(api,"PARTY"),/Offline/);assert.equal(await api.hasPartyMemberAccess("PARTY","member-1"),true);
  f.fail(new PartyMemberAccessError("Revoked"));await assert.rejects(action.send(api,"PARTY"),PartyMemberAccessError);assert.equal(await api.hasPartyMemberAccess("PARTY","member-1"),false);
 });
}
