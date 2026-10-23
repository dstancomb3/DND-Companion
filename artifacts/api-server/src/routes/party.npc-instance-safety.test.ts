import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router } = await import("./party");
const stack = router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }> };
const host = issuePartyHostToken(), otherHost = issuePartyHostToken(), member = issuePartyHostToken();
const operations = [
  { name: "dummy state", suffix: "/dummy-state", method: "put", body: { currentHp: 99, actionUsed: true, movementUsed: -5 } },
  { name: "gear", suffix: "/gear", method: "put", body: { gear: [{ id: "sword", name: " Sword ", category: "weapon", equipped: true, attackBonus: 3.9, damageDice: " 1d6 " }] } },
  { name: "visibility", suffix: "/visible-stats", method: "put", body: { visibleStatKeys: ["speed", "strength", "speed", "invalid"] } },
  { name: "deletion", suffix: "", method: "delete", body: {} },
  { name: "initiative", suffix: "/initiative", method: "put", body: { initiativeRoll: 30.7 } },
];
function response() { return { statusCode: 200, body: {} as Record<string, any>, status(code: number) { this.statusCode = code; return this; }, json(body: Record<string, any>) { this.body = body; return this; } }; }
let serial = 0;
for (const op of operations) {
  const handler = stack.stack.find(layer => layer.route?.path === `/party/:code/combat-npcs/:npcId${op.suffix}` && layer.route.methods[op.method])!.route!.stack[0].handle;
  for (const [label, authorization, hash, expired] of [
    ["body-only host/companion owner labels", undefined, host.hostTokenHash, false],
    ["another host", `Bearer ${otherHost.hostToken}`, host.hostTokenHash, false],
    ["member claiming companion ownership", `Bearer ${member.hostToken}`, host.hostTokenHash, false],
    ["AI DM label", "Bearer ai-dm", host.hostTokenHash, false],
    ["hash as token", `Bearer ${host.hostTokenHash}`, host.hostTokenHash, false],
    ["legacy unclaimed party", `Bearer ${host.hostToken}`, null, false],
    ["malformed bearer", host.hostToken, host.hostTokenHash, false],
    ["expired without proof", undefined, host.hostTokenHash, true],
  ] as const) {
    test(`NPC ${op.name} rejects ${label} before instance/runtime/activity access`, async t => {
      const code = `npc-denied-${++serial}`, reads: unknown[] = [];
      t.mock.method(db, "select", (() => ({ from: (table: unknown) => { reads.push(table); return { where: async (condition: never) => {
        assert.deepEqual(new PgDialect().sqlToQuery(condition).params, [code]);
        return [{ hostTokenHash: hash, lastActivityAt: expired ? new Date(0) : new Date() }];
      } }; } })) as never);
      for (const method of ["insert", "update", "delete"] as const) t.mock.method(db, method, (() => assert.fail("No unauthorized writes")) as never);
      const res = response(); await handler({ params: { code, npcId: "npc" }, body: { ...op.body, hostToken: host.hostToken, isDmOverride: true, memberId: "member", projection: { combatantKind: "companion", ownerMemberId: "member" } }, get: () => authorization }, res);
      assert.equal(res.statusCode, 403); assert.equal(res.body.code, "party_host_required"); assert.match(res.body.error, /NPC instances/); assert.deepEqual(reads, [partySessions]);
    });
  }
  test(`NPC ${op.name} rejects unknown party before writes`, async t => {
    t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => [] }) })) as never);
    t.mock.method(db, "update", (() => assert.fail("No writes")) as never);
    const res = response(); await handler({ params: { code: "missing", npcId: "npc" }, body: op.body, get: () => `Bearer ${host.hostToken}` }, res); assert.equal(res.statusCode, 404);
  });
  for (const scenario of ["host", "missing/foreign instance", "expired", "host manages companion projection"] as const) {
    test(`NPC ${op.name}: ${scenario} preserves party-local checks and persistence`, async t => {
      const code = `npc-authorized-${++serial}`, now = new Date();
      const npc = { id: "npc", name: "Target", sourceType: "manual", disposition: "hostile", coreStats: { initiativeBonus: 2 }, dummyState: { maxHp: 12, currentHp: 8, armorClass: 13, actionUsed: false }, ...(scenario === "host manages companion projection" ? { projection: { combatantKind: "companion", companionId: "pet", ownerMemberId: "member" } } : {}) };
      let durable: Record<string, any> = { partyCode: code, schemaVersion: 1, stateRevision: 1, updatedAt: now, snapshot: {
        combatNpcs: [npc], participantBattleById: { npc: "battle", member: "battle" }, currentTurnIdByBattle: { battle: "npc" },
        initiativeByMember: { npc: { memberId: "npc", initiativeRoll: 10, initiativeBonus: 2, initiativeTotal: 12 } },
      } };
      let writes = 0;
      t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: (condition: never) => {
        if (table === partySessions || table === partyMembers) assert.deepEqual(new PgDialect().sqlToQuery(condition).params, [code]);
        const rows = table === partySessions ? [{ hostTokenHash: host.hostTokenHash, lastActivityAt: scenario === "expired" ? new Date(0) : now }] : table === partyMembers ? [{ id: "member", characterName: "Player", characterClass: "Wizard", maxHp: 10, armorClass: 12, updatedAt: now }] : [durable];
        return Object.assign(Promise.resolve(rows), { limit: async () => rows });
      } }) })) as never);
      t.mock.method(db, "update", ((table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: () => Object.assign(Promise.resolve([]), { returning: async () => {
        assert.equal(table, partyRuntimeSnapshots); writes++; durable = { ...durable, ...value }; return [durable];
      } }) }) })) as never);
      t.mock.method(db, "delete", (() => ({ where: async () => [] })) as never);
      const res = response(); await handler({ params: { code, npcId: scenario === "missing/foreign instance" ? "foreign" : "npc" }, body: op.body, get: () => `Bearer ${host.hostToken}` }, res);
      const permitted = scenario === "host" || scenario === "host manages companion projection";
      assert.equal(res.statusCode, permitted ? 200 : 404, JSON.stringify(res.body)); assert.equal(writes, permitted ? 1 : 0); if (!permitted) return;
      const saved = durable.snapshot;
      if (op.name === "dummy state") { assert.equal(saved.combatNpcs[0].dummyState.currentHp, 12); assert.equal(saved.combatNpcs[0].dummyState.actionUsed, true); assert.equal(saved.combatNpcs[0].dummyState.movementUsed, 0); }
      if (op.name === "gear") { assert.equal(saved.combatNpcs[0].gear[0].name, "Sword"); assert.equal(saved.combatNpcs[0].gear[0].attackBonus, 3); assert.equal(saved.combatNpcs[0].gear[0].damageDice, "1d6"); }
      if (op.name === "visibility") assert.deepEqual(saved.combatNpcs[0].visibleStatKeys, ["speed", "strength"]);
      if (op.name === "initiative") { assert.equal(res.body.initiativeTotal, 22); assert.equal(saved.initiativeByMember.npc.initiativeTotal, 22); }
      if (op.name === "deletion") { assert.deepEqual(saved.combatNpcs, []); assert.equal(saved.initiativeByMember.npc, undefined); assert.equal(saved.participantBattleById.npc, undefined); assert.equal(saved.currentTurnIdByBattle.battle, "member"); assert.equal(saved.battleTurnOrderById.battle.includes("npc"), false); }
      else if (scenario === "host manages companion projection") assert.equal(saved.combatNpcs[0].projection.ownerMemberId, "member");
      for (const secret of [host.hostToken, host.hostTokenHash]) assert.equal(JSON.stringify(res.body).includes(secret), false);
    });
  }
}
