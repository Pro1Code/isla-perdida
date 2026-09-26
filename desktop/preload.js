// Puente seguro entre la app de escritorio, el lanzador y el juego (window.islaDesktop)
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('islaDesktop', {
  info: () => ipcRenderer.invoke('info'),
  onUpdate: (cb) => ipcRenderer.on('update', (e, s) => cb(s)),
  checkUpdates: () => ipcRenderer.send('checkUpdates'),
  installUpdate: () => ipcRenderer.send('installUpdate'),
  onReady: () => {},
  // Lanzador de versiones
  versions: (force) => ipcRenderer.invoke('versions', !!force),
  download: (v) => ipcRenderer.invoke('download', v),
  onProgress: (cb) => ipcRenderer.on('dl-progress', (e, p) => cb(p)),
  remove: (v) => ipcRenderer.invoke('remove', v),
  play: (v) => ipcRenderer.invoke('play', v),
  openLauncher: () => ipcRenderer.send('openLauncher'),
  openFolder: () => ipcRenderer.send('openFolder'),
  openPage: () => ipcRenderer.send('openPage'),
});
