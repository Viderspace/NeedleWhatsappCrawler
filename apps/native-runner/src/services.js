// services.js
// This module bridges the existing crawl/export logic with the native runner
// Provides listChats() and exportChats() functions that reuse project code

const path = require('path');
const fs = require('fs');
const os = require('os');
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

// Simple sync state tracking
let syncState = {
    isComplete: false,
    messageCount: 0,
    status: 'initializing'
};

/**
 * Wait for WhatsApp messages to finish loading with simple time-based approach
 * @param {Object} client - WhatsApp client instance
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<boolean>} - Resolves when sync is complete
 */
async function waitForMessageSync(client, onProgress = null) {
    console.log('🔄 Waiting for WhatsApp messages to finish loading...');
    
    let attempts = 0;
    let isInitialOnboarding = null;
    let syncPhase = 'detecting';
    let waitDuration = 0;
    let maxAttempts = 0;
    
    return new Promise((resolve, reject) => {
        const syncCheck = setInterval(async () => {
            attempts++;
            
            try {
                // Detect sync type on first attempt
                if (isInitialOnboarding === null) {
                    const groups = await client.getAllGroups().catch(() => []);
                    
                    if (!groups || groups.length === 0) {
                        console.log(`📊 No groups available yet - waiting... (attempt ${attempts})`);
                        return;
                    }
                    
                    // Quick check to detect initial onboarding
                    const testGroups = groups.slice(0, Math.min(3, groups.length));
                    let groupsWithMessages = 0;
                    
                    for (const group of testGroups) {
                        try {
                            const messages = await client.loadEarlierMessages(group.id).catch(() => []);
                            if (messages && messages.length > 0) {
                                groupsWithMessages++;
                            }
                        } catch (error) {
                            // Ignore errors during detection
                        }
                    }
                    
                    isInitialOnboarding = groupsWithMessages === 0;
                    
                    if (isInitialOnboarding) {
                        syncPhase = 'initial';
                        waitDuration = 120; // 120 seconds for initial onboarding
                        maxAttempts = 24; // 18 * 5 seconds = 90 seconds
                        console.log(`🆕 Detected initial onboarding - waiting ${waitDuration}s for sync`);
                    } else {
                        syncPhase = 'normal';
                        waitDuration = 15; // 25 seconds for normal reconnection
                        maxAttempts = 3; // 5 * 5 seconds = 25 seconds
                        console.log(`🔄 Detected normal reconnection - waiting ${waitDuration}s for sync`);
                    }
                    
                    // Reset attempts counter after detection
                    attempts = 0;
                    return;
                }
                
                // Simple countdown
                const timeRemaining = ((maxAttempts - attempts) * 5);
                console.log(`⏳ ${syncPhase} sync: ${timeRemaining}s remaining...`);
                
                // Update sync state
                syncState.messageCount = attempts; // Use attempts as progress indicator
                syncState.status = 'syncing';
                
                // Progress callback
                if (onProgress) {
                    const progress = (attempts / maxAttempts) * 100;
                    onProgress({
                        attempts,
                        maxAttempts,
                        progress: Math.round(progress),
                        status: 'syncing',
                        syncPhase: syncPhase,
                        isInitialOnboarding: isInitialOnboarding,
                        timeRemaining: timeRemaining
                    });
                }
                
                // Complete when time is up
                if (attempts >= maxAttempts) {
                    clearInterval(syncCheck);
                    syncState.isComplete = true;
                    syncState.status = 'complete';
                    
                    if (onProgress) {
                        onProgress({
                            attempts,
                            maxAttempts,
                            progress: 100,
                            status: 'complete',
                            syncPhase: syncPhase,
                            isInitialOnboarding: isInitialOnboarding,
                            timeRemaining: 0
                        });
                    }
                    
                    const syncType = isInitialOnboarding ? 'Initial' : 'Normal';
                    console.log(`✅ ${syncType} sync complete! Waited ${waitDuration}s for messages to load`);
                    resolve(true);
                }
                
            } catch (error) {
                console.log(`⚠️ Error during sync wait: ${error.message}`);
                
                // Continue waiting even on errors
                if (attempts >= maxAttempts) {
                    clearInterval(syncCheck);
                    syncState.status = 'timeout';
                    console.log(`⏰ Sync wait completed despite errors after ${waitDuration}s`);
                    resolve(true); // Don't fail, just continue
                }
            }
        }, 5000); // Check every 5 seconds
    });
}

/**
 * Initialize WhatsApp client if not already connected
 * @param {Function} onSyncProgress - Optional callback for sync progress
 * @returns {Promise<Object>} WhatsApp client instance
 */
async function getClient(onSyncProgress = null) {
    if (!waClient) {
        console.log('🔄 Initializing WhatsApp client...');
        
        waClient = await create({
            sessionId: 'needle-crawler',
            headless: false,
            qrTimeout: 0,
            authTimeout: 30,
            blockCrashLogs: true,
            disableSpins: true,
            hostNotificationLang: 'PT_BR',
            logConsole: false,
            popup: false,
            restartOnCrash: getClient,
        });

        // Simple state change handler
        waClient.onStateChanged(state => {
            console.log('State changed:', state);
            if (state === "CONFLICT") {
                waClient.forceRefocus();
            }
        });
        
        console.log('✅ WhatsApp client initialized');
        
        // Wait for messages to sync
        try {
            await waitForMessageSync(waClient, onSyncProgress);
        } catch (error) {
            console.warn('⚠️ Message sync failed, continuing anyway:', error.message);
            // Don't fail completely, just continue
        }
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
        
        // Get client with sync detection
        const client = await getClient((syncProgress) => {
            if (progressCallback) {
                progressCallback({
                    type: 'sync-progress',
                    message: `Loading messages: ${syncProgress.messageCount}`,
                    progress: syncProgress.progress,
                    messageCount: syncProgress.messageCount
                });
            }
        });
        
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
                        } else {
                            console.log(`✅ Group "${group.name}" has ${messageCount}+ messages - marking as loaded`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Could not check message count for group "${group.name}": ${error.message}`);
                    isActive = false; // Mark as inactive if we can't check
                }
                
                const groupData = {
                    id: group.id,
                    title: group.name || 'Unknown Group',
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
                                
                // Get participants (for groups)
                let participants = [];
                if (chatInfo.isGroup) {
                    participants = await client.getGroupMembers(chatId);
                    participants = filterParticipants(participants);
                    console.log(`👥 Found ${participants.length} participants`);
                }
                
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
                    error: chatError.message || 'Unknown error',
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
            await waClient.kill();
            waClient = null;
            syncState = { isComplete: false, messageCount: 0, status: 'initializing' };
            console.log('🔌 WhatsApp client disconnected');
        } catch (error) {
            console.error('❌ Error closing client:', error);
        }
    }
}

/**
 * Get current sync status
 * @returns {Object} Current sync state
 */
function getSyncStatus() {
    return {
        ...syncState,
        lastUpdated: Date.now()
    };
}

/**
 * Simple focus function (stub for API compatibility)
 * @returns {void}
 */
function focusWhatsAppWindow() {
    console.log('📱 Focus WhatsApp window requested (using browser native focus)');
    // The browser window should already be focused when user interacts with it
    // This is just a stub to maintain API compatibility
}

/**
 * Get timer status (stub for API compatibility)
 * @returns {Object} Timer status
 */
function getTimerStatus() {
    return {
        timeRemaining: 0,
        isActive: false,
        isInQrMode: false
    };
}

module.exports = {
    listChats,
    exportChats,
    closeClient,
    getClient,
    getSyncStatus,
    focusWhatsAppWindow,
    getTimerStatus
};