import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router, RuntimeConflictError } = await import("./party");
const layers = router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }> };
const handler = (path: string, method: string) => layers.stack.find(x => x.route?.path === path && x.route.methods[method])!.route!.stack[0].handle;
const host = issuePartyHostToken(), owner = issuePartyHostToken(), other = issuePartyHostToken();
let serial = 0;
function response() {
  return { statusCode: 200, body: {} as Record<string, any>, status(n: number) { this.statusCode = n; return this; }, json(body: Record<string, any>) { this.body = body; return this; } };
}
function fixture(t: TestContext) {
  const code = `departure-${++serial}`, now = new Date();
  const npc = (id: string, memberId?: string) => ({
    id, name: id, sourceType: "character", sourceId: "pet", disposition: "friendly",
    coreStats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, initiativeBonus: 0 },
    visibleStatKeys: [], dummyState: { maxHp: 12, currentHp: 3, actionUsed: true, reactionUsed: true, movementUsed: 15, armorClass: 12 },
    conditions: [{ id: "poisoned", name: "Poisoned" }], gear: [{ id: "kept", name: "Kept gear", category: "gear", equipped: true, armorClassBonus: undefined, attackBonus: undefined, damageDice: undefined, damageModifier: undefined, damageType: undefined, notes: undefined, range: undefined }],
    projection: { combatantKind: "companion", companionId: "pet", ownerMemberId: "owner", ownerCharacterId: "same-label" },
    ...(memberId ? { companionAdmission: { schemaVersion: "companion-admission.v1", memberId, companionId: "pet" } } : {}),
    createdAt: now.toISOString(),
  });
  let committed: any = {
    members: ["owner", "other"].map(id => ({ id, partyCode: code, memberTokenHash: id === "owner" ? owner.hostTokenHash : other.hostTokenHash, characterName: id, characterClass: "Wizard", maxHp: 10, currentHp: 10, armorClass: 12, updatedAt: now })),
    runtime: { partyCode: code, schemaVersion: 1, stateRevision: 1, updatedAt: now, snapshot: {
      includeEnvironment: false, activeMemberIds: ["owner", "other"],
      combatNpcs: [npc("owned", "owner"), npc("unrelated", "other"), npc("legacy")],
      participantBattleById: { owner: "battle", other: "battle", owned: "battle", unrelated: "battle", legacy: "battle" },
      currentTurnIdByBattle: { battle: "owned" }, battleTurnOrderById: { battle: ["owner", "owned", "other", "unrelated", "legacy"] },
      initiativeByMember: Object.fromEntries(["owner", "owned", "other", "unrelated", "legacy"].map(memberId => [memberId, { memberId, initiativeRoll: 10, initiativeBonus: 0, initiativeTotal: 10 }])),
      playerEconomyByMember: { owner: { action: 0 }, owned: { action: 0 }, other: { action: 1 } },
    } },
  };
  const controls = { failWrite: false, failDelete: false, failCommit: false, conflict: false, revoke: false, serialization: false, revokeHost: false, expired: false };
  let transactions = 0, writes = 0;
  const query = (state: any, scoped: boolean): any => ({
    select: () => ({ from: (table: unknown) => ({ where: (condition: never) => {
      const params = new PgDialect().sqlToQuery(condition).params;
      let rows = table === partySessions ? [{ code, hostTokenHash: host.hostTokenHash, lastActivityAt: controls.expired ? new Date(0) : now }]
        : table === partyMembers ? state.members.filter((m: any) => (params.length < 2 || m.id === params[0]) && m.partyCode === (params.length < 2 ? params[0] : params[1]))
        : state.runtime ? [state.runtime] : [];
      if (scoped && controls.revokeHost && table === partySessions) rows = rows.map((row: any) => ({ ...row, hostTokenHash: other.hostTokenHash }));
      if (scoped && controls.revoke && table === partyMembers) rows = rows.map((m: any) => ({ ...m, memberTokenHash: other.hostTokenHash }));
      const copy = structuredClone(rows);
      return Object.assign(Promise.resolve(copy), { limit: async () => copy, for: async (lock: string) => { assert.equal(lock, "update"); return copy; } });
    } }) }),
    update: (table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: (condition: never) => ({ returning: async () => {
      assert.equal(scoped, true, "runtime writes must use transaction executor");
      assert.equal(table, partyRuntimeSnapshots);
      if (controls.failWrite) throw Error("write failed");
      const params = new PgDialect().sqlToQuery(condition).params;
      if (controls.conflict || params[1] !== state.runtime.stateRevision) return [];
      writes++; state.runtime = { ...state.runtime, ...structuredClone(value) }; return [state.runtime];
    } }) }) }),
    delete: (table: unknown) => ({ where: async () => {
      assert.equal(scoped, true, "member deletion must use transaction executor");
      assert.equal(table, partyMembers);
      if (controls.failDelete) throw Error("delete failed");
      writes++; state.members = state.members.filter((m: any) => m.id !== "owner");
    } }),
  });
  t.mock.method(db, "update", ((table: unknown) => { assert.equal(table, partySessions); return { set: () => ({ where: async () => [] }) }; }) as never);
  t.mock.method(db, "delete", (() => { throw Error("Global deletion is forbidden"); }) as never);
  t.mock.method(db, "select", (() => query(committed, false).select()) as never);
  t.mock.method(db, "transaction", (async (callback: (tx: unknown) => Promise<unknown>, options: unknown) => {
    assert.deepEqual(options, { isolationLevel: "serializable" }); transactions++;
    const staged = structuredClone(committed);
    const result = await callback(query(staged, true));
    if (controls.failCommit) throw Error("commit failed");
    if (controls.serialization) throw Object.assign(Error("query failed"), { cause: { code: "40001" } });
    committed = staged; return result;
  }) as never);
  async function leave(token = owner.hostToken) {
    const res = response();
    await handler("/party/leave", "delete")({ body: { partyCode: code, memberId: "owner" }, get: () => `Bearer ${token}` }, res);
    return res;
  }
  async function read() {
    const res = response();
    await handler("/party/:code/combat-state", "get")({ params: { code }, get: () => undefined }, res);
    return res;
  }
  async function recover(payload?: Record<string, unknown>, token = host.hostToken) {
    const res = response(), binding = committed.runtime?.snapshot.combatNpcs[0].companionAdmission;
    const body = payload ?? { targetMemberId: "other", expectedRevision: committed.runtime.stateRevision,
      expectedDetachedAt: binding?.detachedAt, reason: "Owner rejoined with a new membership." };
    await handler("/party/:code/combat-npcs/:npcId/recover-companion", "post")({
      params: { code, npcId: "owned" }, body, get: () => `Bearer ${token}`,
    }, res);
    return res;
  }
  return { leave, read, recover, controls, state: () => structuredClone(committed), mutate: (fn: (s: any) => void) => fn(committed), transactions: () => transactions, writes: () => writes };
}
for (const [label, token] of [["self", owner.hostToken], ["host", host.hostToken]]) {
  test(`cold-cache ${label} departure atomically detaches only bound companions and retains live data`, async t => {
    const f = fixture(t), before = f.state(), res = await f.leave(token);
    assert.equal(res.statusCode, 200);
    const after = f.state(); assert.deepEqual(after.members.map((m: any) => m.id), ["other"]);
    const snapshot = after.runtime.snapshot, pet = snapshot.combatNpcs.find((n: any) => n.id === "owned");
    assert.ok(pet.companionAdmission.detachedAt);
    assert.deepEqual(pet, { ...before.runtime.snapshot.combatNpcs[0], companionAdmission: { ...before.runtime.snapshot.combatNpcs[0].companionAdmission, detachedAt: pet.companionAdmission.detachedAt } });
    assert.equal(snapshot.participantBattleById.owned, undefined);
    assert.equal(snapshot.initiativeByMember.owned, undefined);
    assert.equal(snapshot.playerEconomyByMember.owned, undefined);
    assert.equal(snapshot.playerEconomyByMember.owner, undefined);
    assert.deepEqual(snapshot.combatNpcs.slice(1), before.runtime.snapshot.combatNpcs.slice(1));
    assert.equal(snapshot.participantBattleById.unrelated, "battle");
    assert.equal(snapshot.participantBattleById.legacy, "battle");
    assert.equal(snapshot.battleTurnOrderById.battle.includes("owned"), false);
    assert.equal(snapshot.battleTurnOrderById.battle.includes("owner"), false);
    assert.notEqual(snapshot.currentTurnIdByBattle.battle, "owned");
    assert.equal(snapshot.eventLog.filter((e: any) => e.type === "party_member_left").length, 1);
    assert.equal(after.runtime.stateRevision, 2);
  });
}
for (const failure of ["failWrite", "failDelete", "failCommit"] as const) {
  test(`${failure} rolls back membership and companion cleanup together`, async t => {
    const f = fixture(t), before = f.state(); f.controls[failure] = true;
    const res = await f.leave(); assert.equal(res.statusCode, 500); assert.deepEqual(f.state(), before);
    f.controls[failure] = false; assert.equal((await f.leave()).statusCode, 200);
  });
}
test("runtime revision conflict leaves membership and companions intact", async t => {
  const f = fixture(t), before = f.state(); f.controls.conflict = true;
  await assert.rejects(f.leave(), RuntimeConflictError); assert.deepEqual(f.state(), before);
});
test("proof is revalidated inside the transaction before runtime writes", async t => {
  const f = fixture(t), before = f.state(); f.controls.revoke = true;
  assert.equal((await f.leave()).statusCode, 403); assert.deepEqual(f.state(), before); assert.equal(f.writes(), 0);
});
test("foreign member proof never starts a departure transaction", async t => {
  const f = fixture(t); assert.equal((await f.leave(other.hostToken)).statusCode, 403);
  assert.equal(f.transactions(), 0);
});
test("warm stale cache is ignored and invalidated only after durable commit", async t => {
  const f = fixture(t); assert.equal((await f.read()).statusCode, 200);
  f.mutate(s => { s.runtime.stateRevision++; s.runtime.snapshot.combatNpcs[0].dummyState.currentHp = 1; });
  assert.equal((await f.leave()).statusCode, 200);
  assert.equal(f.state().runtime.snapshot.combatNpcs[0].dummyState.currentHp, 1);
  const res = await f.read(); assert.equal(res.statusCode, 200);
  assert.equal(res.body.combatNpcs[0].companionAdmission.detachedAt !== undefined, true);
  assert.equal(res.body.turnOrder.includes("owned"), false);
});
test("host retry is idempotent; removed member proof cannot reclaim membership", async t => {
  const f = fixture(t); await f.leave();
  const committed = f.state(); assert.equal((await f.leave(host.hostToken)).statusCode, 200);
  assert.deepEqual(f.state(), committed); assert.equal((await f.leave()).statusCode, 403);
});
test("departure with no durable runtime deletes membership without inventing a snapshot", async t => {
  const f = fixture(t); f.mutate(s => { s.runtime = null; });
  assert.equal((await f.leave()).statusCode, 200);
  assert.equal(f.state().runtime, null); assert.equal(f.state().members.length, 1);
});
test("re-enrolled identity and matching labels do not reactivate retained companions", async t => {
  const f = fixture(t); await f.leave();
  f.mutate(s => { s.members.push({ ...s.members[0], id: "new-owner", characterName: "owner" }); });
  const res = await f.read();
  assert.equal(res.statusCode, 200); assert.ok(res.body.combatNpcs[0].companionAdmission.detachedAt);
  assert.equal(res.body.participantBattleById.owned, undefined);
});

