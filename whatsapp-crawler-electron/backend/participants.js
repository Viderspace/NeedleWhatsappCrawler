// participants.js

// This module  handle everything related to group participants
// and identity resolution.


const { isPhoneNumber, normalizePhoneNumber, isLid, hebrewifyIfNeeded } = require('./common');

function filterParticipants(participants) {
    // First filter out null/undefined participants
    const validParticipants = participants.filter(p => p && p.id);
    
    const result = validParticipants.map((p) => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        pushname: p.pushname,
        phone: isPhoneNumber(p.formattedName) ? normalizePhoneNumber(p.formattedName) : null,
    }));

    // Remove any remaining nulls
    return result.filter(Boolean);
}

function buildParticipantInfo(participants, messages) {
    const infoMap = new Map();

    // From participants
    for (const p of participants) {
        const id = p.id.replace(/@.*/, '');
        const name = hebrewifyIfNeeded(p.pushname || p.name || 'Unknown');
        const phone = id.startsWith('972') ? '0' + id.slice(3) : id;

        infoMap.set(id, { phone, name });
    }

    // From message history
    for (const msg of messages) {
        const senderRawId = parseMessageId(msg.id)?.senderId;
        if (!senderRawId) continue;

        const id = senderRawId.replace(/@.*/, '');
        if (infoMap.has(id)) continue;

        const name = hebrewifyIfNeeded(msg.sender?.pushname || msg.sender?.formattedName || 'Unknown');
        const phone = id.startsWith('972') ? '0' + id.slice(3) : id;

        infoMap.set(id, { phone, name });
    }

    return infoMap;
}

function parseParticipant(entity, isAuthor = false) {
    if (!entity) return {};

    if (typeof entity === "string") {
        if (entity.includes('@g.us')) return {};
        return isPhoneNumber(entity)
            ? { phone: normalizePhoneNumber(entity) }
            : isLid(entity)
                ? { id: entity }
                : { unknown: entity };
    }

    const id = entity.id || null;
    const formattedName = entity.formattedName || null;

    const phone =
        isPhoneNumber(id) ? normalizePhoneNumber(id) :
            isPhoneNumber(formattedName) ? normalizePhoneNumber(formattedName) : null;

    const name =
        !isPhoneNumber(formattedName) && formattedName ? formattedName : null;

    const out = {};
    if (isLid(id)) out.id = id;
    if (phone) out.phone = phone;
    if (name) out.name = name;

    return out;
}

function mergeParticipants(a = {}, b = {}) {
    const result = {};

    if (a.id && b.id && a.id !== b.id) {
        result.id = a.id;
        result.altId = b.id;
    } else {
        result.id = a.id || b.id;
    }

    if (a.phone && b.phone && a.phone !== b.phone) {
        result.phone = a.phone;
        result.altPhone = b.phone;
    } else {
        result.phone = a.phone || b.phone;
    }

    if (a.name && b.name && a.name !== b.name) {
        result.name = a.name;
        result.altName = b.name;
    } else {
        result.name = a.name || b.name;
    }

    if (a.unknown && !result.name) result.name = a.unknown;
    if (b.unknown && !result.name) result.name = b.unknown;

    return result;
}

// Optional helper, only needed here if reused
function parseMessageId(messageId) {
    if (typeof messageId !== 'string') return null;
    const parts = messageId.split('_');
    if (parts.length !== 4) return null;

    const [, , , senderId] = parts;
    return { senderId };
}

module.exports = {
    filterParticipants,
    buildParticipantInfo,
    parseParticipant,
    mergeParticipants
};