const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import backend modules
const { authenticateWhatsApp } = require('./backend/auth-process');
const { getGroups, runCrawler } = require('./backend/crawl-service');

let mainWindow;
let authenticatedClient = null;
let cachedGroups = null; // Cache groups to avoid redundant loading

// Helper function to get consistent export path
function getExportPath() {
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    return path.join(downloadsPath, 'WhatsApp Data Collection');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'), // Optional: add app icon
        titleBarStyle: 'default',
        show: false // Don't show until ready
    });

    mainWindow.loadFile('renderer/index.html');

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open dev tools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers for communication with renderer process

/**
 * Handle WhatsApp authentication
 */
ipcMain.handle('start-auth', async () => {
    try {
        console.log('🔐 Starting WhatsApp authentication...');
        
        // Show progress to user
        mainWindow.webContents.send('auth-status', 'Starting authentication...');
        
        const client = await authenticateWhatsApp();
        authenticatedClient = client;
        
        console.log('✅ Authentication successful');
        mainWindow.webContents.send('auth-status', 'Authentication successful!');
        
        return { success: true, message: 'Authentication completed successfully' };
    } catch (error) {
        console.error('❌ Authentication failed:', error);
        mainWindow.webContents.send('auth-status', `Authentication failed: ${error.message}`);
        
        return { 
            success: false, 
            message: `Authentication failed: ${error.message}` 
        };
    }
});

/**
 * Get available WhatsApp groups (with caching and progressive loading)
 */
ipcMain.handle('get-groups', async () => {
    try {
        if (!authenticatedClient) {
            throw new Error('Not authenticated. Please authenticate first.');
        }
        
        // Use cached groups if available
        if (cachedGroups) {
            console.log(`📋 Using cached groups (${cachedGroups.length} groups)`);
            return { success: true, groups: cachedGroups };
        }
        
        console.log('📋 Fetching WhatsApp groups...');
        mainWindow.webContents.send('progress-update', 'Loading groups...');
        
        // Set up progressive loading callback
        const progressCallback = (message, current, total, groupData = null) => {
            // Send progress update
            mainWindow.webContents.send('group-loading-progress', {
                message,
                current,
                total,
                percentage: total > 0 ? Math.round((current / total) * 100) : 0
            });
            
            // If we have group data, send it immediately for progressive display
            if (groupData) {
                mainWindow.webContents.send('group-loaded', groupData);
            }
        };
        
        const groups = await getGroups(authenticatedClient, progressCallback);
        cachedGroups = groups; // Cache for future use
        
        console.log(`✅ Found ${groups.length} groups (cached for future use)`);
        
        // Send final sorted groups
        mainWindow.webContents.send('groups-loading-complete', groups);
        
        return { success: true, groups };
    } catch (error) {
        console.error('❌ Failed to get groups:', error);
        return { 
            success: false, 
            message: `Failed to get groups: ${error.message}` 
        };
    }
});

/**
 * Start crawling selected groups
 */
ipcMain.handle('start-crawl', async (event, selectedGroupIds) => {
    try {
        if (!authenticatedClient) {
            throw new Error('Not authenticated. Please authenticate first.');
        }
        
        if (!selectedGroupIds || selectedGroupIds.length === 0) {
            throw new Error('No groups selected');
        }
        
        console.log(`🚀 Starting crawl for ${selectedGroupIds.length} groups...`);
        
        // Set up progress callback
        const progressCallback = (message, current, total) => {
            mainWindow.webContents.send('crawl-progress', {
                message,
                current,
                total,
                percentage: total > 0 ? Math.round((current / total) * 100) : 0
            });
        };
        
        const results = await runCrawler(authenticatedClient, selectedGroupIds, progressCallback, cachedGroups);
        
        console.log('✅ Crawl completed successfully');
        return { success: true, results };
    } catch (error) {
        console.error('❌ Crawl failed:', error);
        return { 
            success: false, 
            message: `Crawl failed: ${error.message}` 
        };
    }
});

/**
 * Show export folder in file explorer
 */
ipcMain.handle('show-exports', async () => {
    try {
        const exportsPath = getExportPath();
        
        // Ensure exports directory exists
        if (!fs.existsSync(exportsPath)) {
            fs.mkdirSync(exportsPath, { recursive: true });
        }
        
        // Open the exports folder
        shell.showItemInFolder(exportsPath);
        
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to show exports:', error);
        return { 
            success: false, 
            message: `Failed to open exports folder: ${error.message}` 
        };
    }
});

/**
 * Get list of exported files
 */
ipcMain.handle('get-export-files', async () => {
    try {
        const exportsPath = getExportPath();
        
        if (!fs.existsSync(exportsPath)) {
            return { success: true, files: [] };
        }
        
        const files = fs.readdirSync(exportsPath)
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const filePath = path.join(exportsPath, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                    path: filePath
                };
            })
            .sort((a, b) => b.modified - a.modified); // Sort by most recent
        
        return { success: true, files };
    } catch (error) {
        console.error('❌ Failed to get export files:', error);
        return { 
            success: false, 
            message: `Failed to get export files: ${error.message}` 
        };
    }
});

/**
 * Show error dialog
 */
ipcMain.handle('show-error', async (event, title, message) => {
    dialog.showErrorBox(title, message);
});

/**
 * Exit application
 */
ipcMain.handle('exit-app', async () => {
    app.quit();
});

// Handle app exit cleanup
app.on('before-quit', () => {
    if (authenticatedClient) {
        console.log('🧹 Cleaning up WhatsApp client...');
        try {
            authenticatedClient.close?.();
        } catch (error) {
            console.warn('⚠️ Warning during client cleanup:', error.message);
        }
    }
});