test("wrapped PostgreSQL serialization failure returns conflict without publishing cleanup", async t => {
  const f = fixture(t), before = f.state(); f.controls.serialization = true;
  await assert.rejects(f.leave(), RuntimeConflictError); assert.deepEqual(f.state(), before);
});
test("host cannot add a retained detached companion back through encounter participants", async t => {
  const f = fixture(t); await f.leave();
  const res = response();
  // This fixture's party code is obtained from its durable snapshot.
  const code = f.state().runtime.partyCode;
  await handler("/party/:code/encounters/:battleId/participants", "post")({
    params: { code, battleId: "battle" }, body: { npcIds: ["owned"] }, get: () => `Bearer ${host.hostToken}`,
  }, res);
  assert.equal(res.statusCode, 400); assert.equal(res.body.error, "No valid participants to add");
  assert.equal(f.state().runtime.snapshot.participantBattleById.owned, undefined);
});

test("recovery requires host proof and preserves all live data while recording reassignment", async t => {
  const f = fixture(t); await f.leave();
  f.mutate(s => { s.runtime.snapshot.combatNpcs[1].companionAdmission.companionId = "different"; });
  const before = f.state().runtime.snapshot.combatNpcs[0];
  const res = await f.recover(); assert.equal(res.statusCode, 200);
  const after = f.state().runtime.snapshot, npc = after.combatNpcs[0];
  assert.deepEqual(npc.dummyState, before.dummyState);
  assert.deepEqual(npc.conditions, before.conditions); assert.deepEqual(npc.gear, before.gear);
  assert.equal(npc.companionAdmission.memberId, "other");
  assert.equal(npc.companionAdmission.companionId, "pet");
  assert.equal(npc.companionAdmission.detachedAt, undefined);
  assert.equal(npc.companionAdmission.recoveredFrom.memberId, "owner");
  assert.equal(npc.companionAdmission.recoveredFrom.detachedAt, before.companionAdmission.detachedAt);
  assert.equal(npc.projection.ownerMemberId, "other");
  assert.equal(after.participantBattleById.owned, undefined);
  assert.equal(after.initiativeByMember.owned, undefined);
  assert.equal(after.playerEconomyByMember.owned, undefined);
  assert.equal(after.turnOrder.includes("owned"), false);
  const event = after.eventLog[0]; assert.equal(event.type, "companion_recovered");
  assert.equal(event.metadata.previousMemberId, "owner"); assert.equal(event.metadata.targetMemberId, "other");
  assert.equal(event.metadata.actor, "original_host"); assert.ok(event.metadata.reason);
  assert.equal((await f.read()).body.combatNpcs[0].companionAdmission.memberId, "other");
});
for (const token of [owner.hostToken, other.hostToken, "forged"]) {
  test("recovery refuses member/forged proof without starting a transaction", async t => {
    const f = fixture(t); await f.leave(); const before = f.state(), count = f.transactions();
    assert.equal((await f.recover(undefined, token)).statusCode, 403);
    assert.deepEqual(f.state(), before); assert.equal(f.transactions(), count);
  });
}
test("recovery revalidates the original host inside its transaction", async t => {
  const f = fixture(t); await f.leave(); const before = f.state(); f.controls.revokeHost = true;
  assert.equal((await f.recover()).statusCode, 403); assert.deepEqual(f.state(), before);
});
for (const target of ["absent", "legacy"]) {
  test(`recovery refuses ${target} target membership`, async t => {
    const f = fixture(t); await f.leave();
    f.mutate(s => { if (target === "absent") s.members = []; else s.members[0].memberTokenHash = null; });
    const before = f.state(); assert.equal((await f.recover()).statusCode, 400); assert.deepEqual(f.state(), before);
  });
}
test("recovery refuses an already-bound target identity without replacing either instance", async t => {
  const f = fixture(t); await f.leave(); const before = f.state();
  // 'unrelated' already belongs to other/pet.
  const res = await f.recover(); assert.equal(res.statusCode, 409); assert.deepEqual(f.state(), before);
});
test("recovery rejects stale reviewed revision and exact detachment mismatch", async t => {
  const f = fixture(t); await f.leave(); const before = f.state(), stamp = before.runtime.snapshot.combatNpcs[0].companionAdmission.detachedAt;
  await assert.rejects(f.recover({ targetMemberId: "other", expectedRevision: 1, expectedDetachedAt: stamp, reason: "Review stale" }), RuntimeConflictError);
  assert.equal((await f.recover({ targetMemberId: "other", expectedRevision: 2, expectedDetachedAt: "different", reason: "Wrong instance" })).statusCode, 409);
  assert.deepEqual(f.state(), before);
});
test("recovery refuses legacy and non-detached instances", async t => {
  const f = fixture(t);
  assert.equal((await f.recover({ targetMemberId: "other", expectedRevision: 1, expectedDetachedAt: "forged", reason: "Wrong instance" })).statusCode, 409);
  await f.leave(); f.mutate(s => { delete s.runtime.snapshot.combatNpcs[0].companionAdmission; });
  assert.equal((await f.recover({ targetMemberId: "other", expectedRevision: 2, expectedDetachedAt: "forged", reason: "Legacy instance" })).statusCode, 409);
});
for (const fault of ["failWrite", "failCommit", "conflict", "serialization"] as const) {
  test(`recovery ${fault} preserves retained data and binding`, async t => {
    const f = fixture(t); await f.leave();
    f.mutate(s => { s.runtime.snapshot.combatNpcs[1].companionAdmission.companionId = "different"; });
    const before = f.state(); f.controls[fault] = true;
    if (fault === "conflict" || fault === "serialization") await assert.rejects(f.recover(), RuntimeConflictError);
    else assert.equal((await f.recover()).statusCode, 500);
    assert.deepEqual(f.state(), before);
  });
}
test("lost acknowledgement retry fails closed without second binding change or event", async t => {
  const f = fixture(t); await f.leave();
  f.mutate(s => { s.runtime.snapshot.combatNpcs[1].companionAdmission.companionId = "different"; });
  const stamp = f.state().runtime.snapshot.combatNpcs[0].companionAdmission.detachedAt;
  const request = { targetMemberId: "other", expectedRevision: 2, expectedDetachedAt: stamp, reason: "Restore to owner" };
  assert.equal((await f.recover(request)).statusCode, 200); const committed = f.state();
  await assert.rejects(f.recover(request), RuntimeConflictError); assert.deepEqual(f.state(), committed);
  assert.equal(committed.runtime.snapshot.eventLog.filter((e: any) => e.type === "companion_recovered").length, 1);
});
test("recovery validates review fields before transactions and ignores submitted combat overrides", async t => {
  const f = fixture(t); await f.leave();
  const count = f.transactions();
  assert.equal((await f.recover({ targetMemberId: "other", reason: "ok" })).statusCode, 400);
  assert.equal(f.transactions(), count);
  f.mutate(s => { s.runtime.snapshot.combatNpcs[1].companionAdmission.companionId = "different"; });
  const state = f.state(), stamp = state.runtime.snapshot.combatNpcs[0].companionAdmission.detachedAt;
  assert.equal((await f.recover({ targetMemberId: "other", expectedRevision: 2, expectedDetachedAt: stamp, reason: "Restore owner", dummyState: { currentHp: 999 }, battleId: "injected", companionId: "forged" })).statusCode, 200);
  const npc = f.state().runtime.snapshot.combatNpcs[0];
  assert.equal(npc.dummyState.currentHp, 3); assert.equal(npc.companionAdmission.companionId, "pet");
  assert.equal(f.state().runtime.snapshot.participantBattleById.owned, undefined);
});

test("recovery cannot target a member from another party", async t => {
  const f = fixture(t); await f.leave(); f.mutate(s => { s.members[0].partyCode = "another-party"; });
  const before = f.state(); assert.equal((await f.recover()).statusCode, 400); assert.deepEqual(f.state(), before);
});
test("expired party recovery fails before runtime writes", async t => {
  const f = fixture(t); await f.leave(); const before = f.state(); f.controls.expired = true;
  assert.equal((await f.recover()).statusCode, 404); assert.deepEqual(f.state(), before);
});
test("missing durable snapshot fails as a conflict without recreating runtime", async t => {
  const f = fixture(t); await f.leave(); f.mutate(s => { s.runtime = null; });
  await assert.rejects(f.recover({ targetMemberId: "other", expectedRevision: 2, expectedDetachedAt: "stamp", reason: "Review missing state" }), RuntimeConflictError);
  assert.equal(f.state().runtime, null);
});
