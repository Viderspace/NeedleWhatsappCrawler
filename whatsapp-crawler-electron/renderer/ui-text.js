// ui-text.js - Centralized UI Text Constants
// This file contains all user-facing text for easy editing and localization

const UI_TEXT = {
    // App Title and General
    APP_TITLE: 'WhatsApp Data Collector',
    APP_SUBTITLE: 'Collaborative Research Tool',
    APP_VERSION: 'v1.0',
    FOOTER_TEXT: '© 2024 Needle Research Team | WhatsApp Data Collector v1.0',
    
    // Welcome Screen
    WELCOME: {
        TITLE: '🎓 Course Research Project',
        DESCRIPTION: 'This tool helps collect WhatsApp group data for academic research purposes. Your participation helps us understand communication patterns in educational settings.',
        
        FEATURES: {
            PRIVACY: {
                ICON: '🔒',
                TITLE: 'Privacy Protected',
                DESCRIPTION: 'Data stays on your device until you choose to export'
            },
            RESEARCH: {
                ICON: '📊',
                TITLE: 'Research Purpose',
                DESCRIPTION: 'Analyzing communication patterns in academic groups'
            },
            SELECTION: {
                ICON: '🎯',
                TITLE: 'Group Selection',
                DESCRIPTION: 'You choose which groups to include'
            }
        },
        
        CONSENT: {
            CHECKBOX_TEXT: 'I agree to share data from selected WhatsApp groups for research purposes',
            NOTE: 'By checking this box, you consent to contributing anonymized data from selected public academic groups to help with research analysis.',
            BUTTON_TEXT: 'Start Authentication',
            BUTTON_ICON: '🚀'
        }
    },
    
    // Authentication Screen
    AUTH: {
        TITLE: '🔐 WhatsApp Authentication',
        
        INSTRUCTIONS: [
            'A terminal window will open showing a QR code',
            'Open WhatsApp on your phone',
            'Tap on "Settings" → "Linked Devices" → "Link a Device"',
            'Scan the QR code displayed in the terminal'
        ],
        
        STATUSES: {
            INITIALIZING: 'Initializing authentication...',
            SUCCESS: 'Authentication successful! Loading groups...',
            FAILED: 'Authentication failed',
            ERROR: 'Authentication error'
        },
        
        CANCEL_BUTTON: 'Cancel'
    },
    
    // Groups Screen
    GROUPS: {
        TITLE: '📋 Select WhatsApp Groups',
        DESCRIPTION: 'Choose which groups to include in the research data collection',
        
        SEARCH_PLACEHOLDER: '🔍 Search groups...',
        
        FILTER: {
            LABEL: '👥 Min members:',
            HELP: 'Only show groups with at least this many members'
        },
        
        STATS: {
            GROUPS_SHOWN: 'groups shown',
            SELECTED: 'selected'
        },
        
        ACTIONS: {
            CLEAR_SELECTION: 'Clear Selection',
            EXTRACT: {
                TEXT: 'Extract Selected Groups',
                ICON: '📥'
            }
        },
        
        LOADING: {
            TITLE: 'Loading Groups...',
            DESCRIPTION: 'Fetching your WhatsApp groups and member counts.\nThis may take a moment for groups with many members.'
        },
        
        EMPTY: {
            TITLE: 'No WhatsApp groups found.',
            DESCRIPTION: 'Make sure you\'re part of some groups and try again.'
        }
    },
    
    // Progress Screen
    PROGRESS: {
        TITLE: '🔄 Processing Groups',
        DESCRIPTION: 'Extracting and analyzing data from selected groups...',
        
        LABELS: {
            CURRENT: 'Current:',
            PROGRESS: 'Progress:'
        },
        
        STATUSES: {
            INITIALIZING: 'Initializing...',
            LOADING: 'Loading...',
            PROCESSING: 'Processing',
            EXPORTING: 'Exporting',
            COMPLETED: 'Completed'
        }
    },
    
    // Results Screen
    RESULTS: {
        TITLE: '✅ Export Complete',
        DESCRIPTION: 'Your WhatsApp data has been successfully processed and exported!',
        
        STATS: {
            TOTAL: 'Groups Processed',
            SUCCESSFUL: 'Successful',
            FAILED: 'Failed'
        },
        
        FILES: {
            TITLE: '📁 Exported Files',
            EMPTY: 'No export files found.'
        },
        
        ACTIONS: {
            OPEN_EXPORTS: {
                TEXT: 'Open Export Folder',
                ICON: '📂'
            },
            SELECT_MORE: {
                TEXT: 'Select More Groups',
                ICON: '📋'
            },
            EXIT: {
                TEXT: 'Exit Application',
                ICON: '🚪'
            }
        }
    },
    
    // Error Messages
    ERRORS: {
        NO_GROUPS_SELECTED: {
            TITLE: 'No Groups Selected',
            MESSAGE: 'Please select at least one group to extract data from.'
        },
        EXTRACTION_FAILED: {
            TITLE: 'Extraction Failed'
        },
        EXTRACTION_ERROR: {
            TITLE: 'Extraction Error'
        },
        LOAD_GROUPS_FAILED: 'Failed to load groups',
        SHOW_EXPORTS_FAILED: 'Failed to open exports folder'
    },
    
    // Success Messages
    SUCCESS: {
        AUTHENTICATION: 'Authentication successful!',
        CRAWL_COMPLETED: 'Crawl completed successfully'
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI_TEXT;
} else {
    window.UI_TEXT = UI_TEXT;
}

