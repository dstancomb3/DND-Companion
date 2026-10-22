import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { issuePartyHostToken } = await import("../lib/partyHostToken");
const { hostToken, hostTokenHash } = issuePartyHostToken();
const { default: router, dedupeMembersWithState } = await import("./party");

for (const [label, timestamp] of [["older snapshot", 99], ["timestamp collision", 100]] as const) {
  test(`sync rejects ${label} without writing member or runtime data`, async (t) => {
    const code = `sync-safety-${timestamp}`;
    const now = new Date();
    const writes: unknown[] = [];
    const snapshot = {
      partyCode: code, schemaVersion: 1, stateRevision: 1, updatedAt: now,
      snapshot: { memberSyncClockById: { member: { snapshotUpdatedAt: 100, payloadHash: "previous-payload" } } },
    };
    t.mock.method(db, "select", (() => ({ from: (table: unknown) => {
      const rows = table === partySessions
        ? [{ code, lastActivityAt: now }]
        : table === partyRuntimeSnapshots ? [snapshot]
        : table === partyMembers ? [{ id: "member", currentHp: 20, memberTokenHash: hostTokenHash }] : [];
      return { where: () => Object.assign(Promise.resolve(rows), { limit: async () => rows }) };
    } })) as never);
    for (const method of ["insert", "update", "delete"] as const) {
      t.mock.method(db, method, ((...args: unknown[]) => {
        writes.push(args);
        throw new Error("Rejected sync must not write");
      }) as never);
    }
    const route = (router as unknown as {
      stack: Array<{ route?: { path: string; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }>;
    }).stack.find((layer) => layer.route?.path === "/party/sync")!.route!;
    let statusCode = 200;
    let responseBody: { code?: string } = {};
    const response = {
      status(code: number) { statusCode = code; return this; },
      json(body: typeof responseBody) { responseBody = body; return this; },
    };
    await route.stack[0].handle({
      get: () => `Bearer ${hostToken}`,
      body: { partyCode: code, memberId: "member", currentHp: 1, snapshotUpdatedAt: timestamp },
    }, response);
    assert.equal(statusCode, 409);
    assert.equal(responseBody.code, "stale_member_snapshot");
    assert.deepEqual(writes, []);
  });
}

test("distinct member IDs with identical character attributes retain their combat state", () => {
  const members = ["a", "b"].map((id) => ({
    id, characterName: "Twin", characterClass: "Fighter", maxHp: 10, armorClass: 15, updatedAt: new Date(),
  }));
  const state = {
    initiativeByMember: { a: { memberId: "a" }, b: { memberId: "b" } },
    memberStatsById: { a: { speed: 30 }, b: { speed: 25 } },
    memberDefensesById: {}, memberSyncClockById: {}, memberPresentationById: {},
    turnOrder: ["a", "b"], rollRequests: [{ targetMemberIds: ["a", "b"], responses: [] }],
  };
  const before = structuredClone(state);
  const result = dedupeMembersWithState(members, state as never);
  assert.deepEqual(result.map((member) => member.id), ["a", "b"]);
  assert.deepEqual(state, before);
});
