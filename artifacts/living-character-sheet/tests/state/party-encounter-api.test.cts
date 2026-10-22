import assert from "node:assert/strict";
import test from "node:test";
import { partyHostApi } from "../../utils/partyHostApi";
import { orchestrateCampaignEncounterIntent, type CampaignEncounterOrchestrationDeps } from "../../utils/adventure/campaignEncounterRuntime";

function fixture() {
  const rows = new Map<string, string>();
  const calls: Array<{ path: string; options?: RequestInit }> = [];
  let failure: Error | undefined;
  const result = { ok: true as const, battleId: "battle", currentTurnId: "member", currentTurnIdByBattle: { battle: "member" }, turnOrder: ["member"], battleTurnOrderById: { battle: ["member"] } };
  const storage = { getItem: async (key: string) => rows.get(key) ?? null, setItem: async (key: string, value: string) => { rows.set(key, value); }, removeItem: async (key: string) => { rows.delete(key); } };
  const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
    calls.push({ path, options });
    if (failure) throw failure;
    return (path === "/party/create" ? { code: "PARTY", hostToken: "private-host" } : result) as T;
  };
  return { rows, calls, storage, request, result, fail: (error: Error) => { failure = error; } };
}
const operations = [
  { name: "initiative start", path: "/party/PARTY/initiative/start", method: "POST", body: { includeEnvironment: false, targetMemberIds: ["member"], targetNpcIds: ["npc"] }, run: (api: ReturnType<typeof partyHostApi>, code: string) => api.startPartyInitiative(code, false, ["member"], ["npc"]) },
  { name: "encounter end", path: "/party/PARTY/encounters/battle", method: "DELETE", body: undefined, run: (api: ReturnType<typeof partyHostApi>, code: string) => api.endEncounter(code, "battle") },
  { name: "participant add", path: "/party/PARTY/encounters/battle/participants", method: "POST", body: { memberIds: ["member"], npcIds: ["npc"] }, run: (api: ReturnType<typeof partyHostApi>, code: string) => api.addToEncounter(code, "battle", ["member"], ["npc"]) },
];
for (const op of operations) {
  test(`${op.name} reuses stored host proof after reload and preserves request/result`, async () => {
    const f = fixture(); await partyHostApi(f.request, f.storage).createParty();
    const result = await op.run(partyHostApi(f.request, f.storage), "PARTY");
    assert.deepEqual(f.calls[1], { path: op.path, options: { method: op.method, headers: { Authorization: "Bearer private-host", "Content-Type": "application/json" }, ...(op.body ? { body: JSON.stringify(op.body) } : {}) } });
    assert.deepEqual(result, op.name === "initiative start" ? f.result : undefined);
    assert.equal(f.rows.get("party-host-token.v1:PARTY"), "private-host");
  });
  test(`${op.name} cannot use member storage, watch code or another party's host proof`, async () => {
    const f = fixture(), api = partyHostApi(f.request, f.storage);
    f.rows.set("party-member-token.v1:PARTY:member", "member-proof");
    await assert.rejects(op.run(api, "PARTY"), /Only the device/); assert.equal(f.calls.length, 0);
    await api.createParty(); await assert.rejects(op.run(api, "OTHER"), /Only the device/); assert.equal(f.calls.length, 1);
  });
  for (const failure of [new Error("Network unavailable"), Object.assign(new Error("Host rejected"), { status: 403, code: "party_host_required" })]) {
    test(`${op.name}: ${failure.message} keeps credentials and propagates failure`, async () => {
      const f = fixture(), api = partyHostApi(f.request, f.storage); await api.createParty(); f.fail(failure);
      await assert.rejects(op.run(api, "PARTY"), error => error === failure);
      assert.equal(f.rows.get("party-host-token.v1:PARTY"), "private-host"); assert.equal(f.calls.length, 2);
    });
  }
}
test("AI DM/default initiative start retains includeEnvironment and omitted targets", async () => {
  const f = fixture(), api = partyHostApi(f.request, f.storage); await api.createParty();
  await api.startPartyInitiative("PARTY"); assert.deepEqual(JSON.parse(String(f.calls[1].options?.body)), { includeEnvironment: true });
});
for (const hasHost of [true, false]) {
  test(`campaign encounter orchestration with ${hasHost ? "host" : "member only"} uses real capability adapter`, async () => {
    const f = fixture(), api = partyHostApi(f.request, f.storage);
    if (hasHost) await api.createParty(); else f.rows.set("party-member-token.v1:PARTY:member", "member-proof");
    const downstream: string[] = [];
    const deps: CampaignEncounterOrchestrationDeps = {
      startPartyInitiative: api.startPartyInitiative,
      addCombatNpc: async () => { downstream.push("npc"); return { ok: true }; },
      createPartyRollRequest: async () => { downstream.push("roll"); return { ok: true }; },
      refreshCombatState: async () => { downstream.push("refresh"); return { ok: true }; },
    };
    const run = () => orchestrateCampaignEncounterIntent({ partyCode: "PARTY", memberIds: ["member"], combatState: null, encounterIntent: { requiresEncounterStart: true, hostileCreatureName: "Bandit", promptRolls: [{ statKey: "initiative", label: "Initiative" }], narrationBlockedUntilResolved: true }, deps });
    if (!hasHost) { await assert.rejects(run(), /Only the device/); assert.deepEqual(downstream, []); assert.deepEqual(f.calls, []); return; }
    const result = await run(); assert.equal(result.startedNewEncounter, true); assert.equal(result.battleId, "battle");
    assert.deepEqual(f.calls[1].options?.headers, { Authorization: "Bearer private-host", "Content-Type": "application/json" });
    assert.deepEqual(JSON.parse(String(f.calls[1].options?.body)), { includeEnvironment: true, targetMemberIds: ["member"] });
    assert.deepEqual(downstream, ["npc", "roll", "refresh"]);
  });
}
