// messageUtils.js
// This module provides message-centric utilities


const { isPhoneNumber, normalizePhoneNumber, isLid } = require('./common');

function parseMessageId(messageId) {
    if (typeof messageId !== 'string') {
        return { valid: false, reason: 'Message ID is not a string', raw: messageId };
    }

    const parts = messageId.split('_');
    if (parts.length !== 4) {
        return { valid: false, reason: 'Invalid message ID format', raw: messageId };
    }

    const [fromMeRaw, chatId, msgHashId, senderIdRaw] = parts;
    const senderId = senderIdRaw.replace(/@.*/, '');

    return {
        valid: true,
        chatId,
        msgHashId,
        senderId
    };
}

function getReadableSenderId(msg) {
    const rawId =
        msg.sender?.id ||
        (msg.id && parseMessageId(msg.id).senderId) ||
        msg.author ||
        'unknown@unknown';

    return rawId.replace(/@.*/, '');
}

function getPhoneNumber(msg) {
    const candidates = [];

    if (typeof msg.author === 'string') candidates.push(msg.author);

    if (msg.sender) {
        const s = msg.sender;
        if (typeof s === 'string') {
            candidates.push(s);
        } else {
            if (s.id) candidates.push(s.id);
            if (s.formattedName) candidates.push(s.formattedName);
            if (s.pushname) candidates.push(s.pushname);
            if (s.name) candidates.push(s.name);
        }
    }

    for (const value of candidates) {
        if (isPhoneNumber(value)) {
            return normalizePhoneNumber(value);
        }
    }

    return null;
}

function getLid(msg) {
    const candidates = [];

    if (typeof msg.author === 'string') candidates.push(msg.author);

    if (msg.sender) {
        const s = msg.sender;
        if (typeof s === 'string') {
            candidates.push(s);
        } else {
            if (s.id) candidates.push(s.id);
            if (s.formattedName) candidates.push(s.formattedName);
            if (s.pushname) candidates.push(s.pushname);
            if (s.name) candidates.push(s.name);
        }
    }

    for (const value of candidates) {
        if (isLid(value)) return value;
    }

    return null;
}

function stripLid(id) {
    return typeof id === 'string' ? id.replace(/@.*/, '') : id;
}

module.exports = {
    parseMessageId,
    getReadableSenderId,
    getPhoneNumber,
    getLid,
    stripLid
};