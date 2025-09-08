// waClient.js

// This module  wrap all logic related to interacting with the WhatsApp client,
// powered by the @open-wa/wa-automate library.

const { hebrewifyIfNeeded } = require('./common');

async function findGroup(client, name) {
    const groups = await client.getAllGroups();
    i = 0;
    console.log(`total groups found "${groups.length}"...`);
    groups.forEach((g => {
        // print to console the group name and i
        const groupName = hebrewifyIfNeeded(g.name || 'Unknown Group');
        console.log(`   ${++i}). ${groupName} (${g.id})`);
    }));


    console.log(`🔍 Searching for group "${name}"...`);
    if (!groups?.length) {
        console.log('❌ No groups found.');
        return null;
    }

    console.log(`📋 Found ${groups.length} groups:`);
    groups.slice(0, 10).forEach((g, i) => {
        const groupName = hebrewifyIfNeeded(g.name || 'Unknown Group');
        console.log(`   ${i + 1}). ${groupName} (${g.id})`);
    });
    console.log('-----------------------------');

    const group = groups.find(g => g.name?.includes(name));
    if (!group) {
        console.log(`❌ Group "${name}" not found.`);
        return null;
    }
    console.log(`✅ Found group: ${hebrewifyIfNeeded(group.name)} (${group.id})`);
    return group;
}

async function loadAllMessages(client, chatId, maxCount) {
    console.log(`📥 Loading all messages for chat ${chatId}...`);
    
    try {
        // Use manual pagination loop for reliable message loading
        console.log(`🔄 Using manual pagination to load complete message history...`);
        const allMessages = [];
        let loadedBatch;
        let batchCount = 0;
        
        do {
            loadedBatch = await client.loadEarlierMessages(chatId);
            if (loadedBatch && loadedBatch.length > 0) {
                allMessages.push(...loadedBatch);
                batchCount++;
                console.log(`📥 Loaded batch ${batchCount}: ${loadedBatch.length} messages (total so far: ${allMessages.length})`);
                
                // Add small delay between batches to avoid overwhelming WhatsApp Web
                await new Promise(r => setTimeout(r, 100));
            }
        } while (loadedBatch && loadedBatch.length > 0);
        
        console.log(`✅ Finished loading. Retrieved ${allMessages.length} messages in ${batchCount} batches`);
        
        if (allMessages.length === 0) {
            console.log('⚠️ No messages found in chat');
            return [];
        }
        
        // Apply maxCount limit if specified
        const limitedMessages = maxCount ? allMessages.slice(0, maxCount) : allMessages;
        
        if (limitedMessages.length < allMessages.length) {
            console.log(`📊 Limited to ${limitedMessages.length} messages (from ${allMessages.length} total)`);
        }
        
        return limitedMessages;
        
    } catch (error) {
        console.log(`⚠️ loadAllEarlierMessages failed, falling back to incremental loading: ${error.message}`);
        
        // Fallback to the original incremental method
        let allMessages = [];
        const seenIds = new Set();

        while (allMessages.length < maxCount) {
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

            await new Promise(r => setTimeout(r, 300)); // throttle
        }

        return allMessages;
    }
}

module.exports = {
    findGroup,
    loadAllMessages
};