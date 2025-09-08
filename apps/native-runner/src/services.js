// services.js
// This module bridges the existing crawl/export logic with the native runner
// Provides listChats() and exportChats() functions that reuse project code

const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { create } = require('@open-wa/wa-automate');

// Import existing modules from the root project
const { hebrewifyIfNeeded } = require('../common');
const { findGroup, loadAllMessages } = require('../waClient');
const { writeExportFile } = require('../exporter');
const { filterParticipants } = require('../participants');
const { enrichMessages, analyzeMessageWordCounts } = require('../enrichment');

// Configuration
function getExportDir() {
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    const whatsappDataPath = path.join(downloadsPath, 'WhatsApp Data');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(whatsappDataPath)) {
        fs.mkdirSync(whatsappDataPath, { recursive: true });
    }
    
    return whatsappDataPath;
}

const MAX_MESSAGES = 5000;

// Global client instance
let waClient = null;

/**
 * Bring the wa-automate browser window to front on macOS
 */
function focusWhatsAppWindow() {
    if (process.platform === 'darwin') {
        // Try Chrome first, then fallback to any browser with WhatsApp Web
        const tryFocusChrome = () => {
            const chromeScript = `
                tell application "Google Chrome"
                    repeat with w in windows
                        repeat with t in tabs of w
                            if URL of t contains "web.whatsapp.com" then
                                set active tab index of w to index of t
                                set index of w to 1
                                activate
                                return true
                            end if
                        end repeat
                    end repeat
                    return false
                end tell
            `;
            
            exec(`osascript -e '${chromeScript}'`, (error, stdout, stderr) => {
                if (error || !stdout.trim()) {
                    // Chrome didn't work, try generic approach
                    tryFocusGeneric();
                } else {
                    console.log('🔍 Chrome WhatsApp window brought to front');
                }
            });
        };
        
        const tryFocusGeneric = () => {
            // Fallback: Use System Events to find any window with "WhatsApp" in title
            const genericScript = `
                tell application "System Events"
                    set whatsappWindows to every window of every process whose name contains "WhatsApp" or title contains "WhatsApp"
                    if length of whatsappWindows > 0 then
                        set frontmost of first process of whatsappWindows to true
                        return true
                    end if
                    return false
                end tell
            `;
            
            exec(`osascript -e '${genericScript}'`, (error, stdout, stderr) => {
                if (error) {
                    console.log('⚠️ Could not focus WhatsApp window with any method');
                } else {
                    console.log('🔍 WhatsApp window brought to front (generic method)');
                }
            });
        };
        
        // Start with Chrome
        tryFocusChrome();
    }
}

/**
 * Set up sync monitoring events for WhatsApp client
 * @param {Object} client - WhatsApp client instance
 */
// File-system based sync detection state
let globalSyncState = {
    isSyncing: false,
    syncStartTime: null,
    lastSyncDuration: null,
    status: 'unknown',
    lastUpdated: Date.now()
};

// File monitoring for sync detection
let sessionDirMonitor = {
    interval: null,
    lastSize: 0,
    lastModified: 0,
    stableCount: 0,
    isMonitoring: false
};

/**
 * Get the size and modification time of the WhatsApp session directory
 */
function getSessionDirStats() {
    try {
        const sessionDir = path.join(os.homedir(), '.wwebjs_auth', 'session-needle-crawler');
        
        if (!fs.existsSync(sessionDir)) {
            return { size: 0, modified: 0 };
        }
        
        let totalSize = 0;
        let lastModified = 0;
        
        function walkDir(dir) {
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isDirectory()) {
                        walkDir(filePath);
                    } else {
                        totalSize += stats.size;
                        lastModified = Math.max(lastModified, stats.mtime.getTime());
                    }
                }
            } catch (error) {
                // Ignore permission errors or missing files
            }
        }
        
        walkDir(sessionDir);
        return { size: totalSize, modified: lastModified };
    } catch (error) {
        return { size: 0, modified: 0 };
    }
}

/**
 * Start monitoring the session directory for changes
 */
