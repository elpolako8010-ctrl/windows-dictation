const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picoClaw', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  onHotkeyToggle: (callback) => {
    ipcRenderer.removeAllListeners('hotkey-toggle');
    ipcRenderer.on('hotkey-toggle', () => callback());
  },
  completeDictation: (payload) => ipcRenderer.invoke('dictation:complete', payload),
  showApp: () => ipcRenderer.invoke('app:show'),
  openLink: (url) => ipcRenderer.invoke('link:open', url)
});
