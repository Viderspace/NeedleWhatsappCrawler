// enrichment.js
//This module handles all logic related to turning raw messages into
// enriched structured data, including replies, reactions, and sender metadata.
const {
    parseMessageId,
    getPhoneNumber,
    getLid
} = require('./messageUtils');

const { isPhoneNumber, isLid, normalizePhoneNumber } = require('./common');

function enrichMessages(messages, members) {
    messages.sort(sortByTimestamp);

    const enriched = messages.map((msg, index) =>
        enrichSingleMessage(msg, index, members)
    );

    return enriched
        .filter(isValidMessage)
        .sort(sortByTimestamp)
        .map(addFinalMetadata);
}

function enrichSingleMessage(msg, index, members) {
    const parsedId = parseMessageId(msg.id);
    const sender = resolveSender(msg, members);
    const replyTo = buildReplyTo(msg, members);

    console.log(`Enriching message ${index + 1} sent by ${JSON.stringify(sender)}`);

    return {
        id: parsedId.valid ? parsedId.msgHashId : msg.id,
        sender,
        timestamp: msg.timestamp,
        body: extractMessageBody(msg),
        replyTo,
        reactions: formatReactionsForMessage(msg)
    };
}

function resolveSender(msg, members) {
    const phone = getPhoneNumber(msg);
    if (phone) {
        return members.find(p => p.phone === phone) || "Unknown Member";
    }

    const lid = getLid(msg);
    if (lid) {
        return members.find(p => p.id === lid) || "Unknown Member";
    }

    return "Unknown Member";
}

function buildReplyTo(msg, members) {
    if (!msg.quotedMsg || !msg.quotedParticipant) return null;

    const quoted = msg.quotedParticipant;

    const author = isPhoneNumber(quoted)
        ? members.find(p => p.phone === normalizePhoneNumber(quoted)) || quoted
        : isLid(quoted)
            ? members.find(p => p.id === quoted) || quoted
            : quoted;

    return {
        ref: msg.quotedStanzaID || "unresolved reference",
        author,
        body: extractMessageBody(msg.quotedMsg)
    };
}

function extractMessageBody(msg) {
    return msg.isMedia ? "<Media Message (Truncated)>" : msg.body || msg.content || "[No text]";
}

function formatReactionsForMessage(msg) {
    if (!msg.reactions?.length) return null;

    return msg.reactions.map(reaction => ({
        emoji: reaction.aggregateEmoji,
        count: reaction.senders.length,
        reactedBy: reaction.senders.map(s => s.senderUserJid.replace(/@.*/, ''))
    }));
}

function isValidMessage(msg) {
    return typeof msg.timestamp === 'number' && msg.timestamp > 0;
}

function addFinalMetadata(msg, index) {
    return {
        serialNumber: index + 1,
        datetime: formatTimestamp(msg.timestamp),
        messageId: msg.id,
        sender: msg.sender,
        body: msg.body,
        replyTo: msg.replyTo,
        reactions: msg.reactions
    };
}

function sortByTimestamp(a, b) {
    return a.timestamp - b.timestamp;
}

function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toISOString();
}


const fs = require('fs');

function analyzeMessageLengths(messages, outputFile = 'length_histogram.json') {
    const MIN_LENGTH = 1;
    const MAX_LENGTH = 2000;
    const BUCKET_SIZE = 10;

    const validTexts = messages
        .filter(msg =>
            !msg.isMedia &&
            typeof msg.body === 'string' &&
            msg.body.length >= MIN_LENGTH &&
            msg.body.length <= MAX_LENGTH
        )
        .map(msg => msg.body.trim());

    if (validTexts.length === 0) {
        console.log('⚠️ No valid text messages to analyze.');
        return;
    }

    const totalLength = validTexts.reduce((sum, text) => sum + text.length, 0);
    const averageLength = totalLength / validTexts.length;

    console.log(`✏️ Average message length: ${averageLength.toFixed(2)} characters (across ${validTexts.length} messages)`);

    // Build histogram
    const histogram = {};

    for (const text of validTexts) {
        const len = text.length;
        const bucket = Math.floor(len / BUCKET_SIZE) * BUCKET_SIZE;
        const label = `${bucket}-${bucket + BUCKET_SIZE - 1}`;

        histogram[label] = (histogram[label] || 0) + 1;
    }

    const sortedHistogram = Object.keys(histogram)
        .sort((a, b) => {
            const aNum = parseInt(a.split('-')[0]);
            const bNum = parseInt(b.split('-')[0]);
            return aNum - bNum;
        })
        .reduce((obj, key) => {
            obj[key] = histogram[key];
            return obj;
        }, {});

    fs.writeFileSync(outputFile, JSON.stringify(sortedHistogram, null, 2));
    console.log(`📊 Histogram saved to ${outputFile}`);
}


function analyzeMessageWordCounts(messages, outputFile = 'word_histogram.json') {
    const MAX_WORDS = 200;
    const BUCKET_SIZE = 5;

    const wordCounts = messages
        .filter(msg =>
            !msg.isMedia &&
            typeof msg.body === 'string' &&
            msg.body.trim().length > 0
        )
        .map(msg => msg.body.trim().split(/\s+/).length)
        .filter(count => count <= MAX_WORDS); // filter anomalies

    if (wordCounts.length === 0) {
        console.log('⚠️ No valid text messages to analyze.');
        return;
    }

    const totalWords = wordCounts.reduce((sum, count) => sum + count, 0);
    const averageWords = totalWords / wordCounts.length;

    console.log(`📝 Average message word count: ${averageWords.toFixed(2)} words (across ${wordCounts.length} messages)`);

    // Build histogram
    const histogram = {};

    for (const count of wordCounts) {
        const bucket = Math.floor(count / BUCKET_SIZE) * BUCKET_SIZE;
        const label = `${bucket}-${bucket + BUCKET_SIZE - 1}`;
        histogram[label] = (histogram[label] || 0) + 1;
    }

    const sortedHistogram = Object.keys(histogram)
        .sort((a, b) => parseInt(a.split('-')[0]) - parseInt(b.split('-')[0]))
        .reduce((obj, key) => {
            obj[key] = histogram[key];
            return obj;
        }, {});

    fs.writeFileSync(outputFile, JSON.stringify(sortedHistogram, null, 2));
    console.log(`📊 Word count histogram saved to ${outputFile}`);
}

module.exports = {
    enrichMessages,
    analyzeMessageLengths,
    analyzeMessageWordCounts
};