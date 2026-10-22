import assert from "node:assert/strict";
import test from "node:test";
import { issuePartyHostToken, hashPartyHostToken, hasPartyHostToken } from "../lib/partyHostToken";

process.env.DATABASE_URL ??= "postgres://local:local@localhost:5432/local";
const { db } = await import("@workspace/db");
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

test("host tokens are random, hashed and bound to a single party", () => {
  const a = issuePartyHostToken(), b = issuePartyHostToken();
  assert.notEqual(a.hostToken, b.hostToken);
  assert.notEqual(a.hostToken, a.hostTokenHash);
  assert.equal(a.hostTokenHash, hashPartyHostToken(a.hostToken));
  assert.equal(hasPartyHostToken(`Bearer ${a.hostToken}`, a.hostTokenHash), true);
  assert.equal(hasPartyHostToken(`Bearer ${b.hostToken}`, a.hostTokenHash), false);
});

test("create returns a private token once and stores only its hash", async t => {
  let row: Record<string, unknown> = {};
  t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => [] }) })) as never);
  t.mock.method(db, "insert", (() => ({ values: async (value: typeof row) => { row = value; } })) as never);
  const res = response();
  await handler("/party/create")({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.match(String(res.body.hostToken), /^[a-f0-9]{64}$/);
  assert.equal(row.hostTokenHash, hashPartyHostToken(String(res.body.hostToken)));
  assert.equal(row.hostToken, undefined);
});

const host = issuePartyHostToken();
for (const [label, header, storedHash] of [
  ["code alone", undefined, host.hostTokenHash],
  ["another host", `Bearer ${issuePartyHostToken().hostToken}`, host.hostTokenHash],
  ["a member ID", "Bearer member-123", host.hostTokenHash],
  ["a forged role", "Bearer isDmOverride=true", host.hostTokenHash],
  ["an unclaimed legacy session", `Bearer ${host.hostToken}`, null],
] as const) {
  test(`disband refuses ${label} without any writes`, async t => {
    t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => [{ hostTokenHash: storedHash }] }) })) as never);
    let writes = 0;
    t.mock.method(db, "delete", (() => { writes++; throw new Error("Forbidden deletion"); }) as never);
    const res = response();
    await handler("/party/:code/disband")({ params: { code: "PARTY" }, body: { isDmOverride: true }, get: () => header }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "party_host_required");
    assert.equal(writes, 0);
  });
}

test("persisted host hash authorizes disband and deletes members, session and runtime", async t => {
  t.mock.method(db, "select", (() => ({ from: () => ({ where: async () => [{ hostTokenHash: host.hostTokenHash }] }) })) as never);
  const deleted: unknown[] = [];
  t.mock.method(db, "delete", ((table: unknown) => ({ where: async () => { deleted.push(table); } })) as never);
  const res = response();
  await handler("/party/:code/disband")({ params: { code: "PARTY" }, get: () => `Bearer ${host.hostToken}` }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(deleted.length, 3);
});
