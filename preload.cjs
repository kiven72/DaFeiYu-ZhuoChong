const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('petHost', {
  setInteractive: (on) => ipcRenderer.send('pet:interactive', !!on),
  onCursor: (cb) => ipcRenderer.on('pet:cursor', (_e, p) => cb(p)),
  getViewport: () => ipcRenderer.invoke('pet:viewport'),
  getRenderMode: () => ipcRenderer.invoke('pet:render-mode'),
  getAutoStart: () => ipcRenderer.invoke('pet:autostart:get'),
  setAutoStart: (enabled) => ipcRenderer.invoke('pet:autostart:set', enabled),
  onAutoStart: (cb) => ipcRenderer.on('pet:autostart', (_e, state) => cb(state)),
  setBounds: (rect) => ipcRenderer.send('pet:bounds', rect),
  onViewport: (cb) => ipcRenderer.on('pet:viewport', (_e, view) => cb(view)),
  getPrefs: () => ipcRenderer.invoke('pet:prefs'),
  savePrefs: (patch) => ipcRenderer.invoke('pet:save', patch),
  onPrefs: (cb) => ipcRenderer.on('pet:prefs', (_e, p) => cb(p)),
  openDress: () => ipcRenderer.send('pet:dress'),
  hide: () => ipcRenderer.send('pet:hide'),
  quit: () => ipcRenderer.send('pet:quit'),
});
