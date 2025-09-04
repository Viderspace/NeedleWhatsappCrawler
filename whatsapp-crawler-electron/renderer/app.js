// app.js - Frontend JavaScript for WhatsApp Data Collector

class WhatsAppCollectorApp {
    constructor() {
        this.currentScreen = 'welcome-screen';
        this.selectedGroups = new Set();
        this.allGroups = [];
        this.authListeners = [];
        
        this.init();
    }

    init() {
        this.initializeUIText();
        this.setupEventListeners();
        this.setupElectronEventListeners();
        this.showScreen('welcome-screen');
    }

    initializeUIText() {
        // Initialize UI text from constants
        if (typeof UI_TEXT !== 'undefined') {
            // Update app title and subtitle
            const appTitle = document.getElementById('app-title');
            const appSubtitle = document.getElementById('app-subtitle');
            const footerText = document.getElementById('footer-text');
            
            if (appTitle) appTitle.textContent = `📱 ${UI_TEXT.APP_TITLE}`;
            if (appSubtitle) appSubtitle.textContent = UI_TEXT.APP_SUBTITLE;
            if (footerText) footerText.textContent = UI_TEXT.FOOTER_TEXT;
            
            // Update welcome screen
            const welcomeTitle = document.getElementById('welcome-title');
            const welcomeDescription = document.getElementById('welcome-description');
            
            if (welcomeTitle) welcomeTitle.textContent = UI_TEXT.WELCOME.TITLE;
            if (welcomeDescription) welcomeDescription.textContent = UI_TEXT.WELCOME.DESCRIPTION;
        }
    }

    setupEventListeners() {
        // Welcome screen
        const consentCheckbox = document.getElementById('consent-checkbox');
        const startAuthBtn = document.getElementById('start-auth-btn');
        
        consentCheckbox.addEventListener('change', (e) => {
            startAuthBtn.disabled = !e.target.checked;
        });

        startAuthBtn.addEventListener('click', () => {
            this.startAuthentication();
        });

        // Auth screen
        document.getElementById('cancel-auth-btn').addEventListener('click', () => {
            this.showScreen('welcome-screen');
        });

        // Groups screen
        document.getElementById('group-search').addEventListener('input', (e) => {
            this.applyFilters();
        });

        document.getElementById('min-members-filter').addEventListener('input', (e) => {
            this.applyFilters();
        });

        document.getElementById('clear-selection-btn').addEventListener('click', () => {
            this.clearSelection();
        });

        document.getElementById('extract-btn').addEventListener('click', () => {
            this.startExtraction();
        });

        // Results screen
        document.getElementById('open-exports-btn').addEventListener('click', () => {
            window.electronAPI.showExports();
        });

        document.getElementById('start-over-btn').addEventListener('click', () => {
            this.startOver();
        });

        document.getElementById('exit-btn').addEventListener('click', () => {
            window.electronAPI.exitApp();
        });
    }

