// App de escritorio de Isla Perdida (Electron), con lanzador de versiones al estilo Minecraft:
// - al abrirla aparece el lanzador: versiones incluidas, instaladas y disponibles en GitHub
// - se pueden descargar varias versiones del juego, borrarlas y elegir con cuál jugar
// - arranca el servidor LAN integrado y sirve la versión elegida (los amigos por navegador reciben la misma)
// - la app en sí se actualiza desde GitHub (preguntando antes); las versiones del juego las eliges tú
'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const server = require('./server');

const REPO = 'Pro1Code/isla-perdida';
const PAGES = `https://${REPO.split('/')[0].toLowerCase()}.github.io/${REPO.split('/')[1]}/`; // página de descargas (y novedades/)
const ASSET = /^isla-perdida-juego-.+\.zip$/i;
const ROOT = path.join(__dirname, '..');
let win = null, srv = null, updateState = { state: 'idle' }, current = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

// ------------------------------------------------------------------ versiones
const dataDir = () => app.getPath('userData');
const versionsDir = () => path.join(dataDir(), 'versions');
const prefsFile = () => path.join(dataDir(), 'launcher.json');
const cacheFile = () => path.join(dataDir(), 'releases.json');
const readJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
const cmpVer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
function gameInfo(dir) {
  try {
    const v = fs.readFileSync(path.join(dir, 'js', 'version.js'), 'utf8');
    return { version: (v.match(/G\.VERSION = '([^']+)'/) || [])[1], name: (v.match(/G\.VERSION_NAME = '([^']+)'/) || [])[1] || '' };
  } catch (e) { return null; }
}
function installed() {
  const out = [];
  const b = gameInfo(ROOT);
  if (b && b.version) out.push({ version: b.version, name: b.name, bundled: true, dir: ROOT });
  try {
    for (const d of fs.readdirSync(versionsDir())) {
      const dir = path.join(versionsDir(), d), info = gameInfo(dir);
      if (info && info.version && !out.some((o) => o.version === info.version)) out.push({ version: info.version, name: info.name, bundled: false, dir });
    }
  } catch (e) { /* aún no hay versiones descargadas */ }
  return out.sort((a, b) => cmpVer(b.version, a.version));
}
// Lista de versiones publicadas en GitHub (se guarda para poder usar el lanzador sin internet), con su miniatura,
// notas y capturas de novedades/novedades.json (el mismo archivo que usan la página web y el juego)
async function remote(force) {
  const cache = readJSON(cacheFile(), null);
  if (cache && !force && Date.now() - cache.time < 10 * 60 * 1000) return cache.list;
  try {
    const [r, news] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, { headers: { 'User-Agent': 'IslaPerdida-Launcher' } }),
      fetch(PAGES + 'novedades/novedades.json', { cache: 'no-cache' }).then((x) => (x.ok ? x.json() : [])).catch(() => []),
    ]);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const nw = new Map((Array.isArray(news) ? news : []).map((n) => [n.version, n]));
    const abs = (p) => (/^https?:/.test(p) ? p : PAGES + 'novedades/' + p);
    const list = (await r.json()).filter((x) => !x.draft && !x.prerelease).map((x) => {
      const zip = (x.assets || []).find((a) => ASSET.test(a.name));
      const version = x.tag_name.replace(/^v/, ''), n = nw.get(version) || {};
      return {
        version, name: n.name || x.name || x.tag_name, date: x.published_at, notes: n.notes || x.body || '',
        thumb: n.thumb ? abs(n.thumb) : null, images: (n.images || []).map((m) => ({ src: abs(m.src), text: m.text || '' })),
        zip: zip ? zip.browser_download_url : null, size: zip ? zip.size : 0,
      };
    }).sort((a, b) => cmpVer(b.version, a.version));
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify({ time: Date.now(), list }));
    return list;
  } catch (e) {
    return cache ? cache.list : null;
  }
}
async function listVersions(force) {
  const inst = installed(), rem = await remote(force);
  const prefs = readJSON(prefsFile(), {});
  const map = new Map();
  for (const r of rem || []) map.set(r.version, Object.assign({}, r, { installed: false }));
  for (const i of inst) map.set(i.version, Object.assign(map.get(i.version) || { name: i.name, notes: '' }, { version: i.version, installed: true, bundled: i.bundled }));
  const all = [...map.values()].sort((a, b) => cmpVer(b.version, a.version));
  return { versions: all, latest: all[0] ? all[0].version : null, last: prefs.last || null, offline: !rem, app: app.getVersion(), update: updateState };
}
// Descarga el paquete de una versión y lo descomprime en su carpeta
async function download(version) {
  const rem = await remote(false) || [], r = rem.find((x) => x.version === version);
  if (!r || !r.zip) throw new Error('Esta versión no tiene paquete para el lanzador.');
  const send = (p) => win && !win.isDestroyed() && win.webContents.send('dl-progress', { version, ...p });
  const res = await fetch(r.zip, { headers: { 'User-Agent': 'IslaPerdida-Launcher' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = +res.headers.get('content-length') || r.size || 0, chunks = [];
  let got = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value)); got += value.length;
    send({ percent: total ? Math.round(got / total * 100) : 0 });
  }
  send({ percent: 100, extracting: true });
  const AdmZip = require('adm-zip');
  const tmp = path.join(versionsDir(), '.tmp-' + version), dst = path.join(versionsDir(), version);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  new AdmZip(Buffer.concat(chunks)).extractAllTo(tmp, true);
  if (!gameInfo(tmp)) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error('El paquete descargado está incompleto.'); }
  fs.rmSync(dst, { recursive: true, force: true });
  fs.renameSync(tmp, dst);
  send({ done: true });
  return true;
}
function play(version) {
  const v = installed().find((i) => i.version === version);
  if (!v || !srv) return false;
  srv.setRoot(v.dir);
  current = version;
  const prefs = readJSON(prefsFile(), {});
  prefs.last = version;
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(prefsFile(), JSON.stringify(prefs));
  win.setTitle(`Isla Perdida ${version}`);
  win.loadURL(`http://localhost:${srv.port}/?v=${encodeURIComponent(version)}`);
  return true;
}
function openLauncher() {
  current = null;
  win.setTitle('Isla Perdida · Lanzador');
  win.loadFile(path.join(__dirname, 'launcher.html'));
}

