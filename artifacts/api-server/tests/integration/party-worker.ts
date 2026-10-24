import assert from "node:assert/strict";
const schema = process.env.PARTY_TEST_SCHEMA;
assert.match(schema ?? "", /^dnd_it_[a-f0-9]{32}$/);
assert.equal(process.env.RUN_POSTGRES_INTEGRATION, "1");
const { pool } = await import("@workspace/db");
const { rows } = await pool.query("SELECT current_schema() AS schema");
assert.equal(rows[0].schema, schema);
const { default: app } = await import("../../src/app");
const server = app.listen(0, "127.0.0.1", () => {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  process.send?.({ port: address.port });
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  await new Promise<void>(done => server.close(() => done()));
  await pool.end();
  if (process.connected) process.disconnect?.();
}
process.on("SIGTERM", () => void stop());
process.on("message", message => { if (message === "stop") void stop(); });
