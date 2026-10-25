// window.MistCard for the card and the main window: the view in; the card's height and buttons, the History and Catalog
// data, and the main window's actions and settings out.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('MistCard', {
  onView: (cb) => ipcRenderer.on('view', (e, v) => cb(v)),
  height: (h) => ipcRenderer.send('card:height', h),
  hide: () => ipcRenderer.send('card:hide'),
  fold: (folded) => ipcRenderer.send('card:fold', !!folded),
  setting: (key, value) => ipcRenderer.send('card:setting', String(key), !!value),
  history: () => ipcRenderer.invoke('history:list'),
  run: (runId) => ipcRenderer.invoke('history:run', String(runId)),
  catalog: () => ipcRenderer.invoke('catalog:get'),
  openMain: () => ipcRenderer.send('main:open'),
  toggleCard: () => ipcRenderer.send('card:toggle'),
  chooseLog: () => ipcRenderer.send('log:choose'),
  autoLog: () => ipcRenderer.send('log:auto'),
  getPolicy: () => ipcRenderer.invoke('policy:get'),
  setPolicy: (p) => ipcRenderer.invoke('policy:set', p),
});