// Botón "Versiones" en el menú de cualquier versión del juego (también las antiguas)
const INJECT = `(() => {
  const add = () => {
    const box = document.getElementById('menuMain');
    if (!box || document.getElementById('btnLauncher')) return !!box;
    const b = document.createElement('button');
    b.id = 'btnLauncher'; b.className = 'btn small'; b.textContent = '🗂️ Cambiar de versión (lanzador)';
    b.onclick = () => window.islaDesktop && window.islaDesktop.openLauncher();
    box.appendChild(b);
    return true;
  };
  if (!add()) { const t = setInterval(() => { if (add()) clearInterval(t); }, 500); }
})();`;

// ------------------------------------------------------------------ actualización de la app
function sendUpdate(s) {
  updateState = s;
  if (win && !win.isDestroyed()) win.webContents.send('update', s);
}
function setupUpdater() {
  if (!app.isPackaged) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'latest', version: app.getVersion() }));
  autoUpdater.on('update-available', (i) => sendUpdate({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ state: 'downloading', version: updateState.version, percent: Math.round(p.percent) }));
  autoUpdater.on('error', () => sendUpdate({ state: 'error' }));
  autoUpdater.on('update-downloaded', (i) => sendUpdate({ state: 'ready', version: i.version }));
  ipcMain.on('checkUpdates', () => autoUpdater.checkForUpdates().catch(() => sendUpdate({ state: 'error' })));
  ipcMain.on('installUpdate', () => autoUpdater.quitAndInstall());
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => sendUpdate({ state: 'error' })), 4000);
}

// ------------------------------------------------------------------ ventana
async function createWindow() {
  try {
    srv = await server.start(ROOT, 8080, (m) => console.log(m));
  } catch (e) {
    dialog.showErrorBox('Isla Perdida', 'No se pudo iniciar el servidor LAN integrado.\n' + e.message);
  }
  win = new BrowserWindow({
    width: 1366, height: 820, minWidth: 900, minHeight: 600, backgroundColor: '#0b1418', title: 'Isla Perdida',
    icon: path.join(__dirname, 'icon.png'), show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F12' && input.control && input.shift) win.webContents.toggleDevTools();
  });
  win.webContents.on('did-finish-load', () => { if (current) win.webContents.executeJavaScript(INJECT).catch(() => {}); });
  // Los enlaces externos (página de descargas, GitHub) se abren en el navegador
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('closed', () => { win = null; });
  openLauncher();
}

ipcMain.handle('info', () => ({ version: current || app.getVersion(), app: app.getVersion(), port: srv ? srv.port : null, ips: srv ? server.lanIps() : [], update: updateState }));
ipcMain.handle('versions', (e, force) => listVersions(force));
ipcMain.handle('download', async (e, v) => { try { await download(v); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; } });
ipcMain.handle('remove', (e, v) => {
  const i = installed().find((x) => x.version === v);
  if (!i || i.bundled) return false;
  fs.rmSync(i.dir, { recursive: true, force: true });
  return true;
});
ipcMain.handle('play', (e, v) => play(v));
ipcMain.on('openLauncher', () => openLauncher());
ipcMain.on('openFolder', async () => {
  const dir = versionsDir();
  fs.mkdirSync(dir, { recursive: true });
  const err = await shell.openPath(dir);
  if (err) shell.showItemInFolder(dir);
});
ipcMain.on('openPage', () => shell.openExternal(PAGES));

app.whenReady().then(() => { createWindow(); setupUpdater(); });
app.on('window-all-closed', () => { if (srv) srv.close(); app.quit(); });
