const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Navigation
  navigate: (path) => ipcRenderer.send('navigate', path),
  onNavigate: (callback) => ipcRenderer.on('navigate', callback),
  
  // Print
  print: () => ipcRenderer.send('print'),
  
  // App info
  getVersion: () => process.env.npm_package_version || '1.0.0',
  getPlatform: () => process.platform,
  
  // Check if running in Electron
  isElectron: true,
  
  // Splash screen controls
  retry: () => ipcRenderer.send('app-retry'),
  quit: () => ipcRenderer.send('app-quit'),
  onError: (callback) => ipcRenderer.on('show-error', (event, data) => callback(data)),
  onStatus: (callback) => ipcRenderer.on('update-status', (event, message) => callback(message)),
});

