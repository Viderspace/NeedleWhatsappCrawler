// common.js

/**
 * Proper Hebrew text handling - don't reverse, just normalize
 */
function hebrewifyIfNeeded(text) {
    if (!text || typeof text !== 'string') return text || '';
    
    // Remove problematic Unicode direction marks that can cause display issues
    return text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '').trim();
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