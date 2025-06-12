// ========================= CORE MODULES ==================================
const { create } = require('@open-wa/wa-automate');


/** USE 'CONFIG.JS' FILE TO SELECT WHATSAPP GROUP */
const { TARGET_GROUP_NAME, EXPORT_DIR, MAX_MESSAGES } = require('./config');

// ========================= SCRIPT COMPONENTS =============================

const { hebrewifyIfNeeded } = require('./common');
const {
    parseMessageId,
    getReadableSenderId,
    getPhoneNumber,
    getLid,
    stripLid
} = require('./messageUtils');

const {
    filterParticipants,
    buildParticipantInfo,
    parseParticipant,
    mergeParticipants
} = require('./participants');

// const {
//     extractUsersFromMessages,
//     getInfo
// } = require('./participantsEnricher');

const { enrichMessages,
    analyzeMessageLengths,
    analyzeMessageWordCounts} = require('./enrichment');
const { findGroup, loadAllMessages } = require('./waClient');
const { writeExportFile } = require('./exporter');


// ================================= MAIN ======================================
if (require.main === module) {
    create().then(async client => {
        try {
            const group = await findGroup(client, TARGET_GROUP_NAME);
            if (!group) return;

            const messages = await loadAllMessages(client, group.id, MAX_MESSAGES);

            let participants = await client.getGroupMembers(group.id);
            participants = filterParticipants(participants);

            console.log(`👥 Found ${participants.length} participants in group "${group.name}"`);

            /** Uncomment here to raw-export all messages & participants data */
            // exportDebugs(messages,participants);

            const enriched = enrichMessages(messages, participants);
            analyzeMessageWordCounts(enriched);

            const exportData = {
                messages: enriched,
                participants
            };

            writeExportFile(exportData, group.name, EXPORT_DIR);
            process.exit();
        } catch (error) {
            console.error('❌ Error during processing:', error);
        }
    });
}



/**
 * NOTES AND TODOs:
 *
 * ---Creating threads---
    * We can use this to traverse the quote chain (thread):
 * ----quoteMap: QuoteMap; --  line 207
 * from library file: node_modules/@open-wa/wa-automate/dist/api/model/message.d.ts
 *
 *
 * 1 תיראיניל
 *  ב רטסמס -1 יפניא
 */