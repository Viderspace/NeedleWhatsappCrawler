// crawl-service.js
// Modified crawler logic for Electron integration with progress callbacks

const path = require('path');
const fs = require('fs');
const os = require('os');

// Import existing modules (copy from parent directory)
const { hebrewifyIfNeeded } = require('./common');
const { parseMessageId, getReadableSenderId, getPhoneNumber, getLid, stripLid } = require('./messageUtils');
const { filterParticipants, buildParticipantInfo, parseParticipant, mergeParticipants } = require('./participants');
const { enrichMessages, analyzeMessageLengths, analyzeMessageWordCounts } = require('./enrichment');
const { writeExportFile } = require('./exporter');

/**
 * Get all available WhatsApp groups for selection with progressive loading
 */
async function getGroups(client, progressCallback = null) {
    console.log('📋 Fetching all WhatsApp groups...');
    
    const groups = await client.getAllGroups();
    
    if (!groups?.length) {
        console.log('❌ No groups found.');
        return [];
    }

    console.log(`✅ Found ${groups.length} groups, fetching member counts...`);
    
    // Format groups for UI display with member counts
    const formattedGroups = [];
    
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const groupName = hebrewifyIfNeeded(group.name || 'Unknown Group');
        
        // Send progress update before processing each group
        if (progressCallback) {
            progressCallback(
                `Loading group ${i + 1}/${groups.length}: ${groupName}`,
                i,
                groups.length
            );
        }
        
        let participantCount = 0;
        try {
            // Fetch actual member count for each group
            const members = await client.getGroupMembers(group.id);
            participantCount = members ? members.length : 0;
        } catch (error) {
            console.warn(`⚠️ Could not fetch members for group "${groupName}":`, error.message);
            // Use a fallback: check if group has any metadata about size
            participantCount = group.groupMetadata?.participants?.length || 0;
        }
        
        console.log(`   ${i + 1}). ${groupName} (${participantCount} members)`);
        
        const formattedGroup = {
            id: group.id,
            name: groupName,
            originalName: group.name,
            participantCount: participantCount,
            isGroupChat: true,
            description: group.description || '',
            createdBy: group.groupMetadata?.owner || 'Unknown'
        };
        
        formattedGroups.push(formattedGroup);
        
        // Send incremental group data to frontend for progressive display
        if (progressCallback) {
            progressCallback(
                `Loaded ${groupName} (${participantCount} members)`,
                i + 1,
                groups.length,
                formattedGroup // Send the individual group for immediate display
            );
        }
        
        // Small delay to avoid overwhelming WhatsApp API
        if (i < groups.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Sort by participant count (most active groups first)
    formattedGroups.sort((a, b) => b.participantCount - a.participantCount);
    
    return formattedGroups;
}

/**
 * Load all messages from a specific chat with progress reporting
 */
async function loadAllMessages(client, chatId, maxCount = 5000, progressCallback) {
    let allMessages = [];
    const seenIds = new Set();
    
    progressCallback?.(`Loading messages from chat...`, 0, maxCount);

    while (allMessages.length < maxCount) {
        if (progressCallback) {
            progressCallback(
                `Loading messages... (${allMessages.length}/${maxCount})`, 
                allMessages.length, 
                maxCount
            );
        }
        
        console.log(`📥 Loading... (unique messages: ${allMessages.length})`);
        
        const newMessages = await client.loadEarlierMessages(chatId);
        if (!newMessages?.length) break;

        let added = 0;
        for (const msg of newMessages) {
            if (!seenIds.has(msg.id)) {
                seenIds.add(msg.id);
                allMessages.push(msg);
                added++;
            }
        }

        if (added === 0) {
            console.log('🛑 No new messages, stopping.');
            break;
        }

        // Throttle to avoid overwhelming WhatsApp
        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`✅ Loaded ${allMessages.length} unique messages`);
    return allMessages;
}

/**
 * Process a single group and export its data
 */
async function processGroup(client, group, progressCallback) {
    try {
        console.log(`🔄 Processing group: ${group.name}`);
        progressCallback?.(`Processing group: ${group.name}`, 0, 100);
        
        // Load messages
        progressCallback?.(`Loading messages from ${group.name}...`, 10, 100);
        const messages = await loadAllMessages(
            client, 
            group.id, 
            5000, // MAX_MESSAGES
            (msg, current, total) => {
                const percentage = Math.round((current / total) * 60); // 60% of progress for message loading
                progressCallback?.(`${msg} (${group.name})`, 10 + percentage, 100);
            }
        );

        if (messages.length === 0) {
            console.log(`⚠️ No messages found in group: ${group.name}`);
            return null;
        }

        // Get participants
        progressCallback?.(`Loading participants from ${group.name}...`, 70, 100);
        let rawParticipants = await client.getGroupMembers(group.id);
        
        console.log(`📊 Raw participants data for "${group.name}": ${rawParticipants?.length || 0} total, types:`, 
            rawParticipants?.map(p => p ? 'valid' : 'null').join(', ') || 'none');
        
        let participants = filterParticipants(rawParticipants || []);
        
        console.log(`👥 Found ${participants.length} valid participants in group "${group.name}"`);

        // Enrich messages
        progressCallback?.(`Enriching messages from ${group.name}...`, 80, 100);
        const enriched = enrichMessages(messages, participants);
        
        // Analyze data
        progressCallback?.(`Analyzing data from ${group.name}...`, 90, 100);
        analyzeMessageWordCounts(enriched);

        const exportData = {
            metadata: {
                groupName: group.name,
                groupId: group.id,
                participantCount: participants.length,
                messageCount: enriched.length,
                exportDate: new Date().toISOString(),
                exportedBy: 'WhatsApp Data Collector v1.0'
            },
            messages: enriched,
            participants
        };

        // Write export file
        progressCallback?.(`Exporting data for ${group.name}...`, 95, 100);
        
        // Create export path in Downloads directory
        const downloadsPath = path.join(os.homedir(), 'Downloads');
        const exportPath = path.join(downloadsPath, 'WhatsApp Data Collection');
        
        // Ensure exports directory exists
        if (!fs.existsSync(exportPath)) {
            fs.mkdirSync(exportPath, { recursive: true });
            console.log(`📁 Created export directory: ${exportPath}`);
        }
        
        writeExportFile(exportData, group.name, exportPath);
        
        progressCallback?.(`Completed ${group.name}`, 100, 100);
        
        return {
            groupName: group.name,
            messageCount: enriched.length,
            participantCount: participants.length,
            exportPath: path.join(exportPath, `${sanitizeFilename(group.name)}.json`)
        };
        
    } catch (error) {
        console.error(`❌ Error processing group ${group.name}:`, error);
        throw error;
    }
}

/**
 * Run crawler for multiple selected groups (using cached data)
 */
async function runCrawler(client, selectedGroupIds, progressCallback, cachedGroups = null) {
    try {
        console.log(`🚀 Starting crawl for ${selectedGroupIds.length} groups...`);
        
        // Use cached groups if provided, otherwise fetch fresh
        let allGroups;
        if (cachedGroups && cachedGroups.length > 0) {
            console.log(`📋 Using cached groups data (${cachedGroups.length} groups)`);
            allGroups = cachedGroups;
        } else {
            console.log(`📋 Fetching fresh groups data...`);
            allGroups = await getGroups(client);
        }
        
        const selectedGroups = allGroups.filter(group => selectedGroupIds.includes(group.id));
        
        if (selectedGroups.length === 0) {
            throw new Error('No valid groups found for selected IDs');
        }
        
        console.log(`📋 Selected groups: ${selectedGroups.map(g => g.name).join(', ')}`);
        
        const results = [];
        
        for (let i = 0; i < selectedGroups.length; i++) {
            const group = selectedGroups[i];
            
            // Update overall progress
            const overallProgress = Math.round((i / selectedGroups.length) * 100);
            progressCallback?.(
                `Processing ${i + 1}/${selectedGroups.length}: ${group.name}`, 
                i, 
                selectedGroups.length
            );
            
            try {
                const result = await processGroup(client, group, (msg, current, total) => {
                    // Forward group-specific progress with overall context
                    progressCallback?.(`[${i + 1}/${selectedGroups.length}] ${msg}`, i, selectedGroups.length);
                });
                
                if (result) {
                    results.push(result);
                    console.log(`✅ Successfully processed: ${group.name}`);
                }
            } catch (error) {
                console.error(`❌ Failed to process group ${group.name}:`, error);
                results.push({
                    groupName: group.name,
                    error: error.message,
                    success: false
                });
            }
        }
        
        progressCallback?.('Crawl completed!', selectedGroups.length, selectedGroups.length);
        
        const successCount = results.filter(r => !r.error).length;
        console.log(`🎉 Crawl completed! ${successCount}/${selectedGroups.length} groups processed successfully.`);
        
        return {
            totalGroups: selectedGroups.length,
            successful: successCount,
            failed: selectedGroups.length - successCount,
            results
        };
        
    } catch (error) {
        console.error('❌ Crawler error:', error);
        throw error;
    }
}

/**
 * Sanitize filename for safe file creation
 */
function sanitizeFilename(name) {
    return name.replace(/[\/\\?%*:|"<>]/g, '-');
}

module.exports = {
    getGroups,
    loadAllMessages,
    processGroup,
    runCrawler,
    sanitizeFilename
};
