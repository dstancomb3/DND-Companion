import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const schema = process.env.PARTY_TEST_SCHEMA ?? "";
assert.equal(process.env.RUN_POSTGRES_INTEGRATION, "1", "Use the isolated integration runner.");
assert.match(schema, /^dnd_it_[a-f0-9]{32}$/);
const database = new URL(process.env.DATABASE_URL ?? "");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(database.hostname));
assert.equal(database.pathname, "/dnd_companion_ci");
assert.ok(database.searchParams.get("options")?.includes("search_path=" + schema));
const { pool } = await import("@workspace/db");
interface Worker { child: ChildProcess; origin: string; application: string; exited: Promise<void> }
const workers: Worker[] = [];
async function startWorker(label: string): Promise<Worker> {
  const url = new URL(database); const application = schema + "_" + label;
  url.searchParams.set("application_name", application);
  const child = fork(fileURLToPath(new URL("./party-worker.ts", import.meta.url)), [], {
    execArgv: ["--import", "tsx"], env: { ...process.env, DATABASE_URL: url.href },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const exited = new Promise<void>(done => child.once("exit", () => done()));
  try {
    const port = await new Promise<number>((done, reject) => {
      const timeout = setTimeout(() => reject(Error("API worker startup timed out")), 15000);
      child.once("exit", code => { clearTimeout(timeout); reject(Error("API worker exited: " + code)); });
      child.once("error", error => { clearTimeout(timeout); reject(error); });
      child.once("message", (message: unknown) => {
        clearTimeout(timeout);
        assert.ok(message && typeof message === "object" && "port" in message && typeof message.port === "number");
        done(message.port);
      });
    });
    return { child, origin: "http://127.0.0.1:" + port, application, exited };
  } catch (error) { child.kill("SIGTERM"); throw error; }
}
before(async () => {
  const { rows } = await pool.query("SELECT current_schema() AS schema, current_setting('server_version') AS version");
  assert.equal(rows[0].schema, schema);
  console.log("Real PostgreSQL version:", rows[0].version);
  workers.push(await startWorker("a"));
  workers.push(await startWorker("b"));
}, { timeout: 40000 });
after(async () => {
  await Promise.all(workers.map(async worker => {
    if (worker.child.connected) worker.child.send("stop");
    const timer = setTimeout(() => worker.child.kill("SIGKILL"), 4000);
    try { await worker.exited; } finally { clearTimeout(timer); }
  }));
  await pool.end();
});
async function request(worker: Worker, path: string, method = "GET", body?: unknown, token?: string) {
  const res = await fetch(worker.origin + "/api" + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, body: await res.json() as Record<string, any> };
}
async function fixture() {
  const [a, b] = workers;
  const session = await request(a, "/party/create", "POST", {});
  assert.equal(session.status, 200);
  const code = session.body.code as string, host = session.body.hostToken as string;
  const one = await request(a, "/party/" + code + "/register-member", "POST", {});
  const two = await request(b, "/party/" + code + "/register-member", "POST", {});
  assert.equal(one.status, 200); assert.equal(two.status, 200);
  const owner = one.body.memberId as string, token = one.body.memberToken as string;
  const recipient = two.body.memberId as string;
  async function admit(worker = a, companionId = "pet") {
    return request(worker, "/party/" + code + "/combat-npcs", "POST", {
      name: "Retained wolf", sourceType: "character", sourceId: companionId, disposition: "friendly",
      dummyState: { maxHp: 12, currentHp: 3, armorClass: 13, actionUsed: true, reactionUsed: true, movementUsed: 15 },
      projection: { combatantKind: "companion", companionId, ownerMemberId: owner, ownerCharacterId: "local-wolf" },
    }, token);
  }
  const leave = (worker = a) => request(worker, "/party/leave", "DELETE", { partyCode: code, memberId: owner }, token);
  async function durable() {
    const { rows } = await pool.query("SELECT state_revision AS revision, snapshot FROM party_runtime_snapshots WHERE party_code=$1", [code]);
    return rows[0] as { revision: number; snapshot: Record<string, any> } | undefined;
  }
  async function memberExists() {
    return (await pool.query("SELECT 1 FROM party_members WHERE id=$1 AND party_code=$2", [owner, code])).rows.length > 0;
  }
  const activity = async () => (await pool.query("SELECT last_activity_at::text AS activity FROM party_sessions WHERE code=$1", [code])).rows[0].activity;
  return { a, b, code, host, owner, token, recipient, admit, leave, durable, memberExists, activity };
}
async function blocked(worker: Worker) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const { rows } = await pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query ILIKE '%for update%'",
      [worker.application]);
    if (rows.length) return;
    await new Promise(done => setTimeout(done, 20));
  }
  assert.fail("Expected a real PostgreSQL row-lock wait in " + worker.application);
}
async function withSessionLock(code: string, run: (release: () => Promise<void>) => Promise<void>) {
  const lock = await pool.connect();
  let released = false;
  const release = async () => { if (!released) { await lock.query("COMMIT"); released = true; } };
  try {
    await lock.query("BEGIN");
    await lock.query("SELECT code FROM party_sessions WHERE code=$1 FOR UPDATE", [code]);
    await run(release);
    await release();
  } finally { if (!released) await lock.query("ROLLBACK"); lock.release(); }
}
async function failWrites(table: "party_members" | "party_runtime_snapshots", code: string, deferred = false) {
  const id = "ci_fail_" + randomUUID().replaceAll("-", "");
  const literal = "'" + code.replaceAll("'", "''") + "'";
  await pool.query(`CREATE FUNCTION ${id}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='DELETE' THEN
        IF OLD.party_code=TG_ARGV[0] THEN RAISE EXCEPTION 'integration forced failure'; END IF;
        RETURN OLD;
      END IF;
      IF NEW.party_code=TG_ARGV[0] THEN RAISE EXCEPTION 'integration forced failure'; END IF;
      RETURN NEW;
    END $$`);
  const statement = table === "party_members"
    ? `CREATE TRIGGER ${id} BEFORE DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION ${id}(${literal})`
    : deferred
      ? `CREATE CONSTRAINT TRIGGER ${id} AFTER INSERT OR UPDATE ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${id}(${literal})`
      : `CREATE TRIGGER ${id} BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION ${id}(${literal})`;
  await pool.query(statement);
  return async () => { await pool.query(`DROP TRIGGER ${id} ON ${table}`); await pool.query(`DROP FUNCTION ${id}()`); };
}
test("HTTP lifecycle preserves damaged state, detaches atomically and recovers to a new enrollment", { timeout: 30000 }, async () => {
  const f = await fixture(), first = await f.admit(); assert.equal(first.status, 200);
  const npc = first.body.npc;
  assert.equal((await request(f.a, "/party/" + f.code + "/initiative/start", "POST", {
    targetMemberIds: [f.owner, f.recipient], targetNpcIds: [npc.id], includeEnvironment: false,
  }, f.host)).status, 200);
  assert.equal((await request(f.a, "/party/" + f.code + "/combat-npcs/" + npc.id + "/gear", "PUT",
    { gear: [{ id: "collar", name: "Wolf collar", category: "gear", equipped: true }] }, f.host)).status, 200);
  const before = (await f.durable())!.snapshot.combatNpcs[0];
  await request(f.b, "/party/" + f.code + "/combat-state");
  assert.equal((await f.leave()).status, 200); assert.equal(await f.memberExists(), false);
  const departed = (await f.durable())!, retained = departed.snapshot.combatNpcs[0];
  assert.ok(retained.companionAdmission.detachedAt);
  assert.deepEqual(retained.dummyState, before.dummyState); assert.deepEqual(retained.gear, before.gear);
  assert.equal(departed.snapshot.participantBattleById[npc.id], undefined);
  assert.equal(departed.snapshot.turnOrder.includes(npc.id), false);
  assert.equal((await f.admit(f.b)).status, 403);
  const rejoined = await request(f.b, "/party/" + f.code + "/register-member", "POST", {});
  assert.notEqual(rejoined.body.memberId, f.owner);
  const payload = { targetMemberId: rejoined.body.memberId, expectedRevision: departed.revision,
    expectedDetachedAt: retained.companionAdmission.detachedAt, reason: "Owner rejoined after disconnect." };
  const recovered = await request(f.b, "/party/" + f.code + "/combat-npcs/" + npc.id + "/recover-companion", "POST", payload, f.host);
  assert.equal(recovered.status, 200);
  const saved = (await f.durable())!;
  assert.equal(saved.snapshot.combatNpcs[0].companionAdmission.memberId, rejoined.body.memberId);
  assert.deepEqual(saved.snapshot.combatNpcs[0].dummyState, before.dummyState);
  assert.equal(saved.snapshot.participantBattleById[npc.id], undefined);
  assert.equal(saved.snapshot.eventLog[0].type, "companion_recovered");
  assert.equal((await request(f.a, "/party/" + f.code + "/combat-npcs/" + npc.id + "/recover-companion", "POST", payload, f.host)).status, 409);
  assert.equal((await f.durable())!.revision, saved.revision);
});
for (const mode of ["runtime", "member-delete", "deferred-commit"] as const) {
  test("real PostgreSQL " + mode + " failure rolls departure back", { timeout: 30000 }, async () => {
    const f = await fixture(); assert.equal((await f.admit()).status, 200);
    const before = await f.durable(), clock = await f.activity();
    const remove = await failWrites(mode === "member-delete" ? "party_members" : "party_runtime_snapshots", f.code, mode === "deferred-commit");
    try {
      assert.equal((await f.leave()).status, 500);
      assert.equal(await f.memberExists(), true); assert.deepEqual(await f.durable(), before);
      assert.equal(await f.activity(), clock);
    } finally { await remove(); }
    assert.equal((await f.leave()).status, 200);
  });
}
test("admission commit failure rolls back activity, runtime and event; explicit retry succeeds", { timeout: 30000 }, async () => {
  const f = await fixture(), clock = await f.activity();
  const remove = await failWrites("party_runtime_snapshots", f.code, true);
  try {
    assert.equal((await f.admit()).status, 500); assert.equal(await f.durable(), undefined);
    assert.equal(await f.activity(), clock); assert.equal(await f.memberExists(), true);
  } finally { await remove(); }
  assert.equal((await f.admit()).status, 200);
});
for (const first of ["admission", "departure"] as const) {
  test("independent processes queued with " + first + " first cannot leave an active orphan", { timeout: 30000 }, async () => {
    const f = await fixture(); assert.equal((await f.admit()).status, 200);
    await request(f.b, "/party/" + f.code + "/combat-state");
    let add!: Awaited<ReturnType<typeof f.admit>>, leave!: Awaited<ReturnType<typeof f.leave>>;
    await withSessionLock(f.code, async release => {
      const firstRequest = first === "admission" ? f.admit(f.a, "second-pet") : f.leave(f.a);
      await blocked(f.a);
      const secondRequest = first === "admission" ? f.leave(f.b) : f.admit(f.b, "second-pet");
      await blocked(f.b);
      await release();
      const [one, two] = await Promise.all([firstRequest, secondRequest]);
      [add, leave] = first === "admission" ? [one, two] : [two, one];
    });
    assert.ok([200, 403, 409].includes(add.status)); assert.ok([200, 409].includes(leave.status));
    if (await f.memberExists()) assert.equal((await f.leave(f.b)).status, 200);
    const saved = (await f.durable())!.snapshot;
    for (const npc of saved.combatNpcs.filter((n: any) => n.companionAdmission?.memberId === f.owner)) {
      assert.ok(npc.companionAdmission.detachedAt); assert.equal(saved.participantBattleById[npc.id], undefined);
    }
    assert.equal((await f.admit(f.a, "late-pet")).status, 403);
  });
}
test("simultaneous first admission across processes yields one live instance and one creation event", { timeout: 30000 }, async () => {
  const f = await fixture();
  const replies = await Promise.all([f.admit(f.a), f.admit(f.b)]);
  assert.ok(replies.every(r => [200, 409].includes(r.status)));
  assert.ok(replies.some(r => r.status === 200));
  const retry = await f.admit(f.b); assert.equal(retry.status, 200); assert.equal(retry.body.reused, true);
  const state = (await f.durable())!.snapshot;
  assert.equal(state.combatNpcs.length, 1);
  assert.equal(state.eventLog.filter((e: any) => e.type === "combat_npc_added").length, 1);
});
test("a second process reads detachment committed after its cache was warmed", { timeout: 30000 }, async () => {
  const f = await fixture(); assert.equal((await f.admit()).status, 200);
  assert.equal((await request(f.b, "/party/" + f.code + "/combat-state")).status, 200);
  assert.equal((await f.leave(f.a)).status, 200);
  const visible = await request(f.b, "/party/" + f.code + "/combat-state");
  assert.equal(visible.status, 200); assert.ok(visible.body.combatNpcs[0].companionAdmission.detachedAt);
  assert.equal(visible.body.turnOrder.includes(visible.body.combatNpcs[0].id), false);
});