    setupElectronEventListeners() {
        // Auth status updates
        window.electronAPI.onAuthStatus((message) => {
            this.updateAuthStatus(message);
        });

        // Progress updates
        window.electronAPI.onProgressUpdate((message) => {
            this.updateProgress(message);
        });

        // Crawl progress updates
        window.electronAPI.onCrawlProgress((data) => {
            this.updateCrawlProgress(data);
        });

        // Progressive group loading events
        window.electronAPI.onGroupLoadingProgress((data) => {
            this.updateGroupLoadingProgress(data);
        });

        window.electronAPI.onGroupLoaded((groupData) => {
            this.addGroupToList(groupData);
        });

        window.electronAPI.onGroupsLoadingComplete((groups) => {
            this.finishGroupLoading(groups);
        });
    }

    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
    }

    async startAuthentication() {
        this.showScreen('auth-screen');
        this.updateAuthStatus('Initializing WhatsApp authentication...');

        try {
            const result = await window.electronAPI.startAuth();
            
            if (result.success) {
                this.updateAuthStatus('Authentication successful! Loading groups...');
                
                // Small delay to show success message
                setTimeout(() => {
                    this.loadGroups();
                }, 1500);
            } else {
                this.updateAuthStatus(`Authentication failed: ${result.message}`);
                
                // Show error and return to welcome after delay
                setTimeout(() => {
                    this.showScreen('welcome-screen');
                }, 3000);
            }
        } catch (error) {
            console.error('Authentication error:', error);
            this.updateAuthStatus(`Authentication error: ${error.message}`);
            
            setTimeout(() => {
                this.showScreen('welcome-screen');
            }, 3000);
        }
    }

    updateAuthStatus(message) {
        document.getElementById('auth-status-text').textContent = message;
    }

    async loadGroups() {
        try {
            // Show the groups screen first with a loading message
            this.showScreen('groups-screen');
            this.showGroupsLoading();
            
            // Initialize progressive loading
            this.progressiveGroups = [];
            
            const result = await window.electronAPI.getGroups();
            
            if (!result.success) {
                await window.electronAPI.showError('Error', `Failed to load groups: ${result.message}`);
                this.showScreen('welcome-screen');
            }
            // Note: Groups will be loaded progressively via event handlers
        } catch (error) {
            console.error('Error loading groups:', error);
            await window.electronAPI.showError('Error', `Failed to load groups: ${error.message}`);
            this.showScreen('welcome-screen');
        }
    }

    showGroupsLoading() {
        const groupsList = document.getElementById('groups-list');
        groupsList.innerHTML = `
            <div id="groups-loading-container" style="text-align: center; padding: 3rem; color: #667eea;">
                <div class="spinner" style="margin: 0 auto 1rem auto; width: 40px; height: 40px;"></div>
                <h3>Loading Groups...</h3>
                <div id="loading-progress-bar" style="width: 100%; max-width: 300px; margin: 1rem auto; background: rgba(102, 126, 234, 0.2); border-radius: 10px; height: 8px;">
                    <div id="loading-progress-fill" style="width: 0%; height: 100%; background: #667eea; border-radius: 10px; transition: width 0.3s ease;"></div>
                </div>
                <p id="loading-status" style="color: #718096; margin-top: 0.5rem;">
                    Fetching your WhatsApp groups and member counts...
                </p>
                <p id="loading-counter" style="color: #4a5568; font-weight: 500; margin-top: 0.5rem;">
                    0 groups loaded
                </p>
            </div>
            <div id="progressive-groups-list" style="padding: 0.5rem;">
                <!-- Groups will appear here progressively -->
            </div>
        `;
        
        // Disable controls while loading
        document.getElementById('group-search').disabled = true;
        document.getElementById('min-members-filter').disabled = true;
        document.getElementById('clear-selection-btn').disabled = true;
        document.getElementById('extract-btn').disabled = true;
    }

    renderGroups(groups) {
        const groupsList = document.getElementById('groups-list');
        groupsList.innerHTML = '';

        // Re-enable controls after loading
        document.getElementById('group-search').disabled = false;
        document.getElementById('min-members-filter').disabled = false;
        document.getElementById('clear-selection-btn').disabled = false;

        if (groups.length === 0) {
            groupsList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #718096;">
                    <p>No WhatsApp groups found.</p>
                    <p>Make sure you're part of some groups and try again.</p>
                </div>
            `;
            return;
        }

        groups.forEach(group => {
            const groupItem = document.createElement('div');
            groupItem.className = 'group-item';
            groupItem.dataset.groupId = group.id;

            const isSelected = this.selectedGroups.has(group.id);
            if (isSelected) {
                groupItem.classList.add('selected');
            }

            groupItem.innerHTML = `
                <input type="checkbox" class="group-checkbox" ${isSelected ? 'checked' : ''}>
                <div class="group-info">
                    <div class="group-name">${this.escapeHtml(group.name)}</div>
                    <div class="group-meta">
                        👥 ${group.participantCount} members
                        ${group.description ? ` • ${this.escapeHtml(group.description.substring(0, 50))}${group.description.length > 50 ? '...' : ''}` : ''}
                    </div>
                </div>
            `;

            groupItem.addEventListener('click', () => {
                this.toggleGroupSelection(group.id);
            });

            groupsList.appendChild(groupItem);
        });

        this.updateSelectionCount();
        this.updateGroupsShownCount(groups.length);
    }

    toggleGroupSelection(groupId) {
        const groupItem = document.querySelector(`[data-group-id="${groupId}"]`);
        const checkbox = groupItem.querySelector('.group-checkbox');

        if (this.selectedGroups.has(groupId)) {
            this.selectedGroups.delete(groupId);
            groupItem.classList.remove('selected');
            checkbox.checked = false;
        } else {
            this.selectedGroups.add(groupId);
            groupItem.classList.add('selected');
            checkbox.checked = true;
        }

        this.updateSelectionCount();
    }

    clearSelection() {
        this.selectedGroups.clear();
        this.applyFilters();
    }

    updateSelectionCount() {
        document.getElementById('selected-count').textContent = this.selectedGroups.size;
        document.getElementById('extract-btn').disabled = this.selectedGroups.size === 0;
    }

    updateGroupsShownCount(count) {
        document.getElementById('groups-shown-count').textContent = count;
    }

    applyFilters() {
        const searchTerm = document.getElementById('group-search').value.toLowerCase();
        const minMembers = parseInt(document.getElementById('min-members-filter').value) || 0;
        
        const filtered = this.allGroups.filter(group => {
            // Search filter
            const matchesSearch = group.name.toLowerCase().includes(searchTerm) ||
                                (group.description && group.description.toLowerCase().includes(searchTerm));
            
            // Members filter
            const hasEnoughMembers = group.participantCount >= minMembers;
            
            return matchesSearch && hasEnoughMembers;
        });
        
        this.renderGroups(filtered);
    }

    async startExtraction() {
        if (this.selectedGroups.size === 0) {
            const errorTitle = UI_TEXT?.ERRORS?.NO_GROUPS_SELECTED?.TITLE || 'No Groups Selected';
            const errorMessage = UI_TEXT?.ERRORS?.NO_GROUPS_SELECTED?.MESSAGE || 'Please select at least one group to extract data from.';
            await window.electronAPI.showError(errorTitle, errorMessage);
            return;
        }

        this.showScreen('progress-screen');
        this.updateProgress('Initializing extraction...');

        try {
            const selectedGroupIds = Array.from(this.selectedGroups);
            const result = await window.electronAPI.startCrawl(selectedGroupIds);

            if (result.success) {
                this.showResults(result.results);
            } else {
                const errorTitle = UI_TEXT?.ERRORS?.EXTRACTION_FAILED?.TITLE || 'Extraction Failed';
                await window.electronAPI.showError(errorTitle, result.message);
                this.showScreen('groups-screen');
            }
        } catch (error) {
            console.error('Extraction error:', error);
            const errorTitle = UI_TEXT?.ERRORS?.EXTRACTION_ERROR?.TITLE || 'Extraction Error';
            await window.electronAPI.showError(errorTitle, error.message);
            this.showScreen('groups-screen');
        }
    }

    updateProgress(message) {
        document.getElementById('progress-status-text').textContent = message;
    }

    updateCrawlProgress(data) {
        const { message, current, total, percentage } = data;
        
        // Update progress bar
        document.getElementById('progress-bar-fill').style.width = `${percentage}%`;
        document.getElementById('progress-percentage').textContent = `${percentage}%`;
        
        // Update status text
        document.getElementById('progress-status-text').textContent = message;
        
        // Update counters
        document.getElementById('progress-counter').textContent = `${current}/${total}`;
        
        // Update current group (extract from message)
        const groupMatch = message.match(/Processing .*?: (.+)/);
        if (groupMatch) {
            document.getElementById('current-group').textContent = groupMatch[1];
        }
    }

    async showResults(results) {
        this.showScreen('results-screen');

        // Update summary stats
        document.getElementById('total-groups').textContent = results.totalGroups;
        document.getElementById('successful-groups').textContent = results.successful;
        document.getElementById('failed-groups').textContent = results.failed;

        // Load and display export files
        try {
            const filesResult = await window.electronAPI.getExportFiles();
            if (filesResult.success) {
                this.renderExportFiles(filesResult.files);
            }
        } catch (error) {
            console.error('Error loading export files:', error);
        }
    }

    renderExportFiles(files) {
        const filesList = document.getElementById('export-files-list');
        filesList.innerHTML = '';

        if (files.length === 0) {
            filesList.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: #718096;">
                    No export files found.
                </div>
            `;
            return;
        }

        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const sizeKB = Math.round(file.size / 1024);
            const modifiedDate = new Date(file.modified).toLocaleString();

            fileItem.innerHTML = `
                <div>
                    <div class="file-name">📄 ${this.escapeHtml(file.name)}</div>
                    <div class="file-meta">${sizeKB} KB • Modified: ${modifiedDate}</div>
                </div>
            `;

            filesList.appendChild(fileItem);
        });
    }

    startOver() {
        // Only reset group selections, keep authentication and groups data
        this.selectedGroups.clear();
        
        // Reset UI elements for group selection
        document.getElementById('group-search').value = '';
        document.getElementById('min-members-filter').value = '20';
        
        // Re-apply filters and go back to groups screen
        this.applyFilters();
        this.showScreen('groups-screen');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Progressive group loading methods
    updateGroupLoadingProgress(data) {
        const progressFill = document.getElementById('loading-progress-fill');
        const loadingStatus = document.getElementById('loading-status');
        const loadingCounter = document.getElementById('loading-counter');
        
        if (progressFill) {
            progressFill.style.width = `${data.percentage}%`;
        }
        
        if (loadingStatus) {
            loadingStatus.textContent = data.message;
        }
        
        if (loadingCounter) {
            loadingCounter.textContent = `${data.current}/${data.total} groups loaded`;
        }
    }

    addGroupToList(groupData) {
        const progressiveGroupsList = document.getElementById('progressive-groups-list');
        if (!progressiveGroupsList) return;
        
        // Add group to our progressive array
        this.progressiveGroups = this.progressiveGroups || [];
        this.progressiveGroups.push(groupData);
        
        // Create group item
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        groupItem.dataset.groupId = groupData.id;
        groupItem.style.opacity = '0';
        groupItem.style.transform = 'translateY(10px)';
        groupItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        const isSelected = this.selectedGroups.has(groupData.id);
        if (isSelected) {
            groupItem.classList.add('selected');
        }

        groupItem.innerHTML = `
            <input type="checkbox" class="group-checkbox" ${isSelected ? 'checked' : ''}>
            <div class="group-info">
                <div class="group-name">${this.escapeHtml(groupData.name)}</div>
                <div class="group-meta">
                    👥 ${groupData.participantCount} members
                    ${groupData.description ? ` • ${this.escapeHtml(groupData.description.substring(0, 50))}${groupData.description.length > 50 ? '...' : ''}` : ''}
                </div>
            </div>
        `;

        groupItem.addEventListener('click', () => {
            this.toggleGroupSelection(groupData.id);
        });

        progressiveGroupsList.appendChild(groupItem);
        
        // Animate in
        setTimeout(() => {
            groupItem.style.opacity = '1';
            groupItem.style.transform = 'translateY(0)';
        }, 50);
    }

    finishGroupLoading(groups) {
        // Hide loading indicator
        const loadingContainer = document.getElementById('groups-loading-container');
        if (loadingContainer) {
            loadingContainer.style.display = 'none';
        }
        
        // Store the final sorted groups
        this.allGroups = groups;
        
        // Re-enable controls
        document.getElementById('group-search').disabled = false;
        document.getElementById('min-members-filter').disabled = false;
        document.getElementById('clear-selection-btn').disabled = false;
        
        // Apply current filters to the loaded groups
        this.applyFilters();
        
        // Update selection count
        this.updateSelectionCount();
        
        console.log(`✅ Progressive loading complete: ${groups.length} groups loaded`);
    }

    // Cleanup method
    destroy() {
        // Remove all Electron event listeners
        window.electronAPI.removeAllListeners('auth-status');
        window.electronAPI.removeAllListeners('progress-update');
        window.electronAPI.removeAllListeners('crawl-progress');
        window.electronAPI.removeAllListeners('group-loading-progress');
        window.electronAPI.removeAllListeners('group-loaded');
        window.electronAPI.removeAllListeners('groups-loading-complete');
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WhatsAppCollectorApp();
});

// Cleanup when the window is about to be closed
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});
