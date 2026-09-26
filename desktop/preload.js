// Puente seguro entre la app de escritorio y el juego (window.islaDesktop)
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('islaDesktop', {
  info: () => ipcRenderer.invoke('info'),
  onUpdate: (cb) => ipcRenderer.on('update', (e, s) => cb(s)),
  checkUpdates: () => ipcRenderer.send('checkUpdates'),
  installUpdate: () => ipcRenderer.send('installUpdate'),
  onReady: () => {},
});
