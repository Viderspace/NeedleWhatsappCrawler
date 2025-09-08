// common.js

/**
 * If the text contains Hebrew characters, reverse it.
 */
function hebrewifyIfNeeded(text) {
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    return hasHebrew ? text.split('').reverse().join('') : text;
}

/**
 * Check if a string is a LID (likely a user ID ending with '@lid').
 */
function isLid(input) {
    return typeof input === 'string' && input.includes('@lid');
}

/**
 * Check if the input string is in a valid Israeli phone number format.
 */
function isPhoneNumber(input) {
    if (typeof input !== 'string') return false;

    const phoneRegex = /(\+?972[-\s]?\d{2}[-\s]?\d{3}[-\s]?\d{4})|(972\d{9})/;
    return phoneRegex.test(input);
}

/**
 * Normalize phone numbers to numeric-only '972XXXXXXXXX' format.
 */
function normalizePhoneNumber(input) {
    if (typeof input !== 'string') return input;

    const normalized = input.replace(/[^\d]/g, '');
    return normalized.startsWith('972') ? normalized : input;
}

module.exports = {
    hebrewifyIfNeeded,
    isLid,
    isPhoneNumber,
    normalizePhoneNumber
};