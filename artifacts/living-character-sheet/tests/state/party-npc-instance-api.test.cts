import assert from "node:assert/strict";
import test from "node:test";
import { partyHostApi } from "../../utils/partyHostApi";
function fixture() {
  const rows = new Map<string, string>([["party-host-token.v1:PARTY", "private-host"], ["party-member-token.v1:PARTY:member", "private-member"]]);
  const calls: Array<{ path: string; options?: RequestInit }> = [];
  const reply = { ok: true, npc: { id: "npc" }, initiativeTotal: 14 }; let failure: Error | undefined;
  const storage = { getItem: async (key: string) => rows.get(key) ?? null, setItem: async (key: string, value: string) => { rows.set(key, value); }, removeItem: async (key: string) => { rows.delete(key); } };
  const request = async <T>(path: string, options?: RequestInit): Promise<T> => { calls.push({ path, options }); if (failure) throw failure; return reply as T; };
  return { rows, calls, reply, storage, request, fail: (error: Error) => { failure = error; } };
}
const operations = [
  { suffix: "/dummy-state", method: "PUT", body: { currentHp: 5, actionUsed: true }, run: (api: ReturnType<typeof partyHostApi>, code: string) => api.updateCombatNpcDummyState(code, "npc", { currentHp: 5, actionUsed: true }) },
  { suffix: "/gear", method: "PUT", body: { gear: [{ id: "sword", name: "Sword", category: "weapon", equipped: true }] }, run: (api: ReturnType<typeof partyHostApi>, code: string) => api.updateCombatNpcGear(code, "npc", { gear: [{ id: "sword", name: "Sword", category: "weapon", equipped: true }] }) },
  { suffix: "/visible-stats", method: "PUT", body: { visibleStatKeys: ["speed"] }, run: (api: ReturnType<typeof partyHostApi>, code: string) => api.updateCombatNpcVisibleStats(code, "npc", { visibleStatKeys: ["speed"] }) },
  { suffix: "", method: "DELETE", run: (api: ReturnType<typeof partyHostApi>, code: string) => api.removeCombatNpc(code, "npc") },
  { suffix: "/initiative", method: "PUT", body: { initiativeRoll: 12, initiativeBonus: 2 }, run: (api: ReturnType<typeof partyHostApi>, code: string) => api.rollNpcInitiative(code, "npc", 12, 2) },
];
for (const op of operations) {
  test(`NPC ${op.suffix || "deletion"} uses persisted host proof after reload and compatible payload/result`, async () => {
    const f = fixture(); const result = await op.run(partyHostApi(f.request, f.storage), "PARTY");
    assert.deepEqual(f.calls, [{ path: `/party/PARTY/combat-npcs/npc${op.suffix}`, options: { method: op.method, headers: { Authorization: "Bearer private-host", "Content-Type": "application/json" }, ...(op.body ? { body: JSON.stringify(op.body) } : {}) } }]);
    assert.deepEqual(result, op.method === "DELETE" ? undefined : f.reply);
  });
  test(`NPC ${op.suffix || "deletion"} cannot use watcher/member/another party proof`, async () => {
    const f = fixture(), api = partyHostApi(f.request, f.storage);
    await assert.rejects(op.run(api, "OTHER"), /manage NPC instances/);
    f.rows.delete("party-host-token.v1:PARTY"); await assert.rejects(op.run(api, "PARTY"), /manage NPC instances/); assert.deepEqual(f.calls, []);
  });
  for (const error of [new Error("Offline"), Object.assign(new Error("Host rejected"), { status: 403, code: "party_host_required" })]) {
    test(`NPC ${op.suffix || "deletion"} propagates ${error.message} without clearing proof or retrying`, async () => {
      const f = fixture(); f.fail(error); await assert.rejects(op.run(partyHostApi(f.request, f.storage), "PARTY"), e => e === error);
      assert.equal(f.rows.get("party-host-token.v1:PARTY"), "private-host"); assert.equal(f.rows.get("party-member-token.v1:PARTY:member"), "private-member"); assert.equal(f.calls.length, 1);
    });
  }
}
test("AI encounter initiative can omit bonus while still requiring original host proof", async () => {
  const f = fixture(); const result = await partyHostApi(f.request, f.storage).rollNpcInitiative("PARTY", "npc", 12);
  assert.deepEqual(result, f.reply); assert.deepEqual(JSON.parse(String(f.calls[0].options?.body)), { initiativeRoll: 12 });
  assert.deepEqual(f.calls[0].options?.headers, { Authorization: "Bearer private-host", "Content-Type": "application/json" });
});

test("companion recovery uses persisted original host proof and exact reviewed revision", async () => {
  const f = fixture(), api = partyHostApi(f.request, f.storage);
  const payload = { targetMemberId: "new-owner", expectedRevision: 4, expectedDetachedAt: "2026-10-23T00:00:00.000Z", reason: "Owner rejoined" };
  assert.deepEqual(await api.recoverPartyCompanion("PARTY", "npc", payload), f.reply);
  assert.deepEqual(f.calls, [{ path: "/party/PARTY/combat-npcs/npc/recover-companion", options: {
    method: "POST", headers: { Authorization: "Bearer private-host", "Content-Type": "application/json" }, body: JSON.stringify(payload),
  } }]);
});
test("companion recovery has no watcher/member fallback or automatic retry", async () => {
  const f = fixture(), api = partyHostApi(f.request, f.storage);
  const payload = { targetMemberId: "new-owner", expectedRevision: 4, expectedDetachedAt: "stamp", reason: "Owner rejoined" };
  await assert.rejects(api.recoverPartyCompanion("OTHER", "npc", payload), /recover companions/);
  assert.equal(f.calls.length, 0);
  const conflict = Object.assign(new Error("Conflict"), { status: 409 }); f.fail(conflict);
  await assert.rejects(api.recoverPartyCompanion("PARTY", "npc", payload), e => e === conflict);
  assert.equal(f.calls.length, 1); assert.equal(f.rows.get("party-host-token.v1:PARTY"), "private-host");
});
