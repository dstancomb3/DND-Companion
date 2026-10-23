import assert from "node:assert/strict";
import test from "node:test";
import { partyHostApi } from "../../utils/partyHostApi";
import { partyMemberApi, PartyMemberAccessError } from "../../utils/partyMemberApi";
import { buildCompanionCombatNpcPayload } from "../../utils/combat/companionProjection";
import type { Companion } from "../../types";
function fixture() {
  const rows = new Map<string, string>([["party-host-token.v1:PARTY", "host-token"], ["party-member-token.v1:PARTY:member", "member-token"]]);
  const calls: Array<{ path: string; options?: RequestInit }> = []; let failure: Error | undefined;
  const reply = { ok: true, npc: { id: "npc" } };
  const storage = { getItem: async (key: string) => rows.get(key) ?? null, setItem: async (key: string, value: string) => { rows.set(key, value); }, removeItem: async (key: string) => { rows.delete(key); } };
  const request = async <T>(path: string, options?: RequestInit): Promise<T> => { calls.push({ path, options }); if (failure) throw failure; return reply as T; };
  return { rows, calls, reply, storage, request, fail: (error: Error) => { failure = error; } };
}
const hostPayload = { name: "Target", disposition: "hostile" as const, sourceType: "monster" as const, battleId: "battle" };
const companion = { id: "pet", name: "Companion", max_hit_points: 12, hit_points: 8, armor_class: 13, dexterity: 14, speed: "30 ft" } as Companion;
const payload = buildCompanionCombatNpcPayload({ companion, ownerMemberId: "member", ownerCharacterId: "local-character", battleId: "battle" });
test("DM/demo/AI host NPC creation uses persisted host credential and compatible payload", async () => {
  const f = fixture(); assert.deepEqual(await partyHostApi(f.request, f.storage).addCombatNpc("PARTY", hostPayload), f.reply);
  assert.deepEqual(f.calls, [{ path: "/party/PARTY/combat-npcs", options: { method: "POST", headers: { Authorization: "Bearer host-token", "Content-Type": "application/json" }, body: JSON.stringify(hostPayload) } }]);
});
test("member/watcher cannot create ordinary NPCs using the host adapter", async () => {
  const f = fixture(), api = partyHostApi(f.request, f.storage); await assert.rejects(api.addCombatNpc("OTHER", hostPayload), /create combat NPCs/);
  f.rows.delete("party-host-token.v1:PARTY"); await assert.rejects(api.addCombatNpc("PARTY", hostPayload), /create combat NPCs/); assert.deepEqual(f.calls, []);
});
test("player sheet companion builder uses only exact member proof after reload", async () => {
  const f = fixture(); assert.deepEqual(await partyMemberApi(f.request, f.storage).projectPartyCompanion("PARTY", payload), f.reply);
  assert.deepEqual(f.calls, [{ path: "/party/PARTY/combat-npcs", options: { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer member-token" }, body: JSON.stringify(payload) } }]);
  const body = JSON.parse(String(f.calls[0].options?.body)); assert.equal(body.sourceId, "pet"); assert.equal(body.dummyState.currentHp, 8); assert.equal(body.projection.ownerMemberId, "member");
});
test("companion path cannot fall back to host proof or use another member/party", async () => {
  const f = fixture(), api = partyMemberApi(f.request, f.storage);
  await assert.rejects(api.projectPartyCompanion("OTHER", payload), PartyMemberAccessError);
  await assert.rejects(api.projectPartyCompanion("PARTY", { ...payload, projection: { ...payload.projection!, ownerMemberId: "other" } }), PartyMemberAccessError);
  f.rows.delete("party-member-token.v1:PARTY:member"); await assert.rejects(api.projectPartyCompanion("PARTY", payload), PartyMemberAccessError); assert.deepEqual(f.calls, []);
});
test("companion path requires complete identity before issuing a request", async () => {
  const f = fixture(), api = partyMemberApi(f.request, f.storage);
  await assert.rejects(api.projectPartyCompanion("PARTY", hostPayload), /Companion and owner/);
  await assert.rejects(api.projectPartyCompanion("PARTY", { ...payload, projection: { combatantKind: "companion", ownerMemberId: "member" } }), /Companion and owner/); assert.deepEqual(f.calls, []);
});
for (const error of [new Error("Offline"), new Error("Wrong battle"), new PartyMemberAccessError("Revoked")]) {
  test(`companion ${error.message} propagates once and clears only explicit revoked credential`, async () => {
    const f = fixture(); f.fail(error); await assert.rejects(partyMemberApi(f.request, f.storage).projectPartyCompanion("PARTY", payload), e => e === error);
    assert.equal(f.calls.length, 1); assert.equal(f.rows.has("party-member-token.v1:PARTY:member"), !(error instanceof PartyMemberAccessError)); assert.equal(f.rows.get("party-host-token.v1:PARTY"), "host-token");
  });
}
for (const error of [new Error("Offline"), new Error("Host rejected")]) {
  test(`host creation ${error.message} retains proof without automatic retry`, async () => {
    const f = fixture(); f.fail(error); await assert.rejects(partyHostApi(f.request, f.storage).addCombatNpc("PARTY", hostPayload), e => e === error);
    assert.equal(f.calls.length, 1); assert.equal(f.rows.get("party-host-token.v1:PARTY"), "host-token");
  });
}
