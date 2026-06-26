const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setFileAssociations: (browser) => ipcRenderer.invoke('set-file-associations', browser),
  getCurrentAssociations: () => ipcRenderer.invoke('get-current-associations'),
  openBrowserSettings: (browser) => ipcRenderer.invoke('open-browser-settings', browser),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getBluetoothDevices: () => ipcRenderer.invoke('get-bluetooth-devices'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  isDesktop: true,
});
