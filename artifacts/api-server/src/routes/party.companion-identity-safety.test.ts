import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router, RuntimeConflictError } = await import("./party");
const stack = router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }> };
const owner = issuePartyHostToken(), other = issuePartyHostToken(), host = issuePartyHostToken(); let serial = 0;
const body = { name: "Companion", sourceType: "character", sourceId: "pet", disposition: "friendly", dummyState: { maxHp: 12, currentHp: 12, armorClass: 13 }, projection: { combatantKind: "companion", companionId: "pet", ownerMemberId: "owner", ownerCharacterId: "local-character" } };
const binding = { schemaVersion: "companion-admission.v1", memberId: "owner", companionId: "pet" };
function fixture(t: TestContext, npcs: unknown[] = []) {
  const code = `identity-${++serial}`, now = new Date(); let writes = 0, failNext = false;
  let hold: (() => Promise<void>) | undefined;
  let durable: Record<string, any> = { partyCode: code, schemaVersion: 1, stateRevision: 1, updatedAt: now, snapshot: { includeEnvironment: false, combatNpcs: npcs, participantBattleById: { owner: "battle", other: "battle" }, currentTurnIdByBattle: { battle: "owner" } } };
  t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: (condition: never) => {
    const params = new PgDialect().sqlToQuery(condition).params;
    const members = ["owner", "other"].map(id => ({ id, memberTokenHash: id === "owner" ? owner.hostTokenHash : other.hostTokenHash, characterName: id, characterClass: "Wizard", maxHp: 10, currentHp: 10, armorClass: 12, updatedAt: now }));
    const rows = table === partySessions ? [{ hostTokenHash: host.hostTokenHash, lastActivityAt: now }] : table === partyMembers ? params.length === 2 ? members.filter(m => m.id === params[0]) : members : [structuredClone(durable)];
    assert.deepEqual(params, table === partyMembers && params.length === 2 ? [params[0], code] : [code]);
    return Object.assign(Promise.resolve(rows), { limit: async () => rows });
  } }) })) as never);
  t.mock.method(db, "update", ((table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: (condition: never) => Object.assign(Promise.resolve([]), { returning: async () => {
    assert.equal(table, partyRuntimeSnapshots); const params = new PgDialect().sqlToQuery(condition).params; assert.equal(params[0], code);
    if (failNext) { failNext = false; throw new Error("Simulated write failure"); }
    const wait = hold; hold = undefined; if (wait) await wait();
    if (params[1] !== durable.stateRevision) return [];
    writes++; durable = structuredClone({ ...durable, ...value }); return [structuredClone(durable)];
  } }) }) })) as never);
  async function invoke(payload: unknown = body, token = owner.hostToken, suffix = "", method = "post", npcId?: string) {
    const handler = stack.stack.find(layer => layer.route?.path === `/party/:code/combat-npcs${suffix}` && layer.route.methods[method])!.route!.stack[0].handle;
    const res = { statusCode: 200, body: {} as Record<string, any>, status(n: number) { this.statusCode = n; return this; }, json(data: Record<string, any>) { this.body = data; return this; } };
    await handler({ params: { code, npcId }, body: payload, get: () => `Bearer ${token}` }, res); return res;
  }
  return { externalCommit: (update: (snapshot: Record<string, any>) => void) => { update(durable.snapshot); durable.stateRevision++; }, invoke, saved: () => structuredClone(durable.snapshot), writes: () => writes, fail: () => { failNext = true; }, holdWrite: (wait: () => Promise<void>) => { hold = wait; } };
}
test("repeat/lost acknowledgement reuses one committed companion and one creation event", async t => {
  const f = fixture(t), first = await f.invoke(), second = await f.invoke();
  assert.equal(first.statusCode, 200); assert.equal(first.body.reused, false); assert.deepEqual(first.body.npc.companionAdmission, binding);
  assert.equal(second.statusCode, 200); assert.equal(second.body.reused, true); assert.equal(second.body.npc.id, first.body.npc.id);
  assert.equal(f.saved().combatNpcs.length, 1); assert.equal(f.writes(), 1); assert.equal(f.saved().eventLog.filter((e: any) => e.type === "combat_npc_added").length, 1);
});
test("reuse preserves DM changes, damage, spent actions, conditions, initiative and battle", async t => {
  const f = fixture(t), first = await f.invoke(), id = first.body.npc.id;
  await f.invoke({ currentHp: 3, actionUsed: true, reactionUsed: true, movementUsed: 15 }, host.hostToken, "/:npcId/dummy-state", "put", id);
  f.externalCommit(snapshot => {
    snapshot.combatNpcs[0].name = "DM name";
    snapshot.combatNpcs[0].conditions = [{ id: "condition", name: "Poisoned" }];
    snapshot.combatNpcs[0].gear = [{ id: "gear", name: "DM gear", category: "gear", equipped: true }];
    snapshot.participantBattleById[id] = "dm-battle";
    snapshot.initiativeByMember[id].initiativeTotal = 19;
  });
  const before = f.saved(); const again = await f.invoke({ ...body, name: "Renamed locally", dummyState: { maxHp: 100, currentHp: 100 }, coreStats: { strength: 30 } });
  assert.equal(again.body.reused, true); assert.equal(again.body.npc.name, "DM name"); assert.equal(again.body.npc.dummyState.currentHp, 3); assert.equal(again.body.npc.dummyState.actionUsed, true);
  assert.deepEqual(f.saved(), before); assert.equal(f.writes(), 2);
});
test("binding survives durable hydration and does not depend on warm process cache", async t => {
  const existing = { id: "persisted", name: "Existing", sourceType: "character", disposition: "friendly", dummyState: { maxHp: 12, currentHp: 2, armorClass: 13, actionUsed: true }, projection: body.projection, companionAdmission: binding };
  const f = fixture(t, [existing]); const res = await f.invoke();
  assert.equal(res.statusCode, 200); assert.equal(res.body.reused, true); assert.equal(res.body.npc.id, "persisted"); assert.equal(res.body.npc.dummyState.currentHp, 2); assert.equal(f.writes(), 0);
});
for (const legacy of [{}, { companionAdmission: { ...binding, schemaVersion: "unknown" } }]) {
  test(`legacy/malformed admission cannot claim a new identity: ${JSON.stringify(legacy)}`, async t => {
    const f = fixture(t, [{ id: "legacy", name: "Legacy", sourceType: "character", disposition: "friendly", projection: body.projection, ...legacy }]);
    const first = await f.invoke(), again = await f.invoke();
    assert.equal(first.body.reused, false); assert.notEqual(first.body.npc.id, "legacy"); assert.equal(again.body.npc.id, first.body.npc.id); assert.equal(again.body.reused, true);
    assert.equal(f.saved().combatNpcs.length, 2); assert.equal(f.writes(), 1);
  });
}
test("submitted admission fields are ignored and cannot impersonate another member", async t => {
  const f = fixture(t); const res = await f.invoke({ ...body, companionAdmission: { ...binding, memberId: "other" } });
  assert.deepEqual(res.body.npc.companionAdmission, binding);
});
test("host ordinary NPC input cannot forge companion admission provenance", async t => {
  const f = fixture(t); const res = await f.invoke({ name: "NPC", disposition: "friendly", companionAdmission: binding }, host.hostToken);
  assert.equal(res.statusCode, 200); assert.equal(res.body.npc.companionAdmission, undefined);
});
test("different members may use the same local companion ID without sharing a combat instance", async t => {
  const f = fixture(t), first = await f.invoke(); const secondBody = { ...body, projection: { ...body.projection, ownerMemberId: "other" } };
  const second = await f.invoke(secondBody, other.hostToken); assert.equal(second.body.reused, false); assert.notEqual(second.body.npc.id, first.body.npc.id);
  assert.equal((await f.invoke(secondBody, other.hostToken)).body.npc.id, second.body.npc.id); assert.equal((await f.invoke()).body.npc.id, first.body.npc.id); assert.equal(f.writes(), 2);
});
test("different companion IDs for the same member remain distinct", async t => {
  const f = fixture(t), first = await f.invoke(); const second = await f.invoke({ ...body, sourceId: "pet2", projection: { ...body.projection, companionId: "pet2" } });
  assert.notEqual(first.body.npc.id, second.body.npc.id); assert.equal(second.body.reused, false); assert.equal(f.writes(), 2);
});
test("retry still authenticates owner and validates battle scope", async t => {
  const f = fixture(t); await f.invoke();
  assert.equal((await f.invoke(body, other.hostToken)).statusCode, 403);
  assert.equal((await f.invoke({ ...body, battleId: "foreign" })).statusCode, 403); assert.equal(f.writes(), 1);
});
test("failed persistence cannot be acknowledged as an existing companion on retry", async t => {
  const f = fixture(t); f.fail(); assert.equal((await f.invoke()).statusCode, 500); assert.equal(f.writes(), 0);
  const retry = await f.invoke(); assert.equal(retry.statusCode, 200); assert.equal(retry.body.reused, false); assert.equal(f.writes(), 1); assert.equal(f.saved().combatNpcs.length, 1);
});
test("concurrent admission uses committed snapshots and CAS; loser retries to the winning instance", async t => {
  const f = fixture(t); let release!: () => void, started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; }), entering = new Promise<void>(resolve => { started = resolve; });
  f.holdWrite(async () => { started(); await pending; });
  const first = f.invoke(); await entering;
  const second = await f.invoke(); assert.equal(second.statusCode, 200); assert.equal(second.body.reused, false);
  release(); await assert.rejects(first, RuntimeConflictError);
  const retry = await f.invoke(); assert.equal(retry.body.reused, true); assert.equal(retry.body.npc.id, second.body.npc.id); assert.equal(f.saved().combatNpcs.length, 1); assert.equal(f.writes(), 1);
});
