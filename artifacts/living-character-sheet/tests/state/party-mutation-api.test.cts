import assert from "node:assert/strict";
import test from "node:test";
import { partyMemberApi, PartyMemberAccessError } from "../../utils/partyMemberApi";
import { partyHostApi } from "../../utils/partyHostApi";

function fixture() {
  const rows = new Map<string, string>([["party-member-token.v1:PARTY:member", "private-member"], ["party-host-token.v1:PARTY", "private-host"]]);
  const calls: Array<{ path: string; options?: RequestInit }> = [];
  let failure: Error | undefined;
  const reply = { ok: true, economy: { actionsUsed: 1, bonusActionsUsed: 0, reactionUsed: false, movementUsedFeet: 0 }, appliedCount: 1, replayed: false, assignments: [{ id: "loot" }] };
  const storage = { getItem: async (key: string) => rows.get(key) ?? null, setItem: async (key: string, value: string) => { rows.set(key, value); }, removeItem: async (key: string) => { rows.delete(key); } };
  const request = async <T>(path: string, options?: RequestInit): Promise<T> => { calls.push({ path, options }); if (failure) throw failure; return reply as T; };
  return { rows, calls, storage, request, reply, fail: (error: Error) => { failure = error; } };
}
const memberOps = [
  { path: "end-turn", body: { memberId: "member", battleId: "battle" }, run: (api: ReturnType<typeof partyMemberApi>, code: string) => api.sendPartyEndTurn(code, { memberId: "member", battleId: "battle" }) },
  { path: "economy/spend", body: { memberId: "member", slot: "action", amount: 1, actionLimit: 2 }, run: (api: ReturnType<typeof partyMemberApi>, code: string) => api.spendPlayerEconomy(code, "member", "action", 1, { actionLimit: 2 }) },
  { path: "economy/reset", body: { memberId: "member" }, run: (api: ReturnType<typeof partyMemberApi>, code: string) => api.resetPlayerEconomy(code, "member") },
  { path: "combat/apply-outcomes", body: { sourceMemberId: "member", commandId: "command", targetResults: [] }, run: (api: ReturnType<typeof partyMemberApi>, code: string) => api.applyRemoteCombatOutcomes(code, { sourceMemberId: "member", commandId: "command", targetResults: [] }) },
  { path: "events", body: { memberId: "member", type: "player_attack_used", message: "Attack" }, run: (api: ReturnType<typeof partyMemberApi>, code: string) => api.appendPartyEvent(code, { memberId: "member", type: "player_attack_used", message: "Attack" }) },
  { path: "loot-assignments", body: { assignedBy: "member", targetMemberIds: ["other"], items: [{ name: "Torch", quantity: 1, category: "gear" }] }, run: (api: ReturnType<typeof partyMemberApi>, code: string) => api.createPartyLootAssignments(code, { assignedBy: "member", targetMemberIds: ["other"], items: [{ name: "Torch", quantity: 1, category: "gear" }] }) },
];
for (const op of memberOps) {
  test(`${op.path} sends only the exact member credential after reload`, async () => {
    const f = fixture(), result = await op.run(partyMemberApi(f.request, f.storage), "PARTY");
    assert.equal(f.calls.length, 1); assert.deepEqual(f.calls[0], { path: `/party/PARTY/${op.path}`, options: { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer private-member" }, body: JSON.stringify(op.body) } });
    if (op.path.startsWith("economy/")) assert.deepEqual(result, f.reply.economy);
    if (["combat/apply-outcomes", "loot-assignments"].includes(op.path)) assert.deepEqual(result, f.reply);
  });
  test(`${op.path} cannot fall back to host or another party's credential`, async () => {
    const f = fixture(), api = partyMemberApi(f.request, f.storage);
    await assert.rejects(op.run(api, "OTHER"), PartyMemberAccessError);
    f.rows.delete("party-member-token.v1:PARTY:member"); await assert.rejects(op.run(api, "PARTY"), PartyMemberAccessError); assert.equal(f.calls.length, 0);
  });
  for (const error of [new Error("Offline"), new Error("Not your turn"), new PartyMemberAccessError("Revoked")]) {
    test(`${op.path} propagates ${error.message} and clears only revoked proof`, async () => {
      const f = fixture(); f.fail(error);
      await assert.rejects(op.run(partyMemberApi(f.request, f.storage), "PARTY"), e => e === error);
      assert.equal(f.rows.has("party-member-token.v1:PARTY:member"), !(error instanceof PartyMemberAccessError)); assert.equal(f.rows.get("party-host-token.v1:PARTY"), "private-host"); assert.equal(f.calls.length, 1);
    });
  }
}
const hostOps = [
  { path: "end-turn", run: (api: ReturnType<typeof partyHostApi>, code: string) => api.sendPartyEndTurn(code, { battleId: "battle", isDmOverride: true }) },
  { path: "events", run: (api: ReturnType<typeof partyHostApi>, code: string) => api.appendPartyEvent(code, { type: "player_attack_used", message: "Report" }) },
  { path: "loot-assignments", run: (api: ReturnType<typeof partyHostApi>, code: string) => api.createPartyLootAssignments(code, { targetMemberIds: ["member"], items: [{ name: "Torch", quantity: 1, category: "gear" }], assignedBy: "dm" }) },
];
for (const op of hostOps) {
  test(`host ${op.path} requires original-host proof and retains it on failure`, async () => {
    const f = fixture(), api = partyHostApi(f.request, f.storage); await op.run(api, "PARTY");
    assert.equal(f.calls[0].path, `/party/PARTY/${op.path}`); assert.deepEqual(f.calls[0].options?.headers, { Authorization: "Bearer private-host", "Content-Type": "application/json" });
    f.fail(new Error("Offline")); await assert.rejects(op.run(api, "PARTY"), /Offline/); assert.equal(f.rows.get("party-host-token.v1:PARTY"), "private-host");
    await assert.rejects(op.run(api, "OTHER"), /Only the device/); f.rows.delete("party-host-token.v1:PARTY"); await assert.rejects(op.run(api, "PARTY"), /Only the device/); assert.equal(f.calls.length, 2);
  });
}
