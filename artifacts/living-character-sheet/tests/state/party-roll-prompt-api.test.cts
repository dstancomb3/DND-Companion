import assert from "node:assert/strict";
import test from "node:test";
import { partyHostApi } from "../../utils/partyHostApi";
import { orchestrateCampaignEncounterIntent, type CampaignEncounterOrchestrationDeps } from "../../utils/adventure/campaignEncounterRuntime";
import type { PartyCombatState } from "../../utils/partyApi";

function fixture() {
  const rows = new Map<string, string>();
  const calls: Array<{ path: string; options?: RequestInit }> = [];
  let failure: Error | undefined;
  const reply = { ok: true as const, request: { id: "prompt", statKey: "initiative", label: "Initiative", targetMemberIds: ["member"], battleId: "battle", createdAt: "now", responses: [] } };
  const storage = { getItem: async (key: string) => rows.get(key) ?? null, setItem: async (key: string, value: string) => { rows.set(key, value); }, removeItem: async (key: string) => { rows.delete(key); } };
  const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
    calls.push({ path, options }); if (failure) throw failure;
    return (path === "/party/create" ? { code: "PARTY", hostToken: "private-host" } : path.endsWith("/initiative/start") ? { battleId: "battle" } : reply) as T;
  };
  return { rows, calls, storage, request, reply, fail: (error: Error) => { failure = error; } };
}
const payload = { statKey: "initiative" as const, label: "Initiative", targetMemberIds: ["member"], battleId: "battle" };
test("roll prompt creation uses persisted host proof after reload with compatible body and response", async () => {
  const f = fixture(); await partyHostApi(f.request, f.storage).createParty();
  const result = await partyHostApi(f.request, f.storage).createPartyRollRequest("PARTY", payload);
  assert.deepEqual(result, f.reply);
  assert.deepEqual(f.calls[1], { path: "/party/PARTY/roll-requests", options: { method: "POST", headers: { Authorization: "Bearer private-host", "Content-Type": "application/json" }, body: JSON.stringify(payload) } });
  assert.equal(f.rows.get("party-host-token.v1:PARTY"), "private-host");
});
test("member, watcher and another party host cannot issue prompts without this party's local host proof", async () => {
  const f = fixture(), api = partyHostApi(f.request, f.storage);
  f.rows.set("party-member-token.v1:PARTY:member", "member-token");
  await assert.rejects(api.createPartyRollRequest("PARTY", payload), /create roll prompts/); assert.equal(f.calls.length, 0);
  await api.createParty(); await assert.rejects(api.createPartyRollRequest("OTHER", payload), /create roll prompts/); assert.equal(f.calls.length, 1);
});
for (const failure of [new Error("Network unavailable"), Object.assign(new Error("Host rejected"), { status: 403, code: "party_host_required" })]) {
  test(`roll prompt ${failure.message} retains credential and propagates error`, async () => {
    const f = fixture(), api = partyHostApi(f.request, f.storage); await api.createParty(); f.fail(failure);
    await assert.rejects(api.createPartyRollRequest("PARTY", payload), error => error === failure);
    assert.equal(f.rows.get("party-host-token.v1:PARTY"), "private-host"); assert.equal(f.calls.length, 2);
  });
}
test("non-combat prompt omits optional label/battle without adding role flags", async () => {
  const f = fixture(), api = partyHostApi(f.request, f.storage); await api.createParty();
  await api.createPartyRollRequest("PARTY", { statKey: "perception", targetMemberIds: ["member"] });
  assert.deepEqual(JSON.parse(String(f.calls[1].options?.body)), { statKey: "perception", targetMemberIds: ["member"] });
});
for (const reusedBattle of [false, true]) {
  for (const hasHost of [false, true]) {
    test(`campaign ${reusedBattle ? "reused" : "new"} battle with ${hasHost ? "host" : "member only"} uses the roll capability adapter`, async () => {
      const f = fixture(), api = partyHostApi(f.request, f.storage); if (hasHost) await api.createParty();
      else f.rows.set("party-member-token.v1:PARTY:member", "member-token");
      const downstream: string[] = [];
      const state = reusedBattle ? {
        participantBattleById: { member: "battle", npc: "battle" },
        battleTurnOrderById: { battle: ["member", "npc"] }, currentTurnIdByBattle: { battle: "member" },
        combatNpcs: [{ id: "npc", name: "Bandit", disposition: "hostile", sourceType: "manual" }], rollRequests: [],
      } as unknown as PartyCombatState : null;
      const deps: CampaignEncounterOrchestrationDeps = {
        startPartyInitiative: api.startPartyInitiative, createPartyRollRequest: api.createPartyRollRequest,
        addCombatNpc: async () => { downstream.push("npc"); return { ok: true }; },
        refreshCombatState: async () => { downstream.push("refresh"); return { ok: true }; },
      };
      const run = () => orchestrateCampaignEncounterIntent({ partyCode: "PARTY", memberIds: ["member"], combatState: state, encounterIntent: { requiresEncounterStart: true, hostileCreatureName: "Bandit", promptRolls: [{ statKey: "initiative", label: "Initiative" }], narrationBlockedUntilResolved: true }, deps });
      if (!hasHost && !reusedBattle) { await assert.rejects(run(), /Only the device/); assert.deepEqual(f.calls, []); assert.deepEqual(downstream, []); return; }
      const result = await run();
      if (!hasHost) {
        assert.deepEqual(result.failedRolls, ["initiative"]); assert.deepEqual(result.createdRolls, []); assert.deepEqual(f.calls, []);
        assert.deepEqual(downstream, ["refresh"]); return;
      }
      assert.deepEqual(result.createdRolls, ["initiative"]); assert.deepEqual(result.failedRolls, []);
      const prompt = f.calls.find(call => call.path === "/party/PARTY/roll-requests"); assert.ok(prompt);
      assert.deepEqual(prompt.options?.headers, { Authorization: "Bearer private-host", "Content-Type": "application/json" });
      assert.deepEqual(JSON.parse(String(prompt.options?.body)), payload);
      assert.equal(f.calls.some(call => call.path.endsWith("/initiative/start")), !reusedBattle);
    });
  }
}
