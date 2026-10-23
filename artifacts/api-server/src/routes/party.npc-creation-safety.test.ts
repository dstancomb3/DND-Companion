import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router } = await import("./party");
const stack = router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }> };
const handler = stack.stack.find(layer => layer.route?.path === "/party/:code/combat-npcs" && layer.route.methods.post)!.route!.stack[0].handle;
const host = issuePartyHostToken(), member = issuePartyHostToken(), other = issuePartyHostToken();
const npcBody = { name: "Target", sourceType: "monster", disposition: "hostile", battleId: "alpha", initiativeTotal: 14, gear: [{ id: "sword", name: "Sword", category: "weapon" }] };
const companionBody = { name: "Companion", sourceType: "character", sourceId: "pet", disposition: "friendly", coreStats: { dexterity: 14, initiativeBonus: 2 }, dummyState: { maxHp: 12, currentHp: 8, armorClass: 13 }, visibleStatKeys: ["speed"], conditions: [], projection: { combatantKind: "companion", companionId: "pet", ownerMemberId: "member", ownerCharacterId: "local-character" } };
function response() { return { statusCode: 200, body: {} as Record<string, any>, status(code: number) { this.statusCode = code; return this; }, json(body: Record<string, any>) { this.body = body; return this; } }; }
async function invoke(code: string, body: unknown, authorization: string | undefined) { const res = response(); await handler({ params: { code }, body, get: () => authorization }, res); return res; }
let serial = 0;
for (const isCompanion of [false, true]) {
  const body = isCompanion ? companionBody : npcBody;
  for (const [label, authorization, hash, exists, expired] of [
    ["body-only proof", undefined, member.hostTokenHash, true, false],
    ["another party/member", `Bearer ${other.hostToken}`, member.hostTokenHash, true, false],
    ["wrong role", `Bearer ${isCompanion ? host.hostToken : member.hostToken}`, member.hostTokenHash, true, false],
    ["legacy capability", `Bearer ${isCompanion ? member.hostToken : host.hostToken}`, null, true, false],
    ["hash as token", `Bearer ${isCompanion ? member.hostTokenHash : host.hostTokenHash}`, member.hostTokenHash, true, false],
    ["malformed bearer", isCompanion ? member.hostToken : host.hostToken, member.hostTokenHash, true, false],
    ["expired without proof", undefined, member.hostTokenHash, true, true],
    ["removed member", isCompanion ? `Bearer ${member.hostToken}` : undefined, null, false, false],
  ] as const) {
    test(`${isCompanion ? "companion" : "host NPC"} creation rejects ${label} before activity/runtime side effects`, async t => {
      const code = `create-denied-${++serial}`, reads: unknown[] = [];
      t.mock.method(db, "select", (() => ({ from: (table: unknown) => { reads.push(table); return { where: async (condition: never) => {
        assert.deepEqual(new PgDialect().sqlToQuery(condition).params, table === partySessions ? [code] : ["member", code]);
        return table === partySessions ? [{ hostTokenHash: !isCompanion && label === "legacy capability" ? null : host.hostTokenHash, lastActivityAt: expired ? new Date(0) : new Date() }] : exists ? [{ memberTokenHash: hash }] : [];
      } }; } })) as never);
      for (const method of ["insert", "update", "delete"] as const) t.mock.method(db, method, (() => assert.fail("No denied writes")) as never);
      const res = await invoke(code, { ...body, hostToken: host.hostToken, memberToken: member.hostToken, isDmOverride: true }, authorization);
      assert.equal(res.statusCode, 403); assert.equal(res.body.code, isCompanion ? "party_member_required" : "party_host_required"); assert.deepEqual(reads, isCompanion ? [partySessions, partyMembers] : [partySessions]);
    });
  }
  test(`${isCompanion ? "companion" : "host NPC"} rejects unknown party`, async t => {
    t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => [] }) })) as never);
    t.mock.method(db, "update", (() => assert.fail("No writes")) as never);
    assert.equal((await invoke("missing", body, `Bearer ${isCompanion ? member.hostToken : host.hostToken}`)).statusCode, 404);
  });
}
function fixture(t: TestContext, options: { ownerBattle?: boolean; expired?: boolean } = {}) {
  const code = `create-ok-${++serial}`, now = new Date(); let writes = 0;
  let durable: Record<string, any> = { partyCode: code, schemaVersion: 1, stateRevision: 1, updatedAt: now, snapshot: { participantBattleById: { other: "alpha", ...(options.ownerBattle === false ? {} : { member: "beta" }) }, currentTurnIdByBattle: { alpha: "other", beta: "member" }, combatNpcs: [], includeEnvironment: false } };
  t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: (condition: never) => {
    const params = new PgDialect().sqlToQuery(condition).params;
    assert.deepEqual(params, table === partyMembers && params.length === 2 ? ["member", code] : [code]);
    const rows = table === partySessions ? [{ hostTokenHash: host.hostTokenHash, lastActivityAt: options.expired ? new Date(0) : now }] : table === partyMembers ? ["member", "other"].map(id => ({ id, memberTokenHash: id === "member" ? member.hostTokenHash : other.hostTokenHash, characterName: id, characterClass: "Wizard", maxHp: 10, armorClass: 12, updatedAt: now })) : [durable];
    return Object.assign(Promise.resolve(rows), { limit: async () => rows });
  } }) })) as never);
  t.mock.method(db, "update", ((table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: () => Object.assign(Promise.resolve([]), { returning: async () => { assert.equal(table, partyRuntimeSnapshots); writes++; durable = { ...durable, ...value }; return [durable]; } }) }) })) as never);
  t.mock.method(db, "delete", (() => ({ where: async () => [] })) as never);
  return { code, saved: () => durable.snapshot, writes: () => writes };
}
for (const sourceType of ["monster", "manual", "character", "dm-npc"]) {
  test(`host creation preserves ${sourceType} source, gear, initiative and chosen battle`, async t => {
    const f = fixture(t), res = await invoke(f.code, { ...npcBody, sourceType }, `Bearer ${host.hostToken}`);
    assert.equal(res.statusCode, 200); assert.equal(f.writes(), 1); const npc = res.body.npc;
    assert.equal(npc.sourceType, sourceType); assert.equal(npc.gear[0].id, "sword"); assert.equal(f.saved().participantBattleById[npc.id], "alpha"); assert.equal(f.saved().initiativeByMember[npc.id].initiativeTotal, 14);
  });
}
for (const ownerBattle of [false, true]) {
  test(`companion admission derives own battle, ownerBattle=${ownerBattle}`, async t => {
    const f = fixture(t, { ownerBattle }), res = await invoke(f.code, companionBody, `Bearer ${member.hostToken}`);
    assert.equal(res.statusCode, 200); assert.equal(f.writes(), 1); const npc = res.body.npc, saved = f.saved();
    assert.equal(npc.projection.ownerMemberId, "member"); assert.equal(npc.sourceId, "pet"); assert.equal(npc.dummyState.currentHp, 8); assert.equal(npc.disposition, "friendly");
    assert.equal(saved.participantBattleById[npc.id], ownerBattle ? "beta" : undefined); assert.equal(saved.initiativeByMember[npc.id].initiativeTotal, 2);
    assert.equal(saved.eventLog[0].memberId, "member"); assert.match(saved.eventLog[0].message, /party member projected/);
    for (const secret of [host.hostToken, host.hostTokenHash, member.hostToken, member.hostTokenHash]) assert.equal(JSON.stringify(res.body).includes(secret), false);
  });
}
for (const patch of [{ sourceType: "monster" }, { sourceId: "other-pet" }, { disposition: "hostile" }, { gear: [{ name: "Sword" }] }, { gear: {} }, { conditions: [{ id: "x", name: "Poisoned" }] }, { conditions: {} }, { initiativeTotal: 20 }]) {
  test(`companion cannot smuggle host creation fields: ${JSON.stringify(patch)}`, async t => {
    const f = fixture(t), res = await invoke(f.code, { ...companionBody, ...patch }, `Bearer ${member.hostToken}`);
    assert.equal(res.statusCode, 400); assert.equal(f.writes(), 0);
  });
}
test("authenticated member cannot assign its companion to another battle", async t => {
  const f = fixture(t); const res = await invoke(f.code, { ...companionBody, battleId: "alpha" }, `Bearer ${member.hostToken}`);
  assert.equal(res.statusCode, 403); assert.equal(f.writes(), 0);
});
test("matching explicit owner battle remains supported", async t => {
  const f = fixture(t); assert.equal((await invoke(f.code, { ...companionBody, battleId: "beta" }, `Bearer ${member.hostToken}`)).statusCode, 200);
});
for (const projection of [{ combatantKind: "companion" }, { ...companionBody.projection, companionId: " " }, { ...companionBody.projection, ownerMemberId: " " }]) {
  test(`incomplete companion identity rejected before DB work: ${JSON.stringify(projection)}`, async t => {
    t.mock.method(db, "select", (() => assert.fail("No DB read")) as never);
    assert.equal((await invoke("party", { ...companionBody, projection }, `Bearer ${member.hostToken}`)).statusCode, 400);
  });
}
test("companion owner label cannot claim another member's credential", async t => {
  const f = fixture(t); assert.equal((await invoke(f.code, companionBody, `Bearer ${other.hostToken}`)).statusCode, 403); assert.equal(f.writes(), 0);
});
for (const body of [npcBody, companionBody]) {
  test(`authenticated expired party refuses ${body.sourceType} creation`, async t => {
    const f = fixture(t, { expired: true }); assert.equal((await invoke(f.code, body, `Bearer ${body === companionBody ? member.hostToken : host.hostToken}`)).statusCode, 404); assert.equal(f.writes(), 0);
  });
}
test("changing ownerMemberId cannot reuse another member's bearer proof", async t => {
  const code = "forged-owner";
  t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: async (condition: never) => {
    assert.deepEqual(new PgDialect().sqlToQuery(condition).params, table === partySessions ? [code] : ["other", code]);
    return table === partySessions ? [{ hostTokenHash: host.hostTokenHash }] : [{ memberTokenHash: other.hostTokenHash }];
  } }) })) as never);
  for (const method of ["insert", "update", "delete"] as const) t.mock.method(db, method, (() => assert.fail("No denied writes")) as never);
  const res = await invoke(code, { ...companionBody, projection: { ...companionBody.projection, ownerMemberId: "other" } }, `Bearer ${member.hostToken}`);
  assert.equal(res.statusCode, 403); assert.equal(res.body.code, "party_member_required");
});
test("ordinary member cannot evade companion restrictions by removing projection metadata", async t => {
  const f = fixture(t); const { projection: _projection, ...body } = companionBody;
  assert.equal((await invoke(f.code, body, `Bearer ${member.hostToken}`)).statusCode, 403); assert.equal(f.writes(), 0);
});
test("host cannot manufacture an owned companion using host proof alone", async t => {
  const f = fixture(t); assert.equal((await invoke(f.code, companionBody, `Bearer ${host.hostToken}`)).statusCode, 403); assert.equal(f.writes(), 0);
});
