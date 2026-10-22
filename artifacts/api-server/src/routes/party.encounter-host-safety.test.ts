import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router } = await import("./party");
const host = issuePartyHostToken(), otherHost = issuePartyHostToken(), member = issuePartyHostToken();
const operations = [
  { name: "start initiative", method: "post", path: "/party/:code/initiative/start", body: { includeEnvironment: false, targetMemberIds: ["member3", "foreign-member"], targetNpcIds: ["npc3", "foreign-npc"] } },
  { name: "end encounter", method: "delete", path: "/party/:code/encounters/:battleId", body: {} },
  { name: "add participants", method: "post", path: "/party/:code/encounters/:battleId/participants", body: { memberIds: ["member3", "foreign-member"], npcIds: ["npc3", "foreign-npc"] } },
] as const;
const routes = router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }> };
const handler = (op: typeof operations[number]) => routes.stack.find(layer => layer.route?.path === op.path && layer.route.methods[op.method])!.route!.stack[0].handle;
function response() { return { statusCode: 200, body: {} as Record<string, any>, status(code: number) { this.statusCode = code; return this; }, json(body: Record<string, any>) { this.body = body; return this; } }; }
let serial = 0;
for (const op of operations) {
  for (const [label, authorization, hash, expired] of [
    ["code/body role alone", undefined, host.hostTokenHash, false],
    ["another party host", `Bearer ${otherHost.hostToken}`, host.hostTokenHash, false],
    ["member proof", `Bearer ${member.hostToken}`, host.hostTokenHash, false],
    ["AI DM label", "Bearer ai-dm", host.hostTokenHash, false],
    ["stored hash as token", `Bearer ${host.hostTokenHash}`, host.hostTokenHash, false],
    ["legacy unclaimed host", `Bearer ${host.hostToken}`, null, false],
    ["malformed header", host.hostToken, host.hostTokenHash, false],
    ["expired session without proof", undefined, host.hostTokenHash, true],
  ] as const) {
    test(`${op.name} rejects ${label} before session/runtime side effects`, async t => {
      const code = `encounter-denied-${++serial}`, reads: unknown[] = [], writes: unknown[] = [];
      t.mock.method(db, "select", (() => ({ from: (table: unknown) => {
        reads.push(table);
        return { where: async (condition: never) => {
          assert.deepEqual(new PgDialect().sqlToQuery(condition).params, [code]);
          return [{ hostTokenHash: hash, lastActivityAt: expired ? new Date(0) : new Date() }];
        } };
      } })) as never);
      for (const method of ["insert", "update", "delete"] as const) t.mock.method(db, method, ((...args: unknown[]) => { writes.push(args); throw new Error("Denied write"); }) as never);
      const res = response();
      await handler(op)({ params: { code, battleId: "alpha" }, body: { ...op.body, memberId: "member3", hostToken: host.hostToken, isDmOverride: true, role: "ai-dm" }, get: () => authorization }, res);
      assert.equal(res.statusCode, 403); assert.equal(res.body.code, "party_host_required");
      assert.deepEqual(reads, [partySessions]); assert.deepEqual(writes, []);
    });
  }
  test(`${op.name}: unknown party fails before writes`, async t => {
    t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => [] }) })) as never);
    for (const method of ["insert", "update", "delete"] as const) t.mock.method(db, method, (() => assert.fail("Unknown party must not write")) as never);
    const res = response(); await handler(op)({ params: { code: "missing", battleId: "alpha" }, body: op.body, get: () => `Bearer ${host.hostToken}` }, res);
    assert.equal(res.statusCode, 404);
  });
  for (const scenario of ["success", "invalid target", "expired"] as const) {
    test(`${op.name}: authenticated ${scenario} retains battle scope and persistence`, async t => {
      const code = `encounter-host-${++serial}`, now = new Date();
      const empty = scenario === "invalid target" && op.name === "start initiative";
      const members = empty ? [] : ["member1", "member2", "member3"].map(id => ({ id, characterName: id, characterClass: "Wizard", maxHp: 10, armorClass: 12, updatedAt: now }));
      const npcs = empty ? [] : ["npc1", "npc2", "npc3"].map(id => ({ id, name: id, disposition: "hostile", sourceType: "manual", coreStats: { speed: 30, initiativeBonus: 1 }, dummyState: { maxHp: 10, currentHp: 10, armorClass: 12 }, visibleStatKeys: [], gear: [], conditions: [] }));
      let durable: Record<string, any> = { partyCode: code, schemaVersion: 1, stateRevision: 1, updatedAt: now, snapshot: {
        activeMemberIds: empty ? [] : ["member1", "member2"],
        participantBattleById: empty ? {} : { member1: "alpha", npc1: "alpha", member2: "beta", npc2: "beta" },
        battleTurnOrderById: empty ? {} : { alpha: ["member1", "npc1"], beta: ["member2", "npc2"] },
        currentTurnIdByBattle: empty ? {} : { alpha: "member1", beta: "member2" },
        includeEnvironment: false, combatNpcs: npcs,
        initiativeByMember: empty ? {} : { member2: { memberId: "member2", initiativeRoll: 14, initiativeBonus: 1, initiativeTotal: 15 } },
      } };
      let runtimeWrites = 0;
      t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: (condition: never) => {
        if (table === partySessions || table === partyMembers) assert.deepEqual(new PgDialect().sqlToQuery(condition).params, [code]);
        const data = table === partySessions ? [{ hostTokenHash: host.hostTokenHash, lastActivityAt: scenario === "expired" ? new Date(0) : now }] : table === partyMembers ? members : [durable];
        return Object.assign(Promise.resolve(data), { limit: async () => data });
      } }) })) as never);
      t.mock.method(db, "update", ((table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: () => Object.assign(Promise.resolve([]), { returning: async () => { assert.equal(table, partyRuntimeSnapshots); runtimeWrites++; durable = { ...durable, ...value }; return [durable]; } }) }) })) as never);
      t.mock.method(db, "delete", (() => ({ where: async () => [] })) as never);
      const res = response(); await handler(op)({ params: { code, battleId: scenario === "invalid target" ? "missing-battle" : "alpha" }, body: op.body, get: () => `Bearer ${host.hostToken}` }, res);
      const expected = scenario === "success" ? 200 : scenario === "expired" || op.name !== "start initiative" ? 404 : 400;
      assert.equal(res.statusCode, expected); assert.equal(runtimeWrites, scenario === "success" ? 1 : 0);
      if (scenario !== "success") return;
      const saved = durable.snapshot;
      // The unrelated battle and initiative survive all three controls.
      assert.equal(saved.participantBattleById.member2, "beta"); assert.equal(saved.participantBattleById.npc2, "beta");
      assert.equal(saved.initiativeByMember.member2.initiativeTotal, 15); assert.ok(saved.combatNpcs.some((npc: any) => npc.id === "npc2"));
      if (op.name === "start initiative") {
        const id = res.body.battleId; assert.match(id, /^battle_/); assert.equal(saved.participantBattleById.member3, id); assert.equal(saved.participantBattleById.npc3, id);
        assert.deepEqual(res.body.turnOrder, saved.battleTurnOrderById[id]); assert.equal(saved.includeEnvironment, false);
      } else if (op.name === "add participants") {
        assert.equal(saved.participantBattleById.member3, "alpha"); assert.equal(saved.participantBattleById.npc3, "alpha");
      } else {
        assert.equal(saved.participantBattleById.member1, undefined); assert.equal(saved.participantBattleById.npc1, undefined);
        assert.equal(saved.battleTurnOrderById.alpha, undefined); assert.ok(!saved.combatNpcs.some((npc: any) => npc.id === "npc1"));
      }
      assert.equal(saved.participantBattleById["foreign-member"], undefined); assert.equal(saved.participantBattleById["foreign-npc"], undefined);
      const eventType = op.name === "start initiative" ? "initiative_started" : op.name === "add participants" ? "participants_added" : "encounter_ended";
      assert.equal(saved.eventLog.filter((event: any) => event.type === eventType).length, 1);
      for (const secret of [host.hostToken, host.hostTokenHash]) assert.equal(JSON.stringify(res.body).includes(secret), false);
    });
  }
}
