import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router } = await import("./party");
const stack = router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }> };
const owner = issuePartyHostToken(), other = issuePartyHostToken(), host = issuePartyHostToken();
const report = { type: "player_attack_used", message: "Attack", memberId: "member", metadata: { targetId: "npc", reportedBy: "host" } };
const target = { applyState: "preview_only", authority: { reason: "remote_npc_preview_only" }, targetType: "npc", targetId: "npc", damageBreakdown: { hpDamage: 3, tempHpAbsorbed: 0 } };
const lootItem = { name: "Ring", quantity: 1, category: "magic", inventoryItem: { name: "Ring", effects: [{ type: "fire_immunity" }] } };
const operations = [
  { path: "end-turn", body: { memberId: "member", battleId: "beta" }, mixed: true },
  { path: "economy/spend", body: { memberId: "member", slot: "reaction" }, mixed: false },
  { path: "economy/reset", body: { memberId: "member" }, mixed: false },
  { path: "combat/apply-outcomes", body: { commandId: "command", sourceMemberId: "member", targetResults: [target] }, mixed: false },
  { path: "events", body: report, mixed: true },
  { path: "loot-assignments", body: { targetMemberIds: ["other", "foreign"], items: [lootItem], assignedBy: "member" }, mixed: true },
];
let serial = 0;
function response() { return { statusCode: 200, body: {} as Record<string, any>, status(code: number) { this.statusCode = code; return this; }, json(body: Record<string, any>) { this.body = body; return this; } }; }
async function invoke(path: string, code: string, body: unknown, token: string | undefined) {
  const handler = stack.stack.find(layer => layer.route?.path === `/party/:code/${path}` && layer.route.methods.post)!.route!.stack[0].handle;
  const res = response(); await handler({ params: { code }, body, get: () => token }, res); return res;
}
function fixture(t: TestContext, snapshot: Record<string, any> = {}) {
  const code = `remaining-${++serial}`, now = new Date();
  let durable: Record<string, any> = { partyCode: code, schemaVersion: 1, stateRevision: 1, updatedAt: now, snapshot: {
    participantBattleById: { other: "alpha", member: "beta", npc: "beta" },
    currentTurnIdByBattle: { alpha: "other", beta: "member" }, includeEnvironment: false,
    combatNpcs: [{ id: "npc", name: "Target", sourceType: "manual", disposition: "hostile", dummyState: { maxHp: 12, currentHp: 12, armorClass: 13 } }],
    playerEconomyByMember: { member: { actionsUsed: 1, bonusActionsUsed: 1, reactionUsed: true, movementUsedFeet: 20 } },
    ...snapshot,
  } };
  let writes = 0;
  t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: (condition: never) => {
    const params = new PgDialect().sqlToQuery(condition).params;
    if (table === partySessions) assert.deepEqual(params, [code]);
    if (table === partyMembers) assert.deepEqual(params, params.length === 2 ? ["member", code] : [code]);
    const rows = table === partySessions ? [{ hostTokenHash: host.hostTokenHash, lastActivityAt: now }] : table === partyMembers ? [
      { id: "member", memberTokenHash: owner.hostTokenHash, characterName: "Player", characterClass: "Wizard", maxHp: 10, currentHp: 10, armorClass: 12, updatedAt: now },
      { id: "other", characterName: "Other", characterClass: "Wizard", maxHp: 10, currentHp: 10, armorClass: 12, updatedAt: now },
    ] : [durable];
    return Object.assign(Promise.resolve(rows), { limit: async () => rows });
  } }) })) as never);
  t.mock.method(db, "update", ((table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: () => Object.assign(Promise.resolve([]), { returning: async () => {
    assert.equal(table, partyRuntimeSnapshots); writes++; durable = { ...durable, ...value }; return [durable];
  } }) }) })) as never);
  return { code, saved: () => durable.snapshot, writes: () => writes };
}
for (const op of operations) {
  for (const [label, authorization, hash, exists, expired] of [
    ["body-only proof", undefined, owner.hostTokenHash, true, false],
    ["other member/party", `Bearer ${other.hostToken}`, owner.hostTokenHash, true, false],
    ["legacy member", `Bearer ${owner.hostToken}`, null, true, false],
    ["removed member", `Bearer ${owner.hostToken}`, null, false, false],
    ["malformed bearer", owner.hostToken, owner.hostTokenHash, true, false],
    ["hash as token", `Bearer ${owner.hostTokenHash}`, owner.hostTokenHash, true, false],
    ["expired party without proof", undefined, owner.hostTokenHash, true, true],
  ] as const) {
    test(`${op.path} rejects ${label} before any activity/runtime writes`, async t => {
      const code = `denied-${++serial}`, reads: unknown[] = [];
      t.mock.method(db, "select", (() => ({ from: (table: unknown) => { reads.push(table); return { where: async (condition: never) => {
        assert.deepEqual(new PgDialect().sqlToQuery(condition).params, table === partySessions ? [code] : ["member", code]);
        return table === partySessions ? [{ hostTokenHash: host.hostTokenHash, lastActivityAt: expired ? new Date(0) : new Date() }] : exists ? [{ memberTokenHash: hash }] : [];
      } }; } })) as never);
      for (const method of ["insert", "update", "delete"] as const) t.mock.method(db, method, (() => assert.fail("No denied writes")) as never);
      const res = await invoke(op.path, code, { ...op.body, memberToken: owner.hostToken, isDmOverride: true, role: "dm" }, authorization);
      assert.equal(res.statusCode, 403); assert.equal(res.body.code, "party_member_required"); assert.deepEqual(reads, [partySessions, partyMembers]);
    });
  }
  test(`${op.path} rejects an unknown party`, async t => {
    t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => [] }) })) as never);
    t.mock.method(db, "update", (() => assert.fail("No writes")) as never);
    assert.equal((await invoke(op.path, "missing", op.body, `Bearer ${owner.hostToken}`)).statusCode, 404);
  });
  test(`${op.path} authenticated member persists compatible state`, async t => {
    const f = fixture(t), res = await invoke(op.path, f.code, op.body, `Bearer ${owner.hostToken}`);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body)); assert.equal(f.writes(), 1);
    const saved = f.saved();
    if (op.path === "end-turn") { assert.equal(saved.currentTurnIdByBattle.beta, "npc"); assert.equal(saved.currentTurnIdByBattle.alpha, "other"); assert.equal(saved.playerEconomyByMember.member.actionsUsed, 0); }
    if (op.path === "economy/spend") assert.equal(saved.playerEconomyByMember.member.reactionUsed, true);
    if (op.path === "economy/reset") assert.deepEqual(saved.playerEconomyByMember.member, { actionsUsed: 0, bonusActionsUsed: 0, reactionUsed: false, movementUsedFeet: 0 });
    if (op.path === "combat/apply-outcomes") { assert.equal(res.body.appliedCount, 1); assert.equal(saved.combatNpcs[0].dummyState.currentHp, 9); }
    if (op.path === "events") { assert.equal(saved.eventLog[0].memberId, "member"); assert.equal(saved.eventLog[0].metadata.reportedBy, "member"); }
    if (op.path === "loot-assignments") { assert.equal(res.body.assignments.length, 1); assert.equal(saved.lootAssignments[0].assignedBy, "member"); assert.deepEqual(saved.lootAssignments[0].item.inventoryItem, lootItem.inventoryItem); }
    for (const secret of [owner.hostToken, owner.hostTokenHash, host.hostToken, host.hostTokenHash]) assert.equal(JSON.stringify(res.body).includes(secret), false);
  });
  if (!op.mixed) test(`${op.path} does not let host substitute for source member`, async t => {
    const f = fixture(t), res = await invoke(op.path, f.code, op.body, `Bearer ${host.hostToken}`);
    assert.equal(res.statusCode, 403); assert.equal(res.body.code, "party_member_required"); assert.equal(f.writes(), 0);
  });
}
for (const body of [{ memberId: "member", battleId: "alpha" }, { memberId: "member", battleId: "beta", isDmOverride: true }]) {
  test(`member cannot advance foreign battle or assert DM override: ${JSON.stringify(body)}`, async t => {
    const f = fixture(t), res = await invoke("end-turn", f.code, body, `Bearer ${owner.hostToken}`);
    assert.equal(res.statusCode, 403); assert.equal(f.writes(), 0);
  });
}
test("member with no active battle cannot initialize a turn", async t => {
  const f = fixture(t, { participantBattleById: {}, currentTurnIdByBattle: {} });
  assert.equal((await invoke("end-turn", f.code, { memberId: "member" }, `Bearer ${owner.hostToken}`)).statusCode, 403); assert.equal(f.writes(), 0);
});
test("member defaults to own battle rather than the legacy primary battle", async t => {
  const f = fixture(t); const res = await invoke("end-turn", f.code, { memberId: "member" }, `Bearer ${owner.hostToken}`);
  assert.equal(res.statusCode, 200); assert.equal(res.body.battleId, "beta"); assert.equal(f.saved().currentTurnIdByBattle.alpha, "other");
});
test("host can override a turn in the requested battle without member impersonation", async t => {
  const f = fixture(t); const res = await invoke("end-turn", f.code, { battleId: "beta", isDmOverride: true }, `Bearer ${host.hostToken}`);
  assert.equal(res.statusCode, 200); assert.equal(f.saved().currentTurnIdByBattle.beta, "npc");
});
for (const type of ["rest_approved", "loot_assigned", "turn_advanced", "combat_remote_outcome_applied", "player_economy_reset", "unknown"]) {
  test(`generic reports cannot counterfeit ${type}`, async t => {
    const f = fixture(t), res = await invoke("events", f.code, { ...report, type }, `Bearer ${owner.hostToken}`);
    assert.equal(res.statusCode, 400); assert.equal(f.writes(), 0);
  });
}
test("host report cannot impersonate a supplied member ID or forge server receipts", async t => {
  const f = fixture(t); const res = await invoke("events", f.code, report, `Bearer ${host.hostToken}`);
  assert.equal(res.statusCode, 200); assert.equal(f.saved().eventLog[0].memberId, undefined); assert.equal(f.saved().eventLog[0].metadata.reportedBy, "host");
  assert.equal((await invoke("events", f.code, { ...report, type: "rest_approved" }, `Bearer ${host.hostToken}`)).statusCode, 400); assert.equal(f.writes(), 1);
});
test("host award origin is server-derived; member transfers cannot assert DM origin", async t => {
  const f = fixture(t), op = operations[5];
  const denied = await invoke(op.path, f.code, { ...op.body, assignedBy: "dm" }, `Bearer ${owner.hostToken}`);
  assert.equal(denied.statusCode, 403); assert.equal(f.writes(), 0);
  const res = await invoke(op.path, f.code, op.body, `Bearer ${host.hostToken}`);
  assert.equal(res.statusCode, 200); assert.equal(res.body.assignments[0].assignedBy, "dm"); assert.match(f.saved().eventLog[0].message, /^DM assigned/);
});
test("remote apply replay requires fresh proof and never applies twice", async t => {
  const f = fixture(t), op = operations[3];
  assert.equal((await invoke(op.path, f.code, op.body, `Bearer ${owner.hostToken}`)).statusCode, 200);
  const res = await invoke(op.path, f.code, op.body, `Bearer ${owner.hostToken}`);
  assert.equal(res.statusCode, 200); assert.equal(res.body.replayed, true); assert.equal(f.writes(), 1); assert.equal(f.saved().combatNpcs[0].dummyState.currentHp, 9);
  assert.equal((await invoke(op.path, f.code, op.body, undefined)).statusCode, 403); assert.equal(f.writes(), 1);
});
test("reaction spend remains valid outside own turn; remote apply and end-turn do not", async t => {
  const f = fixture(t, { currentTurnIdByBattle: { alpha: "other", beta: "npc" } });
  assert.equal((await invoke("economy/spend", f.code, operations[1].body, `Bearer ${owner.hostToken}`)).statusCode, 200);
  assert.equal((await invoke("end-turn", f.code, operations[0].body, `Bearer ${owner.hostToken}`)).statusCode, 403);
  assert.equal((await invoke("combat/apply-outcomes", f.code, operations[3].body, `Bearer ${owner.hostToken}`)).statusCode, 403); assert.equal(f.writes(), 1);
});
for (const path of ["end-turn", "events", "loot-assignments"]) {
  test(`${path} cannot gain host authority by omitting member attribution`, async t => {
    const f = fixture(t), body = path === "end-turn" ? { isDmOverride: true } : path === "events" ? { type: "player_action_used", message: "Report" } : { ...operations[5].body, assignedBy: "dm" };
    const res = await invoke(path, f.code, body, `Bearer ${owner.hostToken}`);
    assert.equal(res.statusCode, 403); assert.equal(res.body.code, "party_host_required"); assert.equal(f.writes(), 0);
  });
}
for (const type of ["player_action_used", "player_bonus_action_used", "player_reaction_used", "player_object_interaction_used", "player_movement_used", "player_attack_used", "player_spell_cast"]) {
  test(`existing client report ${type} remains supported`, async t => {
    const f = fixture(t); assert.equal((await invoke("events", f.code, { ...report, type }, `Bearer ${owner.hostToken}`)).statusCode, 200);
    assert.equal(f.saved().eventLog[0].type, type);
  });
}
for (const slot of ["action", "bonusAction", "movement"]) {
  test(`own economy ${slot} preserves bounded spending rules`, async t => {
    const f = fixture(t); const res = await invoke("economy/spend", f.code, { memberId: "member", slot, amount: 5.8, actionLimit: 2, bonusActionLimit: 2 }, `Bearer ${owner.hostToken}`);
    assert.equal(res.statusCode, 200); const economy = f.saved().playerEconomyByMember.member;
    assert.equal(slot === "movement" ? economy.movementUsedFeet : slot === "action" ? economy.actionsUsed : economy.bonusActionsUsed, slot === "movement" ? 25 : 2);
  });
}
