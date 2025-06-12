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

module.exports = {
    findGroup,
    loadAllMessages
};