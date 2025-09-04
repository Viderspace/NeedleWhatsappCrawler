const { spawn } = require('child_process');
const { create } = require('@open-wa/wa-automate');
const path = require('path');
const os = require('os');

/**
 * Authenticate with WhatsApp using terminal QR code display
 * This spawns a separate terminal process to show the QR code while
 * keeping the main Electron UI responsive
 */
async function authenticateWhatsApp() {
    return new Promise((resolve, reject) => {
        console.log('🔐 Initializing WhatsApp authentication...');
        
        // Create WhatsApp client with QR code display in terminal
        create({
            sessionId: 'whatsapp-crawler',
            multiDevice: true,
            authTimeout: 60,
            blockCrashLogs: true,
            disableSpins: false,
            headless: false,
            hostNotificationLang: 'PT_BR',
            logConsole: true,
            popup: false, // Disable popup to avoid port conflicts
            qrTimeout: 30,
            restartOnCrash: () => {
                console.log('⚠️ WhatsApp session crashed, attempting restart...');
                return true;
            },
            // Custom QR code handler to display in terminal
            qrLogSkip: false,
            qrRefreshS: 15,
            // Session configuration
            sessionDataPath: path.join(__dirname, '..', '_IGNORE_session'),
            // Fix port conflicts by disabling popup server
            skipBrokenMethodsCheck: true,
            chromiumArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        })
        .then(client => {
            console.log('✅ WhatsApp client authenticated successfully!');
            
            // Set up event handlers for the client
            client.onStateChanged(state => {
                console.log('📱 WhatsApp state:', state);
            });
            
            client.onIncomingCall(call => {
                console.log('📞 Incoming call from:', call.peerJid);
                client.rejectCall(call.id);
            });
            
            // Return the authenticated client
            resolve(client);
        })
        .catch(error => {
            console.error('❌ WhatsApp authentication failed:', error);
            reject(new Error(`Authentication failed: ${error.message}`));
        });
    });
}

/**
 * Alternative method to spawn terminal with QR code
 * This is kept as backup if the above method doesn't work well
 */
function spawnTerminalQR() {
    return new Promise((resolve, reject) => {
        const platform = os.platform();
        let terminalCommand;
        let terminalArgs;
        
        // Determine the appropriate terminal command for each platform
        switch (platform) {
            case 'darwin': // macOS
                terminalCommand = 'osascript';
                terminalArgs = [
                    '-e', 
                    'tell app "Terminal" to do script "echo \\"Please scan the QR code in this terminal\\" && node \\"' + 
                    path.join(__dirname, 'auth-terminal.js') + '\\""'
                ];
                break;
            case 'win32': // Windows
                terminalCommand = 'cmd';
                terminalArgs = ['/c', 'start', 'cmd', '/k', 'node', path.join(__dirname, 'auth-terminal.js')];
                break;
            case 'linux': // Linux
                terminalCommand = 'gnome-terminal';
                terminalArgs = ['--', 'node', path.join(__dirname, 'auth-terminal.js')];
                break;
            default:
                reject(new Error(`Unsupported platform: ${platform}`));
                return;
        }
        
        console.log(`🖥️ Spawning terminal for QR code on ${platform}...`);
        
        const terminalProcess = spawn(terminalCommand, terminalArgs, {
            detached: true,
            stdio: 'ignore'
        });
        
        terminalProcess.unref();
        
        // Wait a moment for terminal to spawn, then resolve
        setTimeout(() => {
            resolve();
        }, 2000);
        
        terminalProcess.on('error', (error) => {
            console.error('❌ Failed to spawn terminal:', error);
            reject(error);
        });
    });
}

/**
 * Close WhatsApp client cleanly
 */
async function closeClient(client) {
    if (client) {
        try {
            await client.close();
            console.log('🧹 WhatsApp client closed successfully');
        } catch (error) {
            console.warn('⚠️ Warning during client cleanup:', error.message);
        }
    }
}

module.exports = {
    authenticateWhatsApp,
    spawnTerminalQR,
    closeClient
};
