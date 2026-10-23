import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCloudPreview } from "./cloudPreview";
const password = "test-only-password-very-long", secret = "test-only-session-secret-at-least-32-characters";
const basic = `Basic ${Buffer.from(`tester:${password}`).toString("base64")}`;
async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "dnd-preview-"));
  await writeFile(path.join(root, "index.html"), "<html>Companion preview</html>");
  await writeFile(path.join(root, "asset.js"), "window.previewLoaded=true;");
  await writeFile(path.join(root, ".env"), "DO_NOT_SERVE");
  const env = { CLOUD_PREVIEW_MODE: "true", PREVIEW_PASSWORD: password, PREVIEW_SESSION_SECRET: secret, CLOUD_PREVIEW_ORIGIN: "https://preview.example", CLOUD_PREVIEW_WEB_ROOT: root };
  let now = 1_800_000_000_000, calls = 0;
  const preview = createCloudPreview(env, () => now)!;
  const app = express(); preview.protect(app); app.use(express.json());
  app.post("/api/check", (req, res) => { calls++; res.json({ authorization: req.get("authorization") }); });
  preview.serve(app);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  t.after(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); await rm(root, { recursive: true, force: true }); });
  return { env, base: `http://127.0.0.1:${address.port}`, calls: () => calls, expire: () => { now += 8 * 60 * 60 * 1000; } };
}
test("preview is opt-in and malformed mode fails closed", () => {
  assert.equal(createCloudPreview({}), null); assert.equal(createCloudPreview({ CLOUD_PREVIEW_MODE: "false" }), null);
  assert.throws(() => createCloudPreview({ CLOUD_PREVIEW_MODE: "tru" }), /true or false/);
});
test("preview refuses missing/weak credentials, non-HTTPS origins and absent build", async t => {
  const f = await fixture(t);
  for (const patch of [{ PREVIEW_PASSWORD: "" }, { PREVIEW_SESSION_SECRET: "short" }, { CLOUD_PREVIEW_ORIGIN: "http://preview.example" }, { CLOUD_PREVIEW_ORIGIN: "https://user:password@preview.example" }, { CLOUD_PREVIEW_ORIGIN: "https://preview.example/path" }, { CLOUD_PREVIEW_ORIGIN: "" }, { CLOUD_PREVIEW_WEB_ROOT: path.join(f.env.CLOUD_PREVIEW_WEB_ROOT, "absent") }]) {
    assert.throws(() => createCloudPreview({ ...f.env, ...patch }));
  }
  assert.ok(createCloudPreview({ ...f.env, CLOUD_PREVIEW_ORIGIN: undefined, RENDER_EXTERNAL_URL: "https://preview.example" }));
});
test("health is public; HTML, assets and API are protected before handlers run", async t => {
  const f = await fixture(t); assert.equal((await fetch(`${f.base}/healthz`)).status, 200);
  for (const url of ["/", "/asset.js", "/adventure/session/example"]) {
    const res = await fetch(f.base + url); assert.equal(res.status, 401); assert.match(res.headers.get("www-authenticate")!, /Basic/); assert.equal(res.headers.get("cache-control"), "private, no-store");
  }
  for (const authorization of [undefined, "Bearer member-proof", "Basic incorrect", `Basic ${Buffer.from("tester:incorrect").toString("base64")}`]) {
    const res = await fetch(`${f.base}/api/check`, { method: "POST", headers: authorization ? { authorization } : {} }); assert.equal(res.status, 401);
    assert.equal(res.headers.get("www-authenticate"), null);
  }
  assert.equal(f.calls(), 0);
});
test("browser login cookie protects API while preserving independent party Bearer proof", async t => {
  const f = await fixture(t); const login = await fetch(f.base, { headers: { authorization: basic } }); assert.equal(login.status, 200);
  assert.equal(login.headers.get("cache-control"), "private, no-store");
  const setCookie = login.headers.get("set-cookie")!;
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=28800"]) assert.ok(setCookie.includes(flag));
  assert.equal(setCookie.includes(password), false); assert.equal(setCookie.includes(secret), false);
  const res = await fetch(`${f.base}/api/check`, { method: "POST", headers: { cookie: setCookie.split(";")[0], authorization: "Bearer member-proof", origin: "https://preview.example" } });
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), { authorization: "Bearer member-proof" }); assert.equal(f.calls(), 1);
});
test("expired and forged cookies fail without invoking API", async t => {
  const f = await fixture(t), login = await fetch(f.base, { headers: { authorization: basic } }); const cookie = login.headers.get("set-cookie")!.split(";")[0];
  for (const invalid of [`${cookie}x`, cookie.replace("v1.", "v2."), "__Host-dnd-preview=v1.9999999999.forged"]) assert.equal((await fetch(`${f.base}/api/check`, { method: "POST", headers: { cookie: invalid } })).status, 401);
  f.expire(); assert.equal((await fetch(`${f.base}/api/check`, { method: "POST", headers: { cookie } })).status, 401); assert.equal(f.calls(), 0);
});
test("cross-origin API calls fail even with valid login", async t => {
  const f = await fixture(t), login = await fetch(f.base, { headers: { authorization: basic } }); const cookie = login.headers.get("set-cookie")!.split(";")[0];
  for (const headers of [{ origin: "https://other.example" }, { "sec-fetch-site": "cross-site" }]) {
    const res = await fetch(`${f.base}/api/check`, { method: "POST", headers: { ...headers, cookie, authorization: basic } }); assert.equal(res.status, 403); assert.equal(res.headers.get("access-control-allow-origin"), null);
  }
  assert.equal(f.calls(), 0);
});
test("SPA deep links work; missing APIs/assets and dotfiles never become app HTML", async t => {
  const f = await fixture(t), headers = { authorization: basic, accept: "text/html" };
  assert.match(await (await fetch(`${f.base}/adventure/session/example`, { headers })).text(), /Companion preview/);
  assert.match(await (await fetch(`${f.base}/asset.js`, { headers })).text(), /previewLoaded/);
  for (const url of ["/api/missing", "/missing.js", "/.env", "/secret.txt"]) {
    const res = await fetch(f.base + url, { headers }); assert.ok(res.status >= 400); assert.equal((await res.text()).includes("DO_NOT_SERVE"), false);
  }
  const api = await fetch(`${f.base}/api/missing`, { headers }); assert.match(api.headers.get("content-type")!, /application\/json/);
});
