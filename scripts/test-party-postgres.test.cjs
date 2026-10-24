const assert = require("node:assert/strict");
const test = require("node:test");
const { validateTestDatabase } = require("./test-party-postgres.cjs");
const valid = { RUN_POSTGRES_INTEGRATION: "1", TEST_DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/dnd_companion_ci" };
test("PostgreSQL harness requires explicit opt-in and never falls back to DATABASE_URL", () => {
  assert.throws(() => validateTestDatabase({ ...valid, RUN_POSTGRES_INTEGRATION: undefined }));
  assert.throws(() => validateTestDatabase({ RUN_POSTGRES_INTEGRATION: "1", DATABASE_URL: valid.TEST_DATABASE_URL }));
});
for (const url of [
  "postgresql://test:test@remote.example/dnd_companion_ci",
  "postgresql://test:test@127.0.0.1/character_companion",
  "postgresql://test:test@127.0.0.1/dnd_companion_ci?options=-csearch_path=public",
  "postgresql://test:test@127.0.0.1/dnd_companion_ci#fragment",
  "https://127.0.0.1/dnd_companion_ci", "not-a-url",
]) test("PostgreSQL harness rejects non-disposable target " + url.split("@").pop(), () => {
  assert.throws(() => validateTestDatabase({ ...valid, TEST_DATABASE_URL: url }));
});
test("PostgreSQL harness accepts only the explicit local test DB", () => {
  assert.equal(validateTestDatabase(valid).pathname, "/dnd_companion_ci");
});
