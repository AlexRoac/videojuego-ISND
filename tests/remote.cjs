const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const port = 19000 + Math.floor(Math.random() * 1000);
const child = spawn(process.execPath, [path.join(__dirname, '../server.cjs')], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
const base = `http://127.0.0.1:${port}`;
(async () => {
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); child.once('exit', code => reject(new Error(`Servidor terminó: ${code}`))); });
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(`${base}/controller.html`)).status, 200);
  assert.equal((await fetch(`${base}/.git/config`)).status, 404);
  const room = await (await fetch(`${base}/api/room`, { method: 'POST' })).json();
  const query = `room=${room.id}&token=${room.token}`;
  assert.equal((await fetch(`${base}/api/input?room=${room.id}&token=wrong`, { method: 'POST', body: '{}' })).status, 403);
  const abort = new AbortController();
  const events = await fetch(`${base}/api/events?${query}`, { signal: abort.signal, headers: { Origin: 'http://localhost:9999' } });
  assert.equal(events.headers.get('access-control-allow-origin'), '*');
  assert.equal(events.headers.get('x-accel-buffering'), 'no');
  const reader = events.body.getReader();
  await reader.read();
  const input = await fetch(`${base}/api/input?${query}`, { method: 'POST', headers: { Origin: 'https://game.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 8, y: -4, ax: .5, fire: true, patch: true, action: 'pulse' }) });
  assert.equal((await input.json()).connected, true);
  let text = '';
  const deadline = Date.now() + 4000;
  while (!text.includes('"disconnected":true') && Date.now() < deadline) {
    const chunk = await reader.read();
    text += new TextDecoder().decode(chunk.value);
  }
  assert.match(text, /"x":1,"y":-1/);
  assert.match(text, /"fire":true/);
  assert.match(text, /"action":"pulse"/);
  assert.match(text, /"disconnected":true/);
  assert.equal((await fetch(`${base}/api/input?${query}`, { method: 'POST', body: '{broken' })).status, 400);
  assert.equal((await fetch(`${base}/api/input?${query}`, { method: 'OPTIONS', headers: { Origin: 'https://game.example' } })).status, 204);
  assert.equal((await fetch(`${base}/api/input?room=${room.id}&token=wrong`, { method: 'POST', headers: { Origin: 'https://game.example' }, body: '{}' })).status, 403);
  const publicAddress = await new Promise((resolve, reject) => {
    require('node:http').get(`${base}/api/addresses`, { headers: { Host: 'game.example', 'X-Forwarded-Proto': 'https' } }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    }).on('error', reject);
  });
  assert.deepEqual(publicAddress, { addresses: ['https://game.example'], public: true });
  const localAddress = await (await fetch(`${base}/api/addresses`)).json();
  assert.equal(localAddress.public, false);
  abort.abort();
  console.log('OK: relay entre orígenes distintos, HTTPS público, sesión, acciones y desconexión automática.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => child.kill());
