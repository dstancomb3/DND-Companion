import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { issuePartyHostToken } from "../lib/partyHostToken";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router } = await import("./party");
const layers = router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }> };
const handler = layers.stack.find(layer => layer.route?.path === "/party/:code/roll-requests" && layer.route.methods.post)!.route!.stack[0].handle;
const host = issuePartyHostToken(), otherHost = issuePartyHostToken(), member = issuePartyHostToken();
const body = { statKey: "perception", label: " Perception check ", targetMemberIds: ["member1", "foreign"], battleId: " battle " };
function response() { return { statusCode: 200, body: {} as Record<string, any>, status(code: number) { this.statusCode = code; return this; }, json(value: Record<string, any>) { this.body = value; return this; } }; }
let serial = 0;
for (const [label, authorization, hash, expired] of [
  ["code/body proof alone", undefined, host.hostTokenHash, false],
  ["another party's host", `Bearer ${otherHost.hostToken}`, host.hostTokenHash, false],
  ["a target member token", `Bearer ${member.hostToken}`, host.hostTokenHash, false],
  ["a forged AI DM label", "Bearer ai-dm", host.hostTokenHash, false],
  ["a hash used as a token", `Bearer ${host.hostTokenHash}`, host.hostTokenHash, false],
  ["an unclaimed legacy party", `Bearer ${host.hostToken}`, null, false],
  ["a malformed header", host.hostToken, host.hostTokenHash, false],
  ["an expired party without proof", undefined, host.hostTokenHash, true],
] as const) {
  test(`roll authoring rejects ${label} before session/runtime side effects`, async t => {
    const code = `roll-denied-${++serial}`, reads: unknown[] = [], writes: unknown[] = [];
    t.mock.method(db, "select", (() => ({ from: (table: unknown) => {
      reads.push(table); return { where: async (condition: never) => {
        assert.deepEqual(new PgDialect().sqlToQuery(condition).params, [code]);
        return [{ hostTokenHash: hash, lastActivityAt: expired ? new Date(0) : new Date() }];
      } };
    } })) as never);
    for (const method of ["insert", "update", "delete"] as const) t.mock.method(db, method, ((...args: unknown[]) => { writes.push(args); throw new Error("No denied writes"); }) as never);
    const res = response(); await handler({ params: { code }, body: { ...body, memberId: "member1", hostToken: host.hostToken, isDmOverride: true, role: "ai-dm" }, get: () => authorization }, res);
    assert.equal(res.statusCode, 403); assert.equal(res.body.code, "party_host_required"); assert.match(res.body.error, /roll prompts/);
    assert.deepEqual(reads, [partySessions]); assert.deepEqual(writes, []);
  });
}
test("unknown party is rejected before any writes", async t => {
  t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => [] }) })) as never);
  for (const method of ["insert", "update", "delete"] as const) t.mock.method(db, method, (() => assert.fail("Unexpected write")) as never);
  const res = response(); await handler({ params: { code: "missing" }, body, get: () => `Bearer ${host.hostToken}` }, res);
  assert.equal(res.statusCode, 404);
});
for (const scenario of ["perception", "initiative", "no battle", "missing inputs", "no live targets", "expired"] as const) {
  test(`authenticated roll authoring: ${scenario} preserves targets, normalization and prompt rules`, async t => {
    const code = `roll-author-${++serial}`, now = new Date();
    const previous = [
      { id: "unresolved", statKey: "initiative", targetMemberIds: ["member1"], responses: [] },
      { id: "answered", statKey: "initiative", targetMemberIds: ["member1"], responses: [{ memberId: "member1", roll: 10, modifier: 2, total: 12 }] },
      { id: "other-player", statKey: "initiative", targetMemberIds: ["member2"], responses: [] },
      { id: "other-stat", statKey: "perception", targetMemberIds: ["member1"], responses: [] },
    ];
    let durable: Record<string, any> = { partyCode: code, schemaVersion: 1, stateRevision: 1, updatedAt: now, snapshot: { rollRequests: previous } };
    let runtimeWrites = 0; const reads: unknown[] = [];
    t.mock.method(db, "select", (() => ({ from: (table: unknown) => {
      reads.push(table); return { where: (condition: never) => {
        if (table === partySessions || table === partyMembers) assert.deepEqual(new PgDialect().sqlToQuery(condition).params, [code]);
        const data = table === partySessions ? [{ hostTokenHash: host.hostTokenHash, lastActivityAt: scenario === "expired" ? new Date(0) : now }] : table === partyMembers ? ["member1", "member2"].map(id => ({ id, characterName: id, characterClass: "Wizard", maxHp: 10, armorClass: 12, updatedAt: now })) : [durable];
        return Object.assign(Promise.resolve(data), { limit: async () => data });
      } };
    } })) as never);
    t.mock.method(db, "update", ((table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: () => Object.assign(Promise.resolve([]), { returning: async () => { assert.equal(table, partyRuntimeSnapshots); runtimeWrites++; durable = { ...durable, ...value }; return [durable]; } }) }) })) as never);
    t.mock.method(db, "delete", (() => ({ where: async () => [] })) as never);
    const payload = scenario === "missing inputs" ? {} : { ...body, ...(scenario === "initiative" ? { statKey: "initiative", label: " " } : {}), ...(scenario === "no live targets" ? { targetMemberIds: ["foreign"] } : {}), ...(scenario === "no battle" ? { battleId: " " } : {}) };
    const res = response(); await handler({ params: { code }, body: payload, get: () => `Bearer ${host.hostToken}` }, res);
    const expected = scenario === "expired" ? 404 : scenario === "missing inputs" || scenario === "no live targets" ? 400 : 200;
    assert.equal(res.statusCode, expected); assert.equal(runtimeWrites, expected === 200 ? 1 : 0);
    if (scenario === "missing inputs") assert.ok(reads.every(table => table === partySessions));
    if (expected !== 200) return;
    const saved = durable.snapshot, request = res.body.request;
    assert.deepEqual(request.targetMemberIds, ["member1"]);
    assert.equal(request.label, scenario === "initiative" ? "initiative" : "Perception check");
    assert.equal(request.battleId, scenario === "no battle" ? undefined : "battle");
    assert.deepEqual(request.responses, []); assert.ok(request.createdAt); assert.deepEqual(saved.rollRequests[0], request);
    assert.equal(saved.rollRequests.some((entry: any) => entry.id === "unresolved"), scenario !== "initiative");
    for (const id of ["answered", "other-player", "other-stat"]) assert.ok(saved.rollRequests.some((entry: any) => entry.id === id));
    assert.equal(saved.eventLog.filter((event: any) => event.type === "roll_prompt_created").length, 1);
    for (const secret of [host.hostToken, host.hostTokenHash]) assert.equal(JSON.stringify(res.body).includes(secret), false);
  });
}
