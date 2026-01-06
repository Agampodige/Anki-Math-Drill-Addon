class SettingsManager {
    constructor() {
        this.settings = this.getDefaultSettings();
        this.bridgeAvailable = false;

        // Initial load from localStorage (fast)
        this.loadFromLocalStorage();

        // Initialize UI and sync with backend
        this.init();
    }

    async init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        // Try to sync with Python
        await this.syncWithBackend();

        this.initializeSettings();
    }

    async syncWithBackend() {
        if (!window.pythonBridge) {
            console.log('🐍 Python bridge not available, using localStorage only');
            return;
        }

        this.bridgeAvailable = true;
        console.log('🐍 Syncing settings with Python backend...');

        try {
            const data = await this.sendToPythonAsync('get_settings');
            if (data && Object.keys(data).length > 0) {
                console.log('✅ Settings received from Python:', data);
                // Merge Python settings into current settings
                this.settings = { ...this.settings, ...data };
                // Also update localStorage to stay in sync
                localStorage.setItem('mathDrillSettings', JSON.stringify(this.settings));
                this.notifySettingsChanged();
            }
        } catch (error) {
            console.error('❌ Error syncing with Python:', error);
        }
    }

    sendToPythonAsync(action, data = {}) {
        return new Promise((resolve, reject) => {
            const callbackId = `cb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

            const handler = (event) => {
                if (event.detail && event.detail.callbackId === callbackId) {
                    window.removeEventListener(`python_${action}_result`, handler);
                    resolve(event.detail.data);
                }
            };

            window.addEventListener(`python_${action}_result`, handler);

            // Timeout after 2 seconds
            setTimeout(() => {
                window.removeEventListener(`python_${action}_result`, handler);
                reject(new Error(`Bridge timeout for ${action}`));
            }, 2000);

            if (window.pythonBridge && window.pythonBridge.send) {
                window.pythonBridge.send(action, JSON.stringify(data), callbackId);
            } else {
                reject(new Error('Python bridge not available'));
            }
        });
    }

    // Load settings from localStorage
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('mathDrillSettings');
            if (saved) {
                this.settings = { ...this.getDefaultSettings(), ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Error loading settings from localStorage:', error);
        }
    }

    // Load settings (legacy/compatibility)
    loadSettings() {
        return this.settings;
    }

    // Save settings to localStorage and Python
    async saveSettings() {
        try {
            // Save to localStorage
            localStorage.setItem('mathDrillSettings', JSON.stringify(this.settings));

            // Save to Python if available
            if (window.pythonBridge) {
                console.log('🐍 Saving settings to Python backend...');
                window.pythonBridge.send('save_settings', JSON.stringify(this.settings), `save_${Date.now()}`);
            }

            this.notifySettingsChanged();
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    // Initialize UI elements with current settings
    initializeSettings() {
        // Only initialize UI elements if we're on the settings page
        if (window.location.pathname.includes('settings.html')) {
            // Theme
            this.updateThemeToggle();
            this.updateThemeColor();
            // Apply theme color immediately on load
            this.applyThemeColor(this.settings.themeColor);

            // Sound
            this.updateToggle('soundToggle', this.settings.sound);

            // Hints
            this.updateToggle('hintsToggle', this.settings.hints);

            // Difficulty
            const diffSelect = document.getElementById('difficultySelect');
            if (diffSelect) {
                diffSelect.value = this.settings.difficulty;
            }

            // Timer
            this.updateToggle('timerToggle', this.settings.timer);

            // Animations
            this.updateToggle('animationsToggle', this.settings.animations);

            // Autosave
            this.updateToggle('autosaveToggle', this.settings.autosave);

            // Shortcuts
            this.updateToggle('shortcutsToggle', this.settings.shortcuts);
        }
    }

    // Update toggle switch UI
    updateToggle(elementId, isActive) {
        const element = document.getElementById(elementId);
        if (element) {
            console.log(`Updating toggle ${elementId} to ${isActive}`);
            if (isActive) {
                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
        } else {
            console.warn(`Element ${elementId} not found`);
        }
    }

    // Update theme toggle
    updateThemeToggle() {
        const isDark = this.settings.theme === 'dark';
        this.updateToggle('themeToggle', isDark);
        document.documentElement.setAttribute('data-theme', this.settings.theme);
    }

    // Update theme color
    updateThemeColor() {
        // Update selected state of color options
        document.querySelectorAll('.color-option').forEach(option => {
            if (option.dataset.color === this.settings.themeColor) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });

        // Apply the color to CSS variables
        this.applyThemeColor(this.settings.themeColor);
    }

    // Apply theme color to CSS variables
    applyThemeColor(color) {
        const root = document.documentElement;
        const colors = {
            green: {
                primary: '#10B981',
                primaryHover: '#059669',
                primaryLight: '#D1FAE5',
                gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
            },
            blue: {
                primary: '#3B82F6',
                primaryHover: '#2563EB',
                primaryLight: '#DBEAFE',
                gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
            },
            purple: {
                primary: '#8B5CF6',
                primaryHover: '#7C3AED',
                primaryLight: '#EDE9FE',
                gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)'
            },
            red: {
                primary: '#EF4444',
                primaryHover: '#DC2626',
                primaryLight: '#FEE2E2',
                gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
            }
        };

        const selectedColor = colors[color] || colors.green;

        // Update CSS variables
        root.style.setProperty('--primary', selectedColor.primary);
        root.style.setProperty('--primary-hover', selectedColor.primaryHover);
        root.style.setProperty('--primary-light', selectedColor.primaryLight);
        root.style.setProperty('--primary-gradient', selectedColor.gradient);

        console.log(`Applied theme color ${color}:`, selectedColor);
    }

    // Theme methods
    toggleTheme() {
        console.log('Toggling theme');
        this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
        this.updateThemeToggle();
        this.saveSettings();
    }

    setThemeColor(color) {
        console.log('Setting theme color to:', color);
        this.settings.themeColor = color;
        this.updateThemeColor();
        this.saveSettings();
    }

    // Sound methods
    toggleSound() {
        console.log('Toggling sound');
        this.settings.sound = !this.settings.sound;
        this.updateToggle('soundToggle', this.settings.sound);
        this.saveSettings();
    }

    // Hints methods
    toggleHints() {
        console.log('Toggling hints');
        this.settings.hints = !this.settings.hints;
        this.updateToggle('hintsToggle', this.settings.hints);
        this.saveSettings();
    }

    // Difficulty methods
    setDifficulty(difficulty) {
        this.settings.difficulty = difficulty;
        this.saveSettings();
    }

    // Timer methods
    toggleTimer() {
        console.log('Toggling timer');
        this.settings.timer = !this.settings.timer;
        this.updateToggle('timerToggle', this.settings.timer);
        this.saveSettings();
    }

    // Animations methods
    toggleAnimations() {
        console.log('Toggling animations');
        this.settings.animations = !this.settings.animations;
        this.updateToggle('animationsToggle', this.settings.animations);
        this.saveSettings();
    }

    // Autosave methods
    toggleAutosave() {
        console.log('Toggling autosave');
        this.settings.autosave = !this.settings.autosave;
        this.updateToggle('autosaveToggle', this.settings.autosave);
        this.saveSettings();
    }

    // Shortcuts methods
    toggleShortcuts() {
        console.log('Toggling shortcuts');
        this.settings.shortcuts = !this.settings.shortcuts;
        this.updateToggle('shortcutsToggle', this.settings.shortcuts);
        this.saveSettings();
    }

    // Action methods
    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to their default values?')) {
            this.settings = this.getDefaultSettings();
            this.initializeSettings();
            this.saveSettings();
            this.showNotification('Settings reset to defaults', 'success');
        }
    }

    exportSettings() {
        try {
            const dataStr = JSON.stringify(this.settings, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'math-drill-settings.json';
            link.click();
            URL.revokeObjectURL(url);
            this.showNotification('Settings exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting settings:', error);
            this.showNotification('Failed to export settings', 'error');
        }
    }

    clearCache() {
        try {
            // Clear localStorage cache (except settings)
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key !== 'mathDrillSettings') {
                    localStorage.removeItem(key);
                }
            });

            // Clear session storage
            sessionStorage.clear();

            this.showNotification('Cache cleared successfully', 'success');
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showNotification('Failed to clear cache', 'error');
        }
    }

    exportData() {
        try {
            // Collect all app data
            const appData = {
                settings: this.settings,
                achievements: this.getFromLocalStorage('achievements'),
                attempts: this.getFromLocalStorage('attempts'),
                dailyGoals: this.getFromLocalStorage('dailyGoals'),
                adaptiveDifficulty: this.getFromLocalStorage('adaptiveDifficulty'),
                exportDate: new Date().toISOString()
            };

            const dataStr = JSON.stringify(appData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `math-drill-data-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
            this.showNotification('Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Failed to export data', 'error');
        }
    }

    resetData() {
        const confirmation = confirm('⚠️ WARNING: This will permanently delete ALL your practice data, progress, achievements, and settings. This action cannot be undone.\n\nType "DELETE" to confirm:');

        if (confirmation === true) {
            const secondConfirmation = prompt('Please type "DELETE" to confirm permanent data deletion:');

            if (secondConfirmation === 'DELETE') {
                try {
                    // Clear all localStorage
                    localStorage.clear();
                    sessionStorage.clear();

                    // Reset to default settings
                    this.settings = this.getDefaultSettings();
                    this.saveSettings();

                    // Reload page to reset everything
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);

                    this.showNotification('All data has been permanently deleted. Page will reload...', 'success');
                } catch (error) {
                    console.error('Error resetting data:', error);
                    this.showNotification('Failed to reset data', 'error');
                }
            } else {
                this.showNotification('Data reset cancelled', 'info');
            }
        } else {
            this.showNotification('Data reset cancelled', 'info');
        }
    }

    // Helper methods
    getFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Error reading ${key} from localStorage:`, error);
            return null;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
        `;

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#10B981';
                break;
            case 'error':
                notification.style.backgroundColor = '#EF4444';
                break;
            case 'warning':
                notification.style.backgroundColor = '#F59E0B';
                break;
            default:
                notification.style.backgroundColor = '#3B82F6';
        }

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    notifySettingsChanged() {
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('settingsChanged', {
            detail: this.settings
        }));
    }

    // Public getter for current settings
    getSettings() {
        return { ...this.settings };
    }
}

// Initialize settings manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (!window.settingsManager) {
        window.settingsManager = new SettingsManager();
    }
});
