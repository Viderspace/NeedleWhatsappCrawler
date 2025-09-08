// app.js - Frontend JavaScript for WhatsApp Data Collector Native Runner

class WhatsAppCollectorApp {
    constructor() {
        this.currentScreen = 'welcome-screen';
        this.selectedGroups = new Set();
        this.allGroups = [];
        this.isConnected = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupHealthMonitoring();
        this.setupSyncMonitoring();
        this.showScreen('welcome-screen');
    }

    setupEventListeners() {
        // Welcome screen
        document.getElementById('start-connect-btn').addEventListener('click', () => {
            this.startConnection();
        });

        document.getElementById('test-browser-btn').addEventListener('click', () => {
            this.testBrowser();
        });

        document.getElementById('clear-session-btn').addEventListener('click', () => {
            this.clearSession();
        });

        // Connection screen
        document.getElementById('cancel-connection-btn').addEventListener('click', () => {
            this.showScreen('welcome-screen');
        });

        // Groups screen
        document.getElementById('group-search').addEventListener('input', () => {
            this.applyFilters();
        });

        document.getElementById('min-members-filter').addEventListener('input', () => {
            this.applyFilters();
        });

        document.getElementById('select-all-btn').addEventListener('click', () => {
            this.selectAllShown();
        });

        document.getElementById('clear-selection-btn').addEventListener('click', () => {
            this.clearSelection();
        });


        document.getElementById('export-selected-btn').addEventListener('click', () => {
            this.startExport();
        });

        // Results screen
        document.getElementById('open-exports-btn').addEventListener('click', () => {
            this.openExportsFolder();
        });

        document.getElementById('export-more-btn').addEventListener('click', () => {
            this.showScreen('groups-screen');
        });

        document.getElementById('start-over-btn').addEventListener('click', () => {
            this.startOver();
        });
    }

    setupHealthMonitoring() {
        this.updateHealthStatus();
        setInterval(() => this.updateHealthStatus(), 5000);
    }

    setupSyncMonitoring() {
        // Poll sync status every 2 seconds
        this.syncMonitorInterval = setInterval(() => this.updateSyncStatus(), 2000);
    }

