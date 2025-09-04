const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Authentication
    startAuth: () => ipcRenderer.invoke('start-auth'),
    
    // Groups
    getGroups: () => ipcRenderer.invoke('get-groups'),
    
    // Crawling
    startCrawl: (groupIds) => ipcRenderer.invoke('start-crawl', groupIds),
    
    // Export management
    showExports: () => ipcRenderer.invoke('show-exports'),
    getExportFiles: () => ipcRenderer.invoke('get-export-files'),
    
    // UI helpers
    showError: (title, message) => ipcRenderer.invoke('show-error', title, message),
    exitApp: () => ipcRenderer.invoke('exit-app'),
    
    // Event listeners for real-time updates
    onAuthStatus: (callback) => {
        ipcRenderer.on('auth-status', (event, message) => callback(message));
    },
    
    onProgressUpdate: (callback) => {
        ipcRenderer.on('progress-update', (event, message) => callback(message));
    },
    
    onCrawlProgress: (callback) => {
        ipcRenderer.on('crawl-progress', (event, data) => callback(data));
    },
    
    // Remove listeners (cleanup)
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
