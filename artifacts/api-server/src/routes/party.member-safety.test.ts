import assert from "node:assert/strict";
import test from "node:test";
import { issuePartyHostToken, hashPartyHostToken } from "../lib/partyHostToken";
process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
const { partySessions, partyMembers, partyRuntimeSnapshots } = await import("@workspace/db/schema");
const { default: router } = await import("./party");
const handler = (path: string) => (router as unknown as {
  stack: Array<{ route?: { path: string; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }>;
}).stack.find(layer => layer.route?.path === path)!.route!.stack[0].handle;
function response() {
  return { statusCode: 200, body: {} as Record<string, unknown>, headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(body: Record<string, unknown>) { this.body = body; return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
  };
}
const owner = issuePartyHostToken(), other = issuePartyHostToken(), host = issuePartyHostToken();
const now = new Date();
for (const path of ["/party/sync", "/party/leave"]) {
  for (const [label, header, tokenHash, memberExists] of [
    ["missing proof", undefined, owner.hostTokenHash, true],
    ["another player's token", `Bearer ${other.hostToken}`, owner.hostTokenHash, true],
    ["an unclaimed legacy member", `Bearer ${owner.hostToken}`, null, true],
    ["an arbitrary or removed member ID", `Bearer ${owner.hostToken}`, null, false],
    ["a member in another party", `Bearer ${owner.hostToken}`, null, false],
    ["a caller-supplied DM flag", "Bearer isDmOverride=true", owner.hostTokenHash, true],
  ] as const) {
    test(`${path} rejects ${label} before writes or runtime hydration`, async t => {
      const reads: unknown[] = [], writes: unknown[] = [];
      t.mock.method(db, "select", (() => ({ from: (table: unknown) => {
        reads.push(table);
        const rows = table === partySessions ? [{ code: "PARTY", lastActivityAt: now, hostTokenHash: host.hostTokenHash }]
          : table === partyMembers && memberExists ? [{ id: "member", memberTokenHash: tokenHash }] : [];
        return { where: async () => rows };
      } })) as never);
      for (const method of ["insert", "update", "delete"] as const) t.mock.method(db, method, ((...args: unknown[]) => { writes.push(args); throw new Error("Forbidden write"); }) as never);
      const res = response();
      await handler(path)({ body: { partyCode: "PARTY", memberId: "member", currentHp: 0, isDmOverride: true }, get: () => header }, res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, "party_member_required");
      assert.deepEqual(writes, []);
      assert.equal(reads.includes(partyRuntimeSnapshots), false);
    });
  }
}
test("even the host cannot sync another player's character", async t => {
  t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: async () => table === partySessions
    ? [{ lastActivityAt: now, hostTokenHash: host.hostTokenHash }] : [{ id: "member", memberTokenHash: owner.hostTokenHash }] }) })) as never);
  const res = response();
  await handler("/party/sync")({ body: { partyCode: "PARTY", memberId: "member" }, get: () => `Bearer ${host.hostToken}` }, res);
  assert.equal(res.statusCode, 403);
});
for (const [label, token] of [["owner", owner.hostToken], ["original host", host.hostToken]]) {
  test(`leave permits ${label} with persisted proof`, async t => {
    let deleted = 0;
    t.mock.method(db, "transaction", (async (callback: (tx: unknown) => Promise<void>) => {
      await callback({
        select: () => ({ from: (table: unknown) => ({ where: () => {
          const rows = table === partySessions ? [{ hostTokenHash: host.hostTokenHash }]
            : table === partyMembers ? [{ memberTokenHash: owner.hostTokenHash }] : [];
          return Object.assign(Promise.resolve(rows), { for: async () => rows, limit: async () => rows });
        } }) }),
        delete: () => ({ where: async () => { deleted++; } }),
      });
    }) as never);
    t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: async () => table === partySessions
      ? [{ hostTokenHash: host.hostTokenHash }] : [{ memberTokenHash: owner.hostTokenHash }] }) })) as never);
    t.mock.method(db, "delete", (() => ({ where: async () => { deleted++; } })) as never);
    const res = response();
    await handler("/party/leave")({ body: { partyCode: `leave-${label}`, memberId: "member" }, get: () => `Bearer ${token}` }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(deleted, 1);
  });
}
test("enrollment ignores supplied identities, issues unique credentials, and stores only hashes", async t => {
  const inserted: Array<Record<string, unknown>> = [];
  t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => [{ lastActivityAt: now }] }) })) as never);
  t.mock.method(db, "insert", (() => ({ values: async (row: Record<string, unknown>) => { inserted.push(row); } })) as never);
  const a = response(), b = response();
  for (const res of [a, b]) await handler("/party/:code/register-member")({ params: { code: "PARTY" }, body: { memberId: "victim", memberTokenHash: "forged" } }, res);
  assert.equal(a.headers["Cache-Control"], "no-store");
  assert.notEqual(a.body.memberId, "victim");
  assert.notEqual(a.body.memberId, b.body.memberId);
  assert.notEqual(a.body.memberToken, b.body.memberToken);
  assert.equal(inserted[0].id, a.body.memberId);
  assert.equal(inserted[0].memberTokenHash, hashPartyHostToken(String(a.body.memberToken)));
  assert.equal(inserted[0].memberToken, undefined);
});
for (const [label, sessions] of [["missing", []], ["expired", [{ lastActivityAt: new Date(0) }]]] as const) {
  test(`enrollment refuses a ${label} party without writes`, async t => {
    t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => sessions }) })) as never);
    t.mock.method(db, "insert", (() => { assert.fail("No enrollment allowed"); }) as never);
    const res = response();
    await handler("/party/:code/register-member")({ params: { code: "PARTY" } }, res);
    assert.equal(res.statusCode, 404);
  });
}
test("valid sync updates an existing row without registering another member", async t => {
  const code = "valid-member-sync";
  let memberUpdates = 0;
  const rows = (table: unknown) => table === partySessions ? [{ lastActivityAt: now }]
    : table === partyMembers ? [{ id: "member", memberTokenHash: owner.hostTokenHash }] : [];
  t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: () => Object.assign(Promise.resolve(rows(table)), { limit: async () => rows(table) }) }) })) as never);
  t.mock.method(db, "update", ((table: unknown) => ({ set: () => ({ where: () => {
    if (table === partyMembers) memberUpdates++;
    return Object.assign(Promise.resolve([]), { returning: async () => [{ id: "member" }] });
  } }) })) as never);
  t.mock.method(db, "insert", ((table: unknown) => {
    assert.notEqual(table, partyMembers);
    return { values: (row: Record<string, unknown>) => ({ returning: async () => [row] }) };
  }) as never);
  const res = response();
  await handler("/party/sync")({ body: { partyCode: code, memberId: "member", currentHp: 12, snapshotUpdatedAt: 1 }, get: () => `Bearer ${owner.hostToken}` }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(memberUpdates, 1);
});
test("authorized member projection excludes the persisted credential hash", async t => {
  const code = "public-member-projection";
  t.mock.method(db, "select", (() => ({ from: (table: unknown) => {
    const rows = table === partySessions ? [{ lastActivityAt: now }]
      : table === partyMembers ? [{ id: "member", characterName: "Player", characterClass: "Fighter", maxHp: 10, armorClass: 10, updatedAt: now, memberTokenHash: owner.hostTokenHash }] : [];
    return { where: () => Object.assign(Promise.resolve(rows), { limit: async () => rows }) };
  } })) as never);
  t.mock.method(db, "update", (() => ({ set: () => ({ where: async () => [] }) })) as never);
  const res = response();
  await handler("/party/:code/members")({
    params: { code },
    get: (name: string) => name.toLowerCase() === "authorization"
      ? `Bearer ${owner.hostToken}`
      : name.toLowerCase() === "x-party-member-id" ? "member" : undefined,
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal((res.body.members as Array<Record<string, unknown>>)[0].memberTokenHash, undefined);
  assert.equal(JSON.stringify(res.body).includes(owner.hostTokenHash), false);
});

for (const path of ["/party/:code/members", "/party/:code/combat-state"]) {
  test(`${path} rejects a party code without private read proof before side effects`, async t => {
    const reads: unknown[] = [], writes: unknown[] = [];
    t.mock.method(db, "select", (() => ({ from: (table: unknown) => {
      reads.push(table);
      return { where: async () => table === partySessions
        ? [{ code: "PARTY", lastActivityAt: now, hostTokenHash: host.hostTokenHash }]
        : [] };
    } })) as never);
    for (const method of ["insert", "update", "delete"] as const) {
      t.mock.method(db, method, ((...args: unknown[]) => { writes.push(args); throw new Error("Forbidden write"); }) as never);
    }
    const res = response();
    await handler(path)({ params: { code: "PARTY" }, get: () => undefined }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "party_read_required");
    assert.deepEqual(writes, []);
    assert.equal(reads.includes(partyRuntimeSnapshots), false);
  });
}

test("member removed between authorization and update is never inserted or persisted to runtime", async t => {
  const code = "removed-mid-sync";
  const writes: unknown[] = [];
  t.mock.method(db, "select", (() => ({ from: (table: unknown) => {
    const rows = table === partySessions ? [{ lastActivityAt: now }]
      : table === partyMembers ? [{ id: "member", memberTokenHash: owner.hostTokenHash }] : [];
    return { where: () => Object.assign(Promise.resolve(rows), { limit: async () => rows }) };
  } })) as never);
  t.mock.method(db, "update", ((table: unknown) => {
    writes.push(table);
    return { set: () => ({ where: () => ({ returning: async () => [] }) }) };
  }) as never);
  t.mock.method(db, "insert", (() => { assert.fail("Sync cannot recreate a removed member"); }) as never);
  const res = response();
  await handler("/party/sync")({ body: { partyCode: code, memberId: "member" }, get: () => `Bearer ${owner.hostToken}` }, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(writes, [partyMembers]);
});

test("ownership lookup binds both the requested member ID and party code", async t => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  t.mock.method(db, "select", (() => ({ from: (table: unknown) => ({ where: (predicate: unknown) => {
    const { params } = dialect.sqlToQuery(predicate as never);
    if (table === partyMembers) {
      assert.deepEqual(params, ["member", "OTHER"]);
      return Promise.resolve([]); // Owned record exists in PARTY, not OTHER.
    }
    return Promise.resolve([{ lastActivityAt: now }]);
  } }) })) as never);
  const res = response();
  await handler("/party/sync")({ body: { partyCode: "OTHER", memberId: "member" }, get: () => `Bearer ${owner.hostToken}` }, res);
  assert.equal(res.statusCode, 403);
});
