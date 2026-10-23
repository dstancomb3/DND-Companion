const { spawn } = require('node:child_process');
const net = require('node:net');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const probe = net.createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r));
  const password = 'temporary-local-preview-smoke-password';
  const child = spawn(process.execPath, ['scripts/start-cloud-preview.cjs'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, NODE_ENV: 'production', PORT: String(port), DATABASE_URL: 'postgres://local:local@127.0.0.1:1/local?connect_timeout=1', AI_INTEGRATIONS_OPENAI_API_KEY: '', AI_INTEGRATIONS_OPENAI_BASE_URL: '', CLOUD_PREVIEW_MODE: 'false', PREVIEW_PASSWORD: password, PREVIEW_SESSION_SECRET: 'temporary-local-session-secret-at-least-32-characters', CLOUD_PREVIEW_ORIGIN: 'https://preview.example' }, stdio: 'ignore' });
  const exited = new Promise(r => child.once('exit', r));
  const base = `http://127.0.0.1:${port}`, headers = { authorization: `Basic ${Buffer.from(`tester:${password}`).toString('base64')}` };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/healthz')).status === 200) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
    assert.ok(ready, 'compiled server starts');
    assert.equal((await fetch(base + '/')).status, 401);
    const page = await fetch(base + '/', { headers }); assert.equal(page.status, 200); const html = await page.text(); assert.match(html, /<html/i);
    const cookie = page.headers.get('set-cookie').split(';')[0];
    const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]); assert.ok(scripts.length > 0);
    for (const script of scripts) assert.equal((await fetch(new URL(script, base), { headers })).status, 200);
    assert.equal((await fetch(base + '/adventure/session/test', { headers })).status, 200);
    assert.equal((await fetch(base + '/api/health', { headers: { cookie, authorization: 'Bearer member-proof' } })).status, 200);
    const denied = await fetch(base + '/api/ai/parse-update', { method: 'POST', headers: { authorization: 'Bearer member-proof' } }); assert.equal(denied.status, 401); assert.equal((await denied.json()).code, 'preview_login_required');
    assert.equal((await fetch(base + '/api/not-a-route', { headers })).status, 404);
    console.log('Compiled preview HTTP smoke passed: health, login, web assets, deep links, independent bearer/cookie and API perimeter. No live DB or AI calls.');
  } finally { child.kill('SIGTERM'); await exited; }
})().catch(error => { console.error(error); process.exitCode = 1; });
