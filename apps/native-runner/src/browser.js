const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Get the user data directory for the application based on OS
 */
function getUserDataDir() {
  const platform = os.platform();
  let baseDir;
  
  if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/NeedleWAC
    baseDir = path.join(os.homedir(), 'Library', 'Application Support', 'NeedleWAC');
  } else if (platform === 'win32') {
    // Windows: %APPDATA%\NeedleWAC
    baseDir = path.join(process.env.APPDATA || os.homedir(), 'NeedleWAC');
  } else {
    // Linux/other: ~/.config/NeedleWAC
    baseDir = path.join(os.homedir(), '.config', 'NeedleWAC');
  }
  
  // Ensure directory exists
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  return baseDir;
}

/**
 * Get the browser executable path based on OS and available browsers
 */
function getBrowserExecutablePath() {
  const platform = os.platform();
  
  // Check environment variable first
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  let possiblePaths = [];
  
  if (platform === 'darwin') {
    // macOS - prefer Chrome
    possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
  } else if (platform === 'win32') {
    // Windows - prefer Edge
    possiblePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
    ];
  } else {
    // Linux
    possiblePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    ];
  }
  
  // Find the first existing executable
  for (const execPath of possiblePaths) {
    if (fs.existsSync(execPath)) {
      return execPath;
    }
  }
  
  throw new Error(`No supported browser found. Checked paths: ${possiblePaths.join(', ')}`);
}

/**
 * Get browser channel based on OS
 */
function getBrowserChannel() {
  const platform = os.platform();
  
  if (platform === 'win32') {
    return 'msedge';
  } else if (platform === 'darwin') {
    return 'chrome';
  } else {
    return 'chrome'; // Default for Linux
  }
}

/**
 * Open a URL in the system browser with session persistence
 * @param {string} url - The URL to open
 * @returns {Promise<void>}
 */
async function openUrl(url) {
  console.log(`Opening URL: ${url}`);
  
  // For WhatsApp Web, use Chrome with persistent user data directory
  if (url.includes('web.whatsapp.com')) {
    console.log('Opening WhatsApp Web with session persistence...');
    await openWhatsAppWithPersistence(url);
  } else {
    console.log('Opening URL with system command...');
    await openUrlWithSystemCommand(url);
  }
}

/**
 * Open WhatsApp Web with persistent session using Chrome
 * @param {string} url - The WhatsApp Web URL
 * @returns {Promise<void>}
 */
async function openWhatsAppWithPersistence(url) {
  const userDataDir = getUserDataDir();
  const platform = require('os').platform();
  
  let chromePath;
  if (platform === 'darwin') {
    chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else if (platform === 'win32') {
    chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (!require('fs').existsSync(chromePath)) {
      chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
    }
  } else {
    chromePath = '/usr/bin/google-chrome';
  }
  
  // Check if Chrome exists
  if (!require('fs').existsSync(chromePath)) {
    console.log('Chrome not found at expected path, falling back to system open');
    await openUrlWithSystemCommand(url);
    return;
  }
  
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    
    const args = [
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      url
    ];
    
    console.log(`Executing: ${chromePath} ${args.join(' ')}`);
    
    const chromeProcess = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore'
    });
    
    chromeProcess.unref(); // Allow the parent process to exit independently
    
    // Give Chrome a moment to start
    setTimeout(() => {
      console.log(`Successfully opened WhatsApp Web with persistent session: ${url}`);
      resolve();
    }, 1000);
    
    chromeProcess.on('error', (error) => {
      console.log(`Chrome launch failed, falling back to system open: ${error.message}`);
      openUrlWithSystemCommand(url).then(resolve).catch(reject);
    });
  });
}

/**
 * Open URL using system command
 * @param {string} url - The URL to open
 * @returns {Promise<void>}
 */
function openUrlWithSystemCommand(url) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const platform = require('os').platform();
    
    let command;
    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }
    
    console.log(`Executing system command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`System open command failed: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Clear the user data directory to force a fresh WhatsApp login
 * @returns {Promise<void>}
 */
async function clearSession() {
  const userDataDir = getUserDataDir();
  
  console.log(`Clearing session data from: ${userDataDir}`);
  
  try {
    // Remove the entire user data directory
    if (fs.existsSync(userDataDir)) {
      await fs.promises.rm(userDataDir, { recursive: true, force: true });
      console.log('Session data cleared successfully');
    } else {
      console.log('No session data to clear');
    }
    
    // Recreate the directory
    await fs.promises.mkdir(userDataDir, { recursive: true });
    console.log('Fresh user data directory created');
    
  } catch (error) {
    console.error('Error clearing session:', error);
    throw new Error(`Failed to clear session: ${error.message}`);
  }
}

module.exports = {
  openUrl,
  getUserDataDir,
  clearSession
};
