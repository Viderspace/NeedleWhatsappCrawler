// exporter.js
// This module handles file-writing and export logic
// (exporting messages and participants to JSON files)

const fs = require('fs');
const path = require('path');
const { getPhoneNumber, getLid } = require('./messageUtils');
const { isPhoneNumber, hebrewifyIfNeeded } = require('./common');
const { filterParticipants } = require('./participants');


/**
 * Sanitize a string to be used safely as a filename.
 */
function sanitizeFilename(name) {
    return name.replace(/[\/\\?%*:|"<>]/g, '-');
}

/**
 * Write the final export JSON to the specified directory.
 */
function writeExportFile(data, groupName, exportDir = 'exports') {

    const filename = sanitizeFilename(groupName) + '.json';
    const outputPath = path.join(exportDir, filename);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`✅ Exported ${data.messages.length} messages to ${outputPath}`);
}

/**
 * Optional debug function that logs and writes debug info.
 */
function exportDebugs(messages, participants) {
    const p_export = filterParticipants(participants);
    fs.writeFileSync('filtered_debug_participants.json', JSON.stringify(p_export, null, 2));

    let phones = 0;
    let lids = 0;

    const m_export = messages.map((msg) => {
        const phone = getPhoneNumber(msg);
        const lid = getLid(msg);

        if (phone) {
            console.log(`📞 Phone found in message: ${phone}, total finds: ${++phones}`);
        } else if (lid) {
            console.log(`📜 LID found in message: ${lid}, total finds: ${++lids}`);
        } else {
            console.log(`❌ No phone or LID found in message: ${msg.id}`);
        }

        return {
            msgHeader: msg.id,
            phone,
            lid
        };
    });

    console.log(`📞 Total phone numbers found: ${phones}`);
    console.log(`📜 Total LIDs found: ${lids}`);

    fs.writeFileSync('filtered_debug_messages.json', JSON.stringify(m_export, null, 2));
}

module.exports = {
    writeExportFile,
    sanitizeFilename,
    exportDebugs
};