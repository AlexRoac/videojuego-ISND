// Servidor del juego y relay del mando: local o publicado en internet.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
const rooms = new Map();
const root = __dirname;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.md': 'text/plain' };
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function emit(room, data) { room.stream?.write(`data: ${JSON.stringify(data)}\n\n`); }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // No se usan cookies: cada sesión se autoriza con un token aleatorio.
  // Permite que un juego local utilice un relay HTTPS público.
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  if (req.method === 'POST' && url.pathname === '/api/room') {
    if (rooms.size >= 1000) return send(res, 503, { error: 'Servidor ocupado. Intenta más tarde.' });
    const id = randomBytes(4).toString('hex');
    const token = randomBytes(16).toString('hex');
    rooms.set(id, { token, stream: null, last: 0, created: Date.now() });
    return send(res, 200, { id, token });
  }
  if (url.pathname === '/api/addresses') {
    const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https:' : 'http:';
    let publicURL;
    try { publicURL = new URL(process.env.PUBLIC_URL || `${protocol}//${req.headers.host}`); }
    catch { return send(res, 400, { error: 'Dirección inválida' }); }
    const hostname = publicURL.hostname;
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$)/i.test(hostname);
    const port = server.address().port;
    const addresses = Object.values(os.networkInterfaces()).flat().filter(a => a.family === 'IPv4' && !a.internal).map(a => `http://${a.address}:${port}`);
    return send(res, 200, { addresses: local ? addresses : [publicURL.origin], public: !local });
  }
  if (url.pathname.startsWith('/api/')) {
    const room = rooms.get(url.searchParams.get('room'));
    if (!room || room.token !== url.searchParams.get('token')) return send(res, 403, { error: 'Enlace inválido. Vuelve a conectar desde la computadora.' });
    if (req.method === 'GET' && url.pathname === '/api/events') {
      if (room.stream) room.stream.end();
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      room.stream = res;
      res.write(': conectado\n\n');
      req.on('close', () => { if (room.stream === res) room.stream = null; });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/input') {
      let body = '';
      try {
        for await (const chunk of req) { body += chunk; if (body.length > 2048) return send(res, 413, { error: 'Mensaje demasiado grande' }); }
        const data = JSON.parse(body);
        if (!data || typeof data !== 'object' || Array.isArray(data)) return send(res, 400, { error: 'Mensaje inválido' });
        const axis = n => Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
        const input = { x: axis(data.x), y: axis(data.y), ax: axis(data.ax), ay: axis(data.ay), fire: data.fire === true, patch: data.patch === true };
        if (['pulse', 'pause', 'advance', 'mute'].includes(data.action)) input.action = data.action;
        room.last = Date.now();
        emit(room, input);
        return send(res, 200, { connected: !!room.stream });
      } catch { return send(res, 400, { error: 'Mensaje inválido' }); }
    }
    return send(res, 404, { error: 'Ruta desconocida' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, {});
  let relative;
  try { relative = decodeURIComponent(url.pathname); } catch { return send(res, 400, {}); }
  const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(root + path.sep) || relative.split('/').some(part => part.startsWith('.')) || !['.html', '.js', '.css', '.svg', '.md'].includes(path.extname(file))) return send(res, 404, {});
  fs.readFile(file, (error, content) => {
    if (error) return send(res, 404, {});
    res.writeHead(200, { 'Content-Type': `${mime[path.extname(file)]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
});
setInterval(() => {
  for (const [id, room] of rooms) {
    if (room.last && Date.now() - room.last > 800) { emit(room, { disconnected: true }); room.last = 0; }
    room.stream?.write(': heartbeat\n\n');
    if (!room.stream && Date.now() - Math.max(room.last, room.created) > 3600000) rooms.delete(id);
  }
}, 250).unref();
server.listen(Number(process.env.PORT) || 5173, '0.0.0.0', () => {
  console.log(`Juego: http://localhost:${server.address().port}`);
  for (const a of Object.values(os.networkInterfaces()).flat()) if (a.family === 'IPv4' && !a.internal) console.log(`Red Wi-Fi: http://${a.address}:${server.address().port}`);
  console.log('Abre el juego en la computadora y pulsa «Conectar celular». Ctrl+C para cerrar.');
});