function startSessionMonitoring() {
    if (sessionDirMonitor.isMonitoring) return;
    
    console.log('🔧 Starting file-system based sync monitoring...');
    sessionDirMonitor.isMonitoring = true;
    
    // Get initial stats
    const initialStats = getSessionDirStats();
    sessionDirMonitor.lastSize = initialStats.size;
    sessionDirMonitor.lastModified = initialStats.modified;
    sessionDirMonitor.stableCount = 0;
    
    sessionDirMonitor.interval = setInterval(() => {
        const currentStats = getSessionDirStats();
        const sizeChanged = Math.abs(currentStats.size - sessionDirMonitor.lastSize) > 1024; // 1KB threshold
        const modifiedChanged = currentStats.modified > sessionDirMonitor.lastModified;
        
        if (sizeChanged || modifiedChanged) {
            // Directory is changing - WhatsApp is likely syncing
            if (!globalSyncState.isSyncing) {
                console.log('🔄 WhatsApp sync detected (session directory changing)...');
                globalSyncState.isSyncing = true;
                globalSyncState.syncStartTime = Date.now();
                globalSyncState.status = 'syncing';
                globalSyncState.lastUpdated = Date.now();
            }
            
            sessionDirMonitor.lastSize = currentStats.size;
            sessionDirMonitor.lastModified = currentStats.modified;
            sessionDirMonitor.stableCount = 0;
        } else {
            // Directory is stable
            sessionDirMonitor.stableCount++;
            
            // If it's been stable for 10 checks (20 seconds) and was syncing, sync is done
            if (globalSyncState.isSyncing && sessionDirMonitor.stableCount >= 10) {
                const syncDuration = ((Date.now() - globalSyncState.syncStartTime) / 1000).toFixed(1);
                console.log(`✅ WhatsApp sync completed (directory stable after ${syncDuration}s)`);
                globalSyncState.isSyncing = false;
                globalSyncState.syncStartTime = null;
                globalSyncState.lastSyncDuration = parseFloat(syncDuration);
                globalSyncState.status = 'connected';
                globalSyncState.lastUpdated = Date.now();
                sessionDirMonitor.stableCount = 0;
            }
        }
    }, 2000); // Check every 2 seconds
}

/**
 * Stop monitoring the session directory
 */
function stopSessionMonitoring() {
    if (sessionDirMonitor.interval) {
        clearInterval(sessionDirMonitor.interval);
        sessionDirMonitor.interval = null;
    }
    sessionDirMonitor.isMonitoring = false;
    console.log('🔧 Stopped file-system based sync monitoring');
}

function setupSyncMonitoring(client) {
    console.log('🔧 Setting up connection monitoring with file-system sync detection...');
    
    // Monitor state changes for basic connection status
    client.onStateChanged((state) => {
        console.log(`📱 WhatsApp state changed: ${state}`);
        
        switch (state) {
            case 'CONNECTED':
                console.log('✅ WhatsApp connected and ready');
                globalSyncState.status = 'connected';
                globalSyncState.lastUpdated = Date.now();
                // Start monitoring session directory for sync activity
                startSessionMonitoring();
                break;
                
            case 'UNPAIRED':
                console.log('🔓 WhatsApp session logged out - please scan QR code again');
                globalSyncState.status = 'unpaired';
                globalSyncState.lastUpdated = Date.now();
                // Stop monitoring when disconnected
                stopSessionMonitoring();
                break;
                
            case 'PAIRING':
                console.log('📲 WhatsApp pairing in progress...');
                globalSyncState.status = 'pairing';
                globalSyncState.lastUpdated = Date.now();
                // Stop monitoring during pairing
                stopSessionMonitoring();
                break;
                
            case 'CONFLICT':
                console.log('⚠️ WhatsApp session conflict - attempting to refocus...');
                globalSyncState.status = 'conflict';
                globalSyncState.lastUpdated = Date.now();
                // Try to refocus if there's a conflict
                setTimeout(() => {
                    try {
                        client.forceRefocus();
                        console.log('🔍 Attempted to refocus WhatsApp session');
                    } catch (error) {
                        console.log('⚠️ Could not refocus session:', error.message);
                    }
                }, 1000);
                break;
                
            default:
                console.log(`📱 WhatsApp state: ${state}`);
                if (globalSyncState.status === 'unknown') {
                    globalSyncState.status = 'initializing';
                    globalSyncState.lastUpdated = Date.now();
                }
        }
    });
}

/**
 * Initialize WhatsApp client if not already connected
 * @returns {Promise<Object>} WhatsApp client instance
 */
async function getClient() {
    if (!waClient) {
        console.log('🔄 Initializing WhatsApp client...');
        waClient = await create({
            sessionId: 'needle-crawler',
            headless: false,
            qrTimeout: 0,
            authTimeout: 0,
            blockCrashLogs: true,
            disableSpins: true,
            hostNotificationLang: 'PT_BR',
            logConsole: false,
            popup: false, // Disable popup to avoid port conflicts
            restartOnCrash: getClient,
        });
        console.log('✅ WhatsApp client initialized');
        
        // Set up sync monitoring events
        setupSyncMonitoring(waClient);
        
        // Focus the WhatsApp window after a short delay
        setTimeout(() => {
            focusWhatsAppWindow();
        }, 2000);
    }
    return waClient;
}

/**
 * List all available chats with their IDs and titles
 * @param {Function} progressCallback - Optional callback for progressive loading updates
 * @returns {Promise<Array>} Array of {id, title, type, messageCount} objects
 */
