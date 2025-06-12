// config.js

const path = require('path');

module.exports = {

    TARGET_GROUP_NAME:'מחט בערימת דאטה',
    //' ב רטסמס -1 יפניא '
    // 'ניידל קבוצת
    // האלופים' ,
    // 'מחט בערימת דאטה',
    EXPORT_DIR: 'exports',
    MAX_MESSAGES: 5000,

    getOutputFilePath: (groupName) => {
        const sanitize = name => name.replace(/[\/\\?%*:|"<>]/g, '-');
        return path.join('exports', `${sanitize(groupName)}.json`);
    }
};