test("recovery deferred-commit failure preserves provenance, state and history", { timeout: 30000 }, async () => {
  const f = await fixture(); assert.equal((await f.admit()).status, 200); assert.equal((await f.leave()).status, 200);
  const before = (await f.durable())!, npc = before.snapshot.combatNpcs[0];
  const payload = { targetMemberId: f.recipient, expectedRevision: before.revision,
    expectedDetachedAt: npc.companionAdmission.detachedAt, reason: "Restore after owner departure." };
  const remove = await failWrites("party_runtime_snapshots", f.code, true);
  try {
    assert.equal((await request(f.b, "/party/" + f.code + "/combat-npcs/" + npc.id + "/recover-companion", "POST", payload, f.host)).status, 500);
    assert.deepEqual(await f.durable(), before);
  } finally { await remove(); }
});
test("competing recovery requests across processes commit one audited binding", { timeout: 30000 }, async () => {
  const f = await fixture(); await f.admit(); await f.leave();
  const before = (await f.durable())!, npc = before.snapshot.combatNpcs[0];
  const extra = await request(f.b, "/party/" + f.code + "/register-member", "POST", {});
  const common = { expectedRevision: before.revision, expectedDetachedAt: npc.companionAdmission.detachedAt, reason: "Reviewed recipient." };
  const result = await Promise.all([
    request(f.a, "/party/" + f.code + "/combat-npcs/" + npc.id + "/recover-companion", "POST", { ...common, targetMemberId: f.recipient }, f.host),
    request(f.b, "/party/" + f.code + "/combat-npcs/" + npc.id + "/recover-companion", "POST", { ...common, targetMemberId: extra.body.memberId }, f.host),
  ]);
  assert.deepEqual(result.map(r => r.status).sort(), [200, 409]);
  const saved = (await f.durable())!;
  assert.equal(saved.revision, before.revision + 1);
  assert.equal(saved.snapshot.eventLog.filter((e: any) => e.type === "companion_recovered").length, 1);
  assert.ok([f.recipient, extra.body.memberId].includes(saved.snapshot.combatNpcs[0].companionAdmission.memberId));
});
