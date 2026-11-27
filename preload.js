const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pjDesktop', {
  status: cb => ipcRenderer.on('status', (_e, s) => cb(s)),
  mode: cb => ipcRenderer.on('mode', (_e, m) => cb(m)),
  open: url => ipcRenderer.send('open', url),
  setGames: list => ipcRenderer.send('games', list)
});
