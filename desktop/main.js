// App de escritorio de Isla Perdida (Electron):
// - arranca el servidor LAN integrado (así el anfitrión no necesita Python)
// - abre el juego en una ventana propia (F11: pantalla completa)
// - busca actualizaciones publicadas en GitHub y ofrece instalarlas
'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const server = require('./server');

let win = null, srv = null, updateState = { state: 'idle' };
const ROOT = path.join(__dirname, '..');

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

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
  autoUpdater.on('update-downloaded', async (i) => {
    sendUpdate({ state: 'ready', version: i.version });
    const r = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['Reiniciar y actualizar', 'Más tarde'], defaultId: 0, cancelId: 1,
      title: 'Actualización lista', message: `La versión ${i.version} de Isla Perdida está lista.`,
      detail: 'Se instalará al reiniciar el juego. Tu partida guardada se conserva.',
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  ipcMain.on('checkUpdates', () => autoUpdater.checkForUpdates().catch(() => sendUpdate({ state: 'error' })));
  ipcMain.on('installUpdate', () => autoUpdater.quitAndInstall());
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => sendUpdate({ state: 'error' })), 4000);
}

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
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F12' && input.control && input.shift) win.webContents.toggleDevTools();
  });
  // Los enlaces externos (página de descargas, GitHub) se abren en el navegador
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  const url = srv ? `http://localhost:${srv.port}/` : `file://${path.join(ROOT, 'index.html')}`;
  win.loadURL(url);
  win.on('closed', () => { win = null; });
}

ipcMain.handle('info', () => ({ version: app.getVersion(), port: srv ? srv.port : null, ips: srv ? server.lanIps() : [], update: updateState }));

app.whenReady().then(() => { createWindow(); setupUpdater(); });
app.on('window-all-closed', () => { if (srv) srv.close(); app.quit(); });
