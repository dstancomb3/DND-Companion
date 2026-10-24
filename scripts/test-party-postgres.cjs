// Creates only a uniquely named schema in an explicitly selected local test DB.
// Never loads .env or falls back to the app's DATABASE_URL.
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const { resolve, dirname } = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");

function validateTestDatabase(env) {
  if (env.RUN_POSTGRES_INTEGRATION !== "1") throw Error("Set RUN_POSTGRES_INTEGRATION=1 for the isolated PostgreSQL suite.");
  let url;
  try { url = new URL(env.TEST_DATABASE_URL); } catch { throw Error("TEST_DATABASE_URL must name the local disposable test database."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/dnd_companion_ci" || url.search || url.hash) {
    throw Error("Use a loopback PostgreSQL URL for database dnd_companion_ci without URL options.");
  }
  return url;
}
async function main() {
  const url = validateTestDatabase(process.env);
  const root = resolve(__dirname, "..");
  const dbRequire = createRequire(resolve(root, "lib/db/package.json"));
  const { Client } = dbRequire("pg");
  const schema = "dnd_it_" + randomUUID().replaceAll("-", "");
  const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  let created = false, child;
  try {
    await client.connect();
    await client.query("SET statement_timeout = '20s'");
    // Export the current repository model, without invoking push or a migration.
    const cli = resolve(dirname(dbRequire.resolve("drizzle-kit")), "bin.cjs");
    const { stdout } = await promisify(execFile)(process.execPath, [
      cli, "export", "--dialect", "postgresql", "--schema", "./lib/db/src/schema/party.ts",
    ], { cwd: root, maxBuffer: 2 * 1024 * 1024 });
    if (!stdout.includes('CREATE TABLE "party_sessions"')) throw Error("Party schema export is missing required DDL.");
    await client.query('CREATE SCHEMA "' + schema + '"');
    created = true;
    await client.query('SET search_path TO "' + schema + '"');
    await client.query(stdout.replaceAll('"public".', '"' + schema + '".'));
    url.searchParams.set("options", "-c search_path=" + schema + " -c statement_timeout=15000 -c lock_timeout=10000");
    url.searchParams.set("application_name", schema + "_tests");
    console.log("Isolated party schema:", schema);
    child = spawn(process.execPath, [
      "--import", "tsx", "--test", "--test-concurrency=1",
      "artifacts/api-server/tests/integration/party-lifecycle.postgres.test.ts",
    ], {
      cwd: root, stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url.href, PARTY_TEST_SCHEMA: schema,
        CLOUD_PREVIEW_MODE: "false", NODE_ENV: "test", LOG_LEVEL: "silent",
        AI_INTEGRATIONS_OPENAI_API_KEY: "", AI_INTEGRATIONS_OPENAI_BASE_URL: "", OPENAI_API_KEY: "" },
    });
    const stop = () => child?.kill("SIGTERM");
    process.once("SIGTERM", stop); process.once("SIGINT", stop);
    try {
      process.exitCode = await new Promise((done, reject) => {
        child.once("error", reject); child.once("exit", code => done(code ?? 1));
      });
    } finally { process.off("SIGTERM", stop); process.off("SIGINT", stop); }
  } finally {
    if (created) {
      await client.query('DROP SCHEMA "' + schema + '" CASCADE');
      console.log("Removed isolated party schema:", schema);
    }
    await client.end();
  }
}
module.exports = { validateTestDatabase };
if (require.main === module) main().catch(error => {
  // Do not print connection strings or credentials from environment/driver errors.
  console.error("PostgreSQL integration runner failed:", error.code || error.name);
  process.exitCode = 1;
});