    async updateHealthStatus() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            if (data.ok) {
                document.getElementById('healthDot').className = 'health-dot';
                document.getElementById('healthText').textContent = 'Server Online';
            } else {
                throw new Error('Server not healthy');
            }
        } catch (error) {
            document.getElementById('healthDot').className = 'health-dot error';
            document.getElementById('healthText').textContent = 'Server Error';
        }
    }

    async updateSyncStatus() {
        try {
            const response = await fetch('/api/sync-status');
            const syncData = await response.json();
            
            this.handleSyncStatus(syncData);
        } catch (error) {
            // Silently fail - sync status is not critical
            console.log('Sync status check failed:', error.message);
        }
    }

    handleSyncStatus(syncData) {
        const syncIndicator = document.getElementById('sync-indicator');
        if (!syncIndicator) return; // Element doesn't exist yet
        
        if (syncData.isSyncing) {
            // Show real sync detection based on file system monitoring
            const duration = syncData.currentSyncDuration || '0';
            syncIndicator.innerHTML = `
                <div class="sync-status syncing">
                    <div class="sync-spinner"></div>
                    <div class="sync-text">
                        <div class="sync-main">🔄 Syncing messages with WhatsApp Web</div>
                        <div class="sync-sub">Keep both phone and WhatsApp Web active (${duration}s)</div>
                    </div>
                </div>
            `;
            syncIndicator.style.display = 'block';
        } else if (syncData.status === 'connected') {
            // Show brief connected status, then hide
            syncIndicator.innerHTML = `
                <div class="sync-status connected">
                    <div class="sync-text">
                        <div class="sync-main">✅ WhatsApp Connected</div>
                        <div class="sync-sub">Monitoring for background sync activity</div>
                    </div>
                </div>
            `;
            syncIndicator.style.display = 'block';
            
            // Hide after 5 seconds if not syncing
            setTimeout(() => {
                if (syncIndicator && !syncData.isSyncing) {
                    syncIndicator.style.display = 'none';
                }
            }, 5000);
        } else if (syncData.status === 'pairing') {
            syncIndicator.innerHTML = `
                <div class="sync-status syncing">
                    <div class="sync-spinner"></div>
                    <div class="sync-text">
                        <div class="sync-main">📲 Pairing with WhatsApp...</div>
                        <div class="sync-sub">Scan QR code with your phone</div>
                    </div>
                </div>
            `;
            syncIndicator.style.display = 'block';
        } else if (syncData.status === 'unpaired') {
            syncIndicator.innerHTML = `
                <div class="sync-status syncing">
                    <div class="sync-text">
                        <div class="sync-main">🔓 WhatsApp disconnected</div>
                        <div class="sync-sub">Scan QR code to reconnect</div>
                    </div>
                </div>
            `;
            syncIndicator.style.display = 'block';
        } else {
            syncIndicator.style.display = 'none';
        }
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

    updateConnectionStatus(message) {
        document.getElementById('connection-status-text').textContent = message;
    }

    async startConnection() {
        this.showScreen('connection-screen');
        this.updateConnectionStatus('Initializing WhatsApp connection...');

        try {
            // First focus any existing window
            await this.focusWhatsApp();
            
            this.updateConnectionStatus('Connecting to WhatsApp and loading groups...');
            
            // Switch to groups screen early and show progressive loading
            this.showGroupsScreen();
            this.showProgressiveLoading();
            
            // Use Server-Sent Events for progressive loading
            await this.loadGroupsProgressively();
            
        } catch (error) {
            console.error('Connection error:', error);
            this.updateConnectionStatus(`Connection error: ${error.message}`);
            setTimeout(() => {
                this.showScreen('welcome-screen');
            }, 3000);
        }
    }

    async loadGroupsProgressively() {
        return new Promise((resolve, reject) => {
            // Set up EventSource for Server-Sent Events
            const eventSource = new EventSource('/api/chats');
            this.allGroups = [];
            
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case 'group-loaded':
                            // Add group to display immediately
                            this.addGroupProgressively(data.group);
                            this.updateProgressiveStats(data.current, data.total, data.percentage);
                            break;
                            
                        case 'loading-complete':
                            // Store final sorted groups
                            this.allGroups = data.groups;
                            this.finishProgressiveLoading();
                            eventSource.close();
                            resolve();
                            break;
                            
                        case 'complete':
                            // Fallback completion
                            this.allGroups = data.chats || [];
                            this.finishProgressiveLoading();
                            eventSource.close();
                            resolve();
                            break;
                            
                        case 'error':
                            console.error('Progressive loading error:', data.message);
                            eventSource.close();
                            reject(new Error(data.message));
                            break;
                    }
                } catch (error) {
                    console.error('Error parsing SSE data:', error);
                }
            };
            
            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                eventSource.close();
                
                // Fallback to regular fetch
                this.loadGroupsFallback().then(resolve).catch(reject);
            };
        });
    }

    async loadGroupsFallback() {
        console.log('📋 Falling back to regular loading...');
        const response = await fetch('/api/chats');
        const data = await response.json();
        
        if (data.success) {
            this.allGroups = data.chats || [];
            this.isConnected = true;
            this.renderGroups(this.allGroups);
            this.updateSelectionCount();
        } else {
            throw new Error(data.message);
        }
    }

    showGroupsScreen() {
        this.showScreen('groups-screen');
        this.renderGroups(this.allGroups);
        this.updateSelectionCount();
    }

    showProgressiveLoading() {
        const groupsList = document.getElementById('groups-list');
        groupsList.innerHTML = `
            <div id="progressive-loading-container" class="loading-container">
                <div class="spinner" style="margin: 0 auto 1rem auto; width: 40px; height: 40px;"></div>
                <h3>Loading Groups...</h3>
                <div id="progressive-loading-bar" class="loading-progress-bar" style="width: 100%; max-width: 300px; margin: 1rem auto; background: rgba(102, 126, 234, 0.2); border-radius: 10px; height: 8px;">
                    <div id="progressive-loading-fill" class="loading-progress-fill" style="width: 0%; height: 100%; background: #667eea; border-radius: 10px; transition: width 0.3s ease;"></div>
                </div>
                <p id="progressive-loading-status" style="color: #718096; margin-top: 0.5rem;">
                    Fetching your WhatsApp groups and member counts...
                </p>
                <p id="progressive-loading-counter" style="color: #4a5568; font-weight: 500; margin-top: 0.5rem;">
                    0 groups loaded
                </p>
            </div>
            <div id="progressive-groups-container" style="padding: 0.5rem;">
                <!-- Groups will appear here progressively -->
            </div>
        `;
        
        // Disable controls while loading
        document.getElementById('group-search').disabled = true;
        document.getElementById('min-members-filter').disabled = true;
        document.getElementById('select-all-btn').disabled = true;
        document.getElementById('clear-selection-btn').disabled = true;
        document.getElementById('export-selected-btn').disabled = true;
    }

    addGroupProgressively(group) {
        const progressiveContainer = document.getElementById('progressive-groups-container');
        if (!progressiveContainer) return;
        
        // Create group item
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        groupItem.dataset.groupId = group.id;
        groupItem.style.opacity = '0';
        groupItem.style.transform = 'translateY(10px)';
        groupItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        const isSelected = this.selectedGroups.has(group.id);
        if (isSelected) {
            groupItem.classList.add('selected');
        }

        // Detect Hebrew text and set direction
        const hasHebrew = /[\u0590-\u05FF]/.test(group.title);
        const dirAttribute = hasHebrew ? 'dir="rtl"' : '';
        
        const participantCount = group.participantCount || 0;
        const typeLabel = group.type === 'group' ? '👥' : '💬';
        
        groupItem.innerHTML = `
            <input type="checkbox" class="group-checkbox" ${isSelected ? 'checked' : ''}>
            <div class="group-info">
                <div class="group-name" ${dirAttribute}>${this.escapeHtml(group.title)}</div>
                <div class="group-meta">
                    ${typeLabel} ${participantCount} ${group.type === 'group' ? 'members' : 'participants'}
                </div>
            </div>
        `;

        groupItem.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                this.toggleGroupSelection(group.id);
            }
        });

        const checkbox = groupItem.querySelector('.group-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleGroupSelection(group.id);
        });

        progressiveContainer.appendChild(groupItem);
        
        // Animate in
        setTimeout(() => {
            groupItem.style.opacity = '1';
            groupItem.style.transform = 'translateY(0)';
        }, 50);
        
        // Add to allGroups for immediate filtering
        this.allGroups.push(group);
    }

    updateProgressiveStats(current, total, percentage) {
        const progressFill = document.getElementById('progressive-loading-fill');
        const loadingStatus = document.getElementById('progressive-loading-status');
        const loadingCounter = document.getElementById('progressive-loading-counter');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (loadingStatus) {
            loadingStatus.textContent = `Loading groups...`;
        }
        
        if (loadingCounter) {
            loadingCounter.textContent = `${current}/${total} groups loaded`;
        }
    }

    finishProgressiveLoading() {
        // Hide loading indicator
        const loadingContainer = document.getElementById('progressive-loading-container');
        if (loadingContainer) {
            loadingContainer.style.display = 'none';
        }
        
        // Re-enable controls
        document.getElementById('group-search').disabled = false;
        document.getElementById('min-members-filter').disabled = false;
        document.getElementById('select-all-btn').disabled = false;
        document.getElementById('clear-selection-btn').disabled = false;
        
        // Clear the progressive loading display and re-render with proper sorting
        const progressiveContainer = document.getElementById('progressive-loading-groups');
        if (progressiveContainer) {
            progressiveContainer.innerHTML = '';
        }
        
        // Apply current filters to the loaded groups (this will re-render in correct order)
        this.applyFilters();
        
        // Update selection count
        this.updateSelectionCount();
        this.isConnected = true;
        
        console.log(`✅ Progressive loading complete: ${this.allGroups.length} groups loaded and sorted by active status and member count`);
    }

    renderGroups(groups) {
        const groupsList = document.getElementById('groups-list');
        groupsList.innerHTML = '';

        if (groups.length === 0) {
            groupsList.innerHTML = `
                <div class="loading-container">
                    <p>No WhatsApp groups found.</p>
                    <p>Make sure you're part of some groups and try reconnecting.</p>
                </div>
            `;
            return;
        }

        // sort groups by (primary) active status and (secondary) member count (highest first)
        groups.sort((a, b) => {
            if (a.isActive !== b.isActive) {
                return a.isActive ? -1 : 1;
            }
            return b.participantCount - a.participantCount;
        });

        groups.forEach(group => {
            const groupItem = document.createElement('div');
            groupItem.className = 'group-item';
            groupItem.dataset.groupId = group.id;

            const isSelected = this.selectedGroups.has(group.id);
            if (isSelected) {
                groupItem.classList.add('selected');
            }

            // Check if group is inactive
            const isInactive = group.isActive === false;
            if (isInactive) {
                groupItem.classList.add('inactive');
            }

            // Estimate participant count for display
            const participantCount = group.participantCount || 0;
            const typeLabel = group.type === 'group' ? '👥' : '💬';
            
            // Detect if title contains Hebrew characters and set direction
            const hasHebrew = /[\u0590-\u05FF]/.test(group.title);
            const dirAttribute = hasHebrew ? 'dir="rtl"' : '';
            
            // Create status indicators
            const inactiveIndicator = isInactive ? 
                `<div class="inactive-indicator" title="${group.inactiveReason || 'Unloaded group'}">⚠️ Unloaded</div>` : '';
            
            const manyMessagesIndicator = group.hasManyMessages ? 
                `<div class="many-messages-indicator" title="50+ messages available">📚 50+ messages</div>` : '';
            
            groupItem.innerHTML = `
                <input type="checkbox" class="group-checkbox" ${isSelected ? 'checked' : ''} ${isInactive ? 'disabled' : ''}>
                <div class="group-info">
                    <div class="group-name" ${dirAttribute}>${this.escapeHtml(group.title)}</div>
                    <div class="group-meta">
                        ${typeLabel} ${participantCount} ${group.type === 'group' ? 'members' : 'participants'}
                        ${inactiveIndicator}
                        ${manyMessagesIndicator}
                    </div>
                </div>
            `;

            groupItem.addEventListener('click', (e) => {
                // Don't toggle if clicking directly on checkbox
                if (e.target.type !== 'checkbox') {
                    this.toggleGroupSelection(group.id);
                }
            });

            // Handle checkbox clicks
            const checkbox = groupItem.querySelector('.group-checkbox');
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleGroupSelection(group.id);
            });

            groupsList.appendChild(groupItem);
        });

        this.updateGroupsShownCount(groups.length);
    }

    toggleGroupSelection(groupId) {
        const groupItem = document.querySelector(`[data-group-id="${groupId}"]`);
        const checkbox = groupItem.querySelector('.group-checkbox');

        // Don't allow selection of inactive groups
        if (groupItem.classList.contains('inactive')) {
            console.log('Cannot select inactive group');
            return;
        }

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

    selectAllShown() {
        const visibleItems = document.querySelectorAll('.group-item');
        visibleItems.forEach(item => {
            const groupId = item.dataset.groupId;
            if (!this.selectedGroups.has(groupId)) {
                this.toggleGroupSelection(groupId);
            }
        });
    }

    clearSelection() {
        this.selectedGroups.clear();
        this.applyFilters(); // Re-render to update checkboxes
    }

    updateSelectionCount() {
        document.getElementById('selected-count').textContent = this.selectedGroups.size;
        document.getElementById('export-selected-btn').disabled = this.selectedGroups.size === 0;
    }

    updateGroupsShownCount(count) {
        document.getElementById('groups-shown-count').textContent = count;
    }

    applyFilters() {
        const searchTerm = document.getElementById('group-search').value.toLowerCase();
        const minMembers = parseInt(document.getElementById('min-members-filter').value) || 0;
        
        const filtered = this.allGroups.filter(group => {
            // Search filter
            const matchesSearch = group.title.toLowerCase().includes(searchTerm);
            
            // Members filter
            const hasEnoughMembers = (group.participantCount || 0) >= minMembers;
            
            return matchesSearch && hasEnoughMembers;
        });
        
        // Note: We don't re-sort here because the backend already sorted the groups
        // by active status (primary) and member count (secondary)
        this.renderGroups(filtered);
        this.updateSelectionCount(); // Update counts after filtering
    }

    async startExport() {
        if (this.selectedGroups.size === 0) {
            alert('Please select at least one group to export.');
            return;
        }

        this.showScreen('export-progress-screen');
        this.updateExportProgress('Initializing export...', 0, this.selectedGroups.size);
        this.clearShellOutput();

        try {
            const selectedGroupIds = Array.from(this.selectedGroups);
            
            // Use Server-Sent Events for streaming output
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ chatIds: selectedGroupIds })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let completed = 0;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'output') {
                                // Stream console output to UI
                                this.addShellOutput(data.message, data.level);
                                
                                // Update progress based on console messages
                                this.updateProgressFromOutput(data.message, completed, selectedGroupIds.length);
                            } else if (data.type === 'complete') {
                                // Export finished
                                this.showResults(data.results);
                                return;
                            } else if (data.type === 'error') {
                                // Export failed
                                this.addShellOutput(`❌ Export failed: ${data.error}`, 'error');
                                setTimeout(() => {
                                    this.showScreen('groups-screen');
                                }, 2000);
                                return;
                            }
                        } catch (parseError) {
                            console.error('Error parsing SSE data:', parseError);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('Export error:', error);
            this.addShellOutput(`❌ Export error: ${error.message}`, 'error');
            setTimeout(() => {
                this.showScreen('groups-screen');
            }, 2000);
        }
    }

    updateExportProgress(message, current, total) {
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        
        document.getElementById('export-progress-bar-fill').style.width = `${percentage}%`;
        document.getElementById('export-progress-percentage').textContent = `${percentage}%`;
        document.getElementById('export-progress-status-text').textContent = message;
        document.getElementById('export-progress-counter').textContent = `${current}/${total}`;
        
        // Extract group name from message if possible
        const groupMatch = message.match(/Exporting (.+?)\.{3}/);
        if (groupMatch) {
            document.getElementById('current-export-group').textContent = groupMatch[1];
        }
    }

    // Shell output management
    clearShellOutput() {
        const shellOutput = document.getElementById('shell-output');
        if (shellOutput) {
            shellOutput.innerHTML = '';
        }
    }

    addShellOutput(message, level = 'log') {
        const shellOutput = document.getElementById('shell-output');
        if (!shellOutput) return;

        const timestamp = new Date().toLocaleTimeString();
        const levelClass = level === 'error' ? 'shell-error' : 'shell-log';
        
        const outputLine = document.createElement('div');
        outputLine.className = `shell-line ${levelClass}`;
        outputLine.innerHTML = `
            <span class="shell-timestamp">[${timestamp}]</span>
            <span class="shell-message">${this.escapeHtml(message)}</span>
        `;
        
        shellOutput.appendChild(outputLine);
        shellOutput.scrollTop = shellOutput.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Update progress based on console output
    updateProgressFromOutput(message, currentCompleted, total) {
        // Look for completion indicators in console output
        if (message.includes('✅ Successfully exported')) {
            currentCompleted++;
            this.updateExportProgress(`Completed ${currentCompleted}/${total} groups`, currentCompleted, total);
        } else if (message.includes('📂 Chat name:')) {
            // Extract group name from "📂 Chat name: GroupName"
            const nameMatch = message.match(/📂 Chat name: (.+)/);
            if (nameMatch) {
                this.updateExportProgress(`Processing: ${nameMatch[1]}`, currentCompleted, total);
            }
        } else if (message.includes('📦 Starting export for')) {
            // Extract total count from "📦 Starting export for X chats..."
            const countMatch = message.match(/📦 Starting export for (\d+) chats/);
            if (countMatch) {
                this.updateExportProgress(`Starting export of ${countMatch[1]} groups...`, 0, parseInt(countMatch[1]));
            }
        }
    }

    showResults(results) {
        this.showScreen('results-screen');

        // Calculate statistics
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;

        // Update summary stats
        document.getElementById('total-exported-groups').textContent = results.length;
        document.getElementById('successful-exports').textContent = successful;
        document.getElementById('failed-exports').textContent = failed;

        // Show export files
        this.renderExportFiles(results.filter(r => r.success));
    }

    renderExportFiles(results) {
        const filesList = document.getElementById('export-files-list');
        filesList.innerHTML = '';

        if (results.length === 0) {
            filesList.innerHTML = `
                <div style="text-align: center; padding: 1rem; color: #718096;">
                    No files were successfully exported.
                </div>
            `;
            return;
        }

        results.forEach(result => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            fileItem.innerHTML = `
                <div>
                    <div class="file-name">📄 ${this.escapeHtml(result.chatName)}.json</div>
                    <div class="file-meta">
                        <strong>📊 ${result.messageCount} messages</strong> • 
                        👥 ${result.participantCount} participants • 
                        📁 Saved to Downloads/WhatsApp Data
                    </div>
                </div>
            `;

            filesList.appendChild(fileItem);
        });
    }

    async testBrowser() {
        try {
            const response = await fetch('/api/open?url=https://example.com');
            const data = await response.json();
            
            if (data.success) {
                this.showStatus('✅ Browser test successful!', false);
            } else {
                this.showStatus('❌ Browser test failed', true);
            }
        } catch (error) {
            this.showStatus('❌ Error: ' + error.message, true);
        }
    }

    async clearSession() {
        try {
            const response = await fetch('/api/session/clear', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                this.showStatus('✅ Session cleared successfully!', false);
                this.isConnected = false;
                this.selectedGroups.clear();
                this.allGroups = [];
            } else {
                this.showStatus('❌ Failed to clear session', true);
            }
        } catch (error) {
            this.showStatus('❌ Error: ' + error.message, true);
        }
    }

    async focusWhatsApp() {
        try {
            const response = await fetch('/api/focus', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                console.log('🔍 WhatsApp window focused');
            }
        } catch (error) {
            console.error('Focus error:', error);
        }
    }

    async openExportsFolder() {
        try {
            const response = await fetch('/api/open-exports', { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                console.log('📂 Opening exports folder:', data.path);
                // Show a brief confirmation
                this.showStatus('📂 Opening Downloads/WhatsApp Data folder...', false);
            } else {
                alert(`Could not open exports folder: ${data.message}\n\nFiles are saved at: ~/Downloads/WhatsApp Data/`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Export files are saved in your Downloads/WhatsApp Data folder.\n\nYou can find them at:\n~/Downloads/WhatsApp Data/');
        }
    }

    startOver() {
        // Reset selections but keep connection
        this.selectedGroups.clear();
        document.getElementById('group-search').value = '';
        document.getElementById('min-members-filter').value = '5';
        
        if (this.isConnected && this.allGroups.length > 0) {
            this.showGroupsScreen();
        } else {
            this.showScreen('welcome-screen');
        }
    }

    showStatus(message, isError = false) {
        // For now, just use console.log and temporary alerts
        // In a real implementation, you might want to show toast notifications
        console.log(message);
        if (isError) {
            console.error(message);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WhatsAppCollectorApp();
});

// Cleanup when the window is about to be closed
window.addEventListener('beforeunload', () => {
    if (window.app) {
        // Any cleanup needed
    }
});
