/**
 * Real-time Data Synchronization Manager
 * Handles real-time updates between frontend and backend
 */

class RealtimeManager {
    constructor() {
        this.subscribed = false;
        this.subscriberId = 'main_' + Date.now();
        this.eventHandlers = new Map();
        this.lastSyncData = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // Initialize event handlers
        this.initEventHandlers();
        
        // Auto-subscribe when bridge is available
        this.waitForBridgeAndSubscribe();
    }
    
    initEventHandlers() {
        // Register default event handlers
        this.on('attempt_logged', (data) => {
            console.log('📊 New attempt logged:', data);
            this.updateStatsDisplay();
            this.updateProgressIndicators();
        });
        
        this.on('session_completed', (data) => {
            console.log('🎯 Session completed:', data);
            this.updateStatsDisplay();
            this.checkAchievements();
        });
        
        this.on('data_imported', (data) => {
            console.log('📥 Data imported:', data);
            this.refreshAllData();
        });
        
        this.on('daily_goal_updated', (data) => {
            console.log('🎯 Daily goal updated:', data);
            this.updateDailyGoalsDisplay();
        });
    }
    
    waitForBridgeAndSubscribe() {
        const checkInterval = setInterval(() => {
            if (window.pythonBridge) {
                clearInterval(checkInterval);
                this.subscribe();
            } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`⏳ Waiting for bridge... attempt ${this.reconnectAttempts}`);
            } else {
                clearInterval(checkInterval);
                console.warn('❌ Bridge not available after multiple attempts');
            }
        }, this.reconnectDelay);
    }
    
    async subscribe() {
        if (!window.pythonBridge || this.subscribed) {
            return;
        }
        
        try {
            const response = await this.callBridge('subscribe_realtime', {
                subscriber_id: this.subscriberId
            });
            
            if (response && response.subscriber_id) {
                this.subscribed = true;
                this.lastSyncData = response.last_data;
                console.log('✅ Subscribed to real-time updates');
                
                // Process any pending data
                if (this.lastSyncData) {
                    this.handleSync(this.lastSyncData);
                }
            }
        } catch (error) {
            console.error('❌ Failed to subscribe to real-time updates:', error);
        }
    }
    
    async unsubscribe() {
        if (!window.pythonBridge || !this.subscribed) {
            return;
        }
        
        try {
            await this.callBridge('unsubscribe_realtime', {});
            this.subscribed = false;
            console.log('✅ Unsubscribed from real-time updates');
        } catch (error) {
            console.error('❌ Failed to unsubscribe:', error);
        }
    }
    
    handleSync(syncData) {
        if (!syncData || !syncData.event_type) {
            return;
        }
        
        console.log('🔄 Processing real-time sync:', syncData.event_type);
        
        this.lastSyncData = syncData;
        
        // Trigger registered event handlers
        const handlers = this.eventHandlers.get(syncData.event_type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(syncData.data);
                } catch (error) {
                    console.error('❌ Error in sync event handler:', error);
                }
            });
        }
        
        // Trigger global update handlers
        this.triggerGlobalUpdates(syncData);
    }
    
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, new Set());
        }
        this.eventHandlers.get(eventType).add(handler);
    }
    
    off(eventType, handler) {
        if (this.eventHandlers.has(eventType)) {
            this.eventHandlers.get(eventType).delete(handler);
        }
    }
    
    triggerGlobalUpdates(syncData) {
        // Update any global UI elements that should refresh on any data change
        this.updateStatsDisplay();
        this.updateProgressIndicators();
        
        // If we're on progress page, refresh charts
        if (window.location.pathname.includes('progress.html') || window.progressPage) {
            if (window.progressPage && window.progressPage.refreshData) {
                window.progressPage.refreshData();
            }
        }
    }
    
    updateStatsDisplay() {
        // Update main stats if on main page
        if (window.mathDrill && window.mathDrill.updateStats) {
            window.mathDrill.updateStats();
        }
    }
    
    updateProgressIndicators() {
        // Update any progress bars or indicators
        const progressElements = document.querySelectorAll('[data-progress-indicator]');
        progressElements.forEach(element => {
            // Trigger any custom update logic
            const event = new CustomEvent('progressUpdate', {
                detail: this.lastSyncData
            });
            element.dispatchEvent(event);
        });
    }
    
    updateDailyGoalsDisplay() {
        // Update daily goals if on settings or main page
        if (window.mathDrill && window.mathDrill.updateDailyGoals) {
            window.mathDrill.updateDailyGoals();
        }
    }
    
    checkAchievements() {
        // Check for new achievements
        if (window.mathDrill && window.mathDrill.checkAchievements) {
            window.mathDrill.checkAchievements();
        }
    }
    
    refreshAllData() {
        // Refresh all data displays
        this.updateStatsDisplay();
        this.updateProgressIndicators();
        this.updateDailyGoalsDisplay();
        
        // If on progress page, refresh all sections
        if (window.progressPage && window.progressPage.loadProgressData) {
            window.progressPage.loadProgressData();
        }
    }
    
    async callBridge(action, data = {}) {
        return new Promise((resolve, reject) => {
            if (!window.pythonBridge) {
                reject(new Error('Python bridge not available'));
                return;
            }
            
            const callbackId = 'rt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Set up callback
            window.pythonBridge.callbacks = window.pythonBridge.callbacks || {};
            window.pythonBridge.callbacks[callbackId] = (response) => {
                resolve(response);
            };
            
            // Set timeout
            setTimeout(() => {
                if (window.pythonBridge.callbacks && window.pythonBridge.callbacks[callbackId]) {
                    delete window.pythonBridge.callbacks[callbackId];
                    reject(new Error('Bridge call timeout'));
                }
            }, 5000);
            
            // Make the call
            window.pythonBridge.send(action, JSON.stringify(data), callbackId);
        });
    }
    
    // Utility methods for specific real-time operations
    
    async getDailyGoals() {
        try {
            const response = await this.callBridge('get_daily_goals', {});
            return response;
        } catch (error) {
            console.error('❌ Failed to get daily goals:', error);
            return null;
        }
    }
    
    async setDailyGoals(targetQuestions, targetTimeMinutes) {
        try {
            const response = await this.callBridge('set_daily_goals', {
                target_questions: targetQuestions,
                target_time_minutes: targetTimeMinutes
            });
            return response;
        } catch (error) {
            console.error('❌ Failed to set daily goals:', error);
            return null;
        }
    }
    
    async exportData(includeAttempts = true, includeSessions = true) {
        try {
            const response = await this.callBridge('export_data', {
                include_attempts: includeAttempts,
                include_sessions: includeSessions
            });
            return response;
        } catch (error) {
            console.error('❌ Failed to export data:', error);
            return null;
        }
    }
    
    async importData(data, merge = true) {
        try {
            const response = await this.callBridge('import_data', {
                data: data,
                merge: merge
            });
            return response;
        } catch (error) {
            console.error('❌ Failed to import data:', error);
            return null;
        }
    }
    
    // Status and debugging methods
    
    getStatus() {
        return {
            subscribed: this.subscribed,
            subscriberId: this.subscriberId,
            lastSyncData: this.lastSyncData,
            eventHandlersCount: Array.from(this.eventHandlers.values())
                .reduce((total, handlers) => total + handlers.size, 0)
        };
    }
    
    debugInfo() {
        console.group('🔍 Real-time Manager Debug Info');
        console.log('Status:', this.getStatus());
        console.log('Event Handlers:', Array.from(this.eventHandlers.keys()));
        console.log('Last Sync Data:', this.lastSyncData);
        console.groupEnd();
    }
}

// Global instance
window.realtimeManager = new RealtimeManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealtimeManager;
}