async function listChats(progressCallback = null) {
    try {
        console.log('📋 Fetching chat list...');
        const client = await getClient();
        
        // Get all groups (this is working based on logs)
        const groups = await client.getAllGroups();
        console.log(`📋 Found ${groups.length} groups`);
        
        // Format the response - start with groups only for now
        const result = [];
        
        // Add groups with participant counts (progressive loading)
        if (groups && Array.isArray(groups)) {
            const totalGroups = groups.length;
            
            // First, process all groups to get their data (without progressive updates)
            const groupDataArray = [];
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                let participantCount = 0;
                
                // Try to get participant count from group metadata
                try {
                    if (group.groupMetadata && group.groupMetadata.participants) {
                        participantCount = group.groupMetadata.participants.length;
                    } else if (group.participants) {
                        participantCount = group.participants.length;
                    } else {
                        // Fallback: try to get group members directly
                        const members = await client.getGroupMembers(group.id).catch(() => []);
                        participantCount = members.length;
                    }
                } catch (error) {
                    // If we can't get participant count, estimate based on available data
                    participantCount = 1; // At least the user themselves
                }
                
                // Check message count to determine if group is active
                let messageCount = 0;
                let isActive = true;
                
                try {
                    // Quick message count check - get a small sample to estimate
                    const sampleMessages = await client.loadEarlierMessages(group.id).catch(() => []);
                    if (sampleMessages && Array.isArray(sampleMessages)) {
                        messageCount = sampleMessages.length;
                        
                        // If we got less than 3 messages, mark as unloaded
                        if (messageCount < 3) {
                            isActive = false;
                            console.log(`⚠️ Group "${group.name}" has only ${messageCount} messages - marking as unloaded`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Could not check message count for group "${group.name}": ${error.message}`);
                    isActive = false; // Mark as inactive if we can't check
                }
                
                const groupData = {
                    id: group.id,
                    title: group.name || 'Unknown Group', // Don't reverse Hebrew, let CSS handle direction
                    type: 'group',
                    participantCount: participantCount,
                    messageCount: messageCount,
                    isActive: isActive,
                    inactiveReason: !isActive ? (messageCount < 3 ? 'Unloaded - insufficient message history' : 'Unable to load messages') : null,
                    hasManyMessages: messageCount >= 50
                };
                
                groupDataArray.push(groupData);
            }
            
            // Sort by active status (primary) and member count (secondary) BEFORE progressive loading
            groupDataArray.sort((a, b) => {
                // Primary sort: active groups first
                if (a.isActive !== b.isActive) {
                    return a.isActive ? -1 : 1; // true (active) comes before false (inactive)
                }
                
                // Secondary sort: member count descending (highest first)
                return (b.participantCount || 0) - (a.participantCount || 0);
            });
            
            // Now send groups in the correct sorted order via progressive loading
            for (let i = 0; i < groupDataArray.length; i++) {
                const groupData = groupDataArray[i];
                result.push(groupData);
                
                // Send progressive update
                if (progressCallback) {
                    progressCallback({
                        type: 'group-loaded',
                        group: groupData,
                        current: i + 1,
                        total: totalGroups,
                        percentage: Math.round(((i + 1) / totalGroups) * 100)
                    });
                }
            }
        }
        
        // Try to get all chats (this might be the problematic call)
        try {
            const chats = await client.getAllChats();
            console.log(`💬 Found ${chats ? chats.length : 0} total chats`);
            
            // Add individual chats (filter out groups)
            if (chats && Array.isArray(chats)) {
                for (const chat of chats) {
                    if (!chat.isGroup && chat.contact) {
                        result.push({
                            id: chat.id,
                            title: chat.contact.pushname || chat.contact.formattedName || chat.contact.shortName || 'Unknown Contact',
                            type: 'individual',
                            participantCount: 2,
                            messageCount: 0 // Simplified for now
                        });
                    }
                }
            }
        } catch (chatsError) {
            console.log(`⚠️ Could not get individual chats: ${chatsError.message}`);
            // Continue with just groups
        }
        
        // Sort groups by member count (descending order)
        result.sort((a, b) => {
            if (a.type === 'group' && b.type === 'group') {
                return b.participantCount - a.participantCount;
            }
            // Keep groups before individual chats
            if (a.type === 'group' && b.type === 'individual') return -1;
            if (a.type === 'individual' && b.type === 'group') return 1;
            return 0;
        });
        
        // Send completion callback
        if (progressCallback) {
            progressCallback({
                type: 'loading-complete',
                groups: result,
                total: result.length
            });
        }
        
        // Groups are already sorted by active status and member count before progressive loading
        const activeCount = result.filter(r => r.isActive !== false).length;
        const inactiveCount = result.filter(r => r.isActive === false).length;
        
        console.log(`✅ Listed ${result.length} chats (${groups.length} groups, ${result.length - groups.length} individual)`);
        console.log(`📊 Active: ${activeCount}, Inactive: ${inactiveCount} - sorted by active status and member count`);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error listing chats:', error);
        throw new Error(`Failed to list chats: ${error.message}`);
    }
}

/**
 * Export messages from specified chats to JSON files
 * @param {Array<string>} chatIds - Array of chat IDs to export
 * @returns {Promise<Array>} Array of export results
 */
async function exportChats(chatIds) {
    if (!Array.isArray(chatIds) || chatIds.length === 0) {
        throw new Error('chatIds must be a non-empty array');
    }
    
    try {
        console.log(`📦 Starting export for ${chatIds.length} chats...`);
        const client = await getClient();
        const results = [];
        
        for (const chatId of chatIds) {
            try {
                console.log(`\n🔍 Processing chat: ${chatId}`);
                
                // Get chat info
                const chatInfo = await client.getChatById(chatId);
                const chatName = chatInfo.isGroup 
                    ? (chatInfo.name || 'Unknown Group')
                    : (chatInfo.contact?.pushname || chatInfo.contact?.formattedName || 'Unknown Contact');
                
                console.log(`📂 Chat name: ${chatName}`);
                
                // Load messages
                console.log(`📥 Loading messages for ${chatName}...`);
                const messages = await loadAllMessages(client, chatId, MAX_MESSAGES);
                console.log(`📨 Loaded ${messages.length} messages`);
                
                if (messages.length === 0) {
                    console.log(`⚠️ No messages found for ${chatName}, skipping export`);
                    results.push({
                        chatId,
                        chatName,
                        success: false,
                        error: 'No messages found',
                        messageCount: 0,
                        filePath: null
                    });
                    continue;
                }
                
                // Get participants (for groups)
                let participants = [];
                if (chatInfo.isGroup) {
                    participants = await client.getGroupMembers(chatId);
                    participants = filterParticipants(participants);
                    console.log(`👥 Found ${participants.length} participants`);
                }
                
                // Enrich messages
                console.log(`🔧 Enriching messages...`);
                const enriched = enrichMessages(messages, participants);
                
                // Analyze word counts (optional, for logging)
                analyzeMessageWordCounts(enriched);
                
                // Prepare export data (same format as existing crawler)
                const exportData = {
                    chatInfo: {
                        id: chatId,
                        name: chatName,
                        type: chatInfo.isGroup ? 'group' : 'individual',
                        exportedAt: new Date().toISOString(),
                        messageCount: enriched.length,
                        participantCount: participants.length
                    },
                    messages: enriched,
                    participants
                };
                
                // Write to file
                console.log(`💾 Writing export file...`);
                const exportDir = getExportDir();
                writeExportFile(exportData, chatName, exportDir);
                
                // Calculate file path - keep original Hebrew text for filename
                const sanitizeFilename = (name) => name.replace(/[\/\\?%*:|"<>]/g, '-');
                const filename = sanitizeFilename(chatName) + '.json';
                const filePath = path.join(exportDir, filename);
                
                results.push({
                    chatId,
                    chatName,
                    success: true,
                    messageCount: enriched.length,
                    participantCount: participants.length,
                    filePath
                });
                
                console.log(`✅ Successfully exported ${chatName}`);
                
            } catch (chatError) {
                console.error(`❌ Error exporting chat ${chatId}:`, chatError);
                results.push({
                    chatId,
                    chatName: 'Unknown',
                    success: false,
                    error: chatError.message,
                    messageCount: 0,
                    filePath: null
                });
            }
        }
        
        console.log(`\n🎉 Export complete! ${results.filter(r => r.success).length}/${results.length} chats exported successfully`);
        return results;
        
    } catch (error) {
        console.error('❌ Error during export:', error);
        throw new Error(`Export failed: ${error.message}`);
    }
}

/**
 * Close the WhatsApp client connection
 */
async function closeClient() {
    if (waClient) {
        try {
            // Stop file monitoring
            stopSessionMonitoring();
            
            await waClient.kill();
            waClient = null;
            console.log('🔌 WhatsApp client disconnected');
        } catch (error) {
            console.error('❌ Error closing client:', error);
        }
    }
}

/**
 * Get current sync status for API endpoints
 * @returns {Object} Current sync state
 */
function getSyncStatus() {
    const currentTime = Date.now();
    const result = { ...globalSyncState };
    
    // Calculate current sync duration if syncing
    if (result.isSyncing && result.syncStartTime) {
        result.currentSyncDuration = ((currentTime - result.syncStartTime) / 1000).toFixed(1);
    }
    
    return result;
}

module.exports = {
    listChats,
    exportChats,
    closeClient,
    getClient, // For advanced usage
    focusWhatsAppWindow, // For manual focus
    getSyncStatus // For sync status API
};
