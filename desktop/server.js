// Servidor LAN integrado en la app de escritorio (equivalente a servidor.py):
// sirve los archivos del juego por HTTP y reenvía los mensajes entre jugadores por WebSocket (/ws).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};

function lanIps() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address);
  }
  return out;
}

// root: carpeta del juego que se sirve (se puede cambiar con setRoot al elegir otra versión)
function start(root, port, log = console.log) {
  root = path.resolve(root);
  const clients = new Map();
  let nextId = 1, hostId = null;
  const send = (c, obj) => { try { c.ws.send(JSON.stringify(obj)); } catch (e) { /* cliente cerrado */ } };
  const broadcast = (obj, exclude) => { const t = JSON.stringify(obj); for (const c of clients.values()) if (c.id !== exclude) try { c.ws.send(t); } catch (e) { /* nada */ } };

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
    if (p === '/lan-info') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ ips: lanIps(), port: server.address().port }));
      return;
    }
    if (p.endsWith('/')) p += 'index.html';
    const full = path.resolve(path.join(root, p));
    if (!full.startsWith(root + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - No encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(full).pipe(res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    if (!(req.url || '').startsWith('/ws')) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (ws) => {
    const c = { id: nextId++, ws, info: {} };
    clients.set(c.id, c);
    if (!clients.has(hostId)) hostId = c.id;
    const players = [...clients.values()].filter((o) => o.id !== c.id).map((o) => ({ id: o.id, ...o.info }));
    send(c, { t: 'welcome', id: c.id, host: hostId === c.id, hostId, players });
    log(`+ Jugador #${c.id} conectado (${clients.size} en línea)${hostId === c.id ? ' [anfitrión]' : ''}`);
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      msg.from = c.id;
      if (msg.t === 'hello') c.info = { name: String(msg.name || '').slice(0, 16), color: String(msg.color || '#ccc').slice(0, 9), ver: String(msg.ver || '').slice(0, 12) };
      if (msg.to !== undefined && msg.to !== null) { const target = clients.get(msg.to); if (target) send(target, msg); }
      else broadcast(msg, c.id);
    });
    ws.on('close', () => {
      clients.delete(c.id);
      log(`- ${c.info.name || '#' + c.id} se desconectó (${clients.size} en línea)`);
      if (hostId === c.id) {
        hostId = clients.size ? clients.keys().next().value : null;
        if (hostId !== null) broadcast({ t: 'hostChanged', id: hostId });
      }
      broadcast({ t: 'leave', id: c.id });
    });
  });

  // Prueba el puerto pedido y, si está ocupado, los siguientes
  return new Promise((resolve, reject) => {
    let p = port, tries = 0;
    const attempt = () => {
      server.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && tries++ < 15) { p++; attempt(); } else reject(e);
      });
      server.listen(p, '0.0.0.0', () => resolve({ port: p, ips: lanIps(), close: () => { wss.close(); server.close(); }, setRoot: (dir) => { root = path.resolve(dir); }, getRoot: () => root }));
    };
    attempt();
  });
}

module.exports = { start, lanIps };

// Uso directo: node desktop/server.js [puerto]
if (require.main === module) {
  start(path.join(__dirname, '..'), +process.argv[2] || 8080).then((s) => {
    console.log(`\n  Isla Perdida - Servidor LAN\n  Tú abre:          http://localhost:${s.port}`);
    for (const ip of s.ips) console.log(`  Tus amigos abren: http://${ip}:${s.port}`);
  });
}
