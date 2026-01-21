// Settings Page Handler

// Flag to prevent duplicate processing
let isProcessingSettings = false;

// Default settings - matches backend structure
const DEFAULT_SETTINGS = {
    theme: 'dark',
    soundEnabled: false,
    notificationsEnabled: true,
    problemsPerSession: 10,
    difficultyLevel: 'medium',
    showTimer: true,
    showAccuracy: true,
    autoCheckAnswers: false,
    darkMode: true,
    adaptiveDifficulty: true
};

// Load settings from localStorage with fallback to defaults
function loadSettings() {
    try {
        const saved = localStorage.getItem('appSettings');
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch (e) {
        console.warn('Error loading settings from localStorage:', e);
        return DEFAULT_SETTINGS;
    }
}

// Save settings to localStorage and backend
function saveSettings(settings) {
    // Save to localStorage first
    localStorage.setItem('appSettings', JSON.stringify(settings));
    console.log('Settings saved to localStorage:', settings);

    // Also save to backend file
    if (window.pybridge) {
        const message = {
            type: 'save_settings',
            payload: {
                settings: settings
            }
        };
        try {
            console.log('Sending save message to backend:', message);
            window.pybridge.sendMessage(JSON.stringify(message));
            console.log('Settings sent to backend for saving');
        } catch (e) {
            console.warn('Could not save to backend:', e);
            // Still show success message since localStorage worked
            showSuccessMessage('Settings saved locally!');
        }
    } else {
        console.warn('Bridge not available, settings saved only to localStorage');
        showSuccessMessage('Settings saved locally!');
    }
}

// Apply settings to the application
function applySettings(settings) {
    console.log('Applying settings:', settings);
    
    // Apply theme using app.js system if available
    if (window.applyTheme && settings.theme) {
        applyTheme(settings.theme);
    }

    // Store settings in window for global access
    window.appSettings = settings;
}

// Load settings from backend file (if available)
function loadSettingsFromBackend() {
    if (window.pybridge) {
        const message = {
            type: 'load_settings',
            payload: {}
        };
        try {
            console.log('Requesting settings from backend...');
            window.pybridge.sendMessage(JSON.stringify(message));
        } catch (e) {
            console.warn('Could not load from backend:', e);
        }
    } else {
        console.warn('Bridge not available for loading settings');
    }
}

// Synchronize settings between localStorage and backend
function syncSettings() {
    console.log('Syncing settings...');
    if (window.pybridge) {
        loadSettingsFromBackend();
    } else {
        console.warn('Bridge not available, using local settings only');
        // Apply local settings immediately if bridge is not available
        const localSettings = loadSettings();
        applySettings(localSettings);
        updateUI(localSettings);
    }
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('Settings page loading...');
    
    // Load initial settings from localStorage (for immediate UI update)
    const initialSettings = loadSettings();
    applySettings(initialSettings);
    updateUI(initialSettings);
    
    // Set up bridge connection handlers first
    window.addEventListener('pybridge-connected', () => {
        console.log('Bridge connected, syncing settings...');
        if (window.pybridge) {
            window.pybridge.messageReceived.connect(window.handleBridgeMessage);
            syncSettings();
        }
    });
    
    // If bridge is already available, sync settings
    if (window.pybridge) {
        window.pybridge.messageReceived.connect(window.handleBridgeMessage);
        syncSettings();
    }

    // UI Elements
    const themeToggle = document.getElementById('themeToggle');
    const soundToggle = document.getElementById('soundToggle');
    const notificationsToggle = document.getElementById('notificationsToggle');
    const timerDisplay = document.getElementById('timerDisplay');
    const accuracyDisplay = document.getElementById('accuracyDisplay');
    const autoCheck = document.getElementById('autoCheck');
    const adaptiveToggle = document.getElementById('adaptiveDifficultyToggle');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const resetBtn = document.getElementById('resetBtn');
    const refreshBtn = document.getElementById('refreshSettingsBtn');
    const backBtn = document.getElementById('backBtn');

    // Theme toggle change handler
    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            console.log('Theme toggle changed to:', theme);
            
            // Update both our settings and the app.js theme system
            const settings = loadSettings();
            settings.theme = theme;
            settings.darkMode = theme === 'dark';
            saveSettings(settings);
            
            // Use app.js theme system if available
            if (window.applyTheme) {
                applyTheme(theme);
            }
        });
    }

    // Refresh button handler
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Refreshing...';
            syncSettings();
            setTimeout(() => {
                refreshBtn.disabled = false;
                refreshBtn.textContent = 'Refresh';
            }, 1000);
        });
    }

    // Back button handler
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Save button handler
    if (saveBtn) {
        saveBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Save button clicked');
            
            const currentSettings = loadSettings();
            const newSettings = {
                theme: themeToggle?.checked ? 'dark' : 'light',
                soundEnabled: soundToggle?.checked ?? false,
                notificationsEnabled: notificationsToggle?.checked ?? true,
                showTimer: timerDisplay?.checked ?? true,
                showAccuracy: accuracyDisplay?.checked ?? true,
                autoCheckAnswers: autoCheck?.checked ?? false,
                adaptiveDifficulty: adaptiveToggle?.checked ?? true,
                problemsPerSession: currentSettings.problemsPerSession || 10,
                difficultyLevel: currentSettings.difficultyLevel || 'medium',
                darkMode: themeToggle?.checked ?? true
            };

            console.log('Saving new settings:', newSettings);
            saveSettings(newSettings);
            applySettings(newSettings);
        });
    }

    // Reset button handler
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            if (confirm('Are you sure you want to reset all settings to default?')) {
                saveSettings(DEFAULT_SETTINGS);
                applySettings(DEFAULT_SETTINGS);
                updateUI(DEFAULT_SETTINGS);
                showSuccessMessage('Settings reset to default!');
            }
        });
    }

    // Export Data handler
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (window.pybridge) {
                const message = { type: 'export_data', payload: {} };
                window.pybridge.sendMessage(JSON.stringify(message));
                exportBtn.disabled = true;
                exportBtn.textContent = 'Exporting...';
            }
        });
    }

    // Import Data handler
    const importBtn = document.getElementById('importDataBtn');
    const importFile = document.getElementById('importFile');
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (window.pybridge) {
                        const message = { type: 'import_data', payload: { data: data } };
                        window.pybridge.sendMessage(JSON.stringify(message));
                        importBtn.disabled = true;
                        importBtn.textContent = 'Importing...';
                    }
                } catch (err) {
                    alert('Invalid JSON file');
                }
            };
            reader.readAsText(file);
        });
    }

    // Handle responses from Python
    window.handleBridgeMessage = function (messageStr) {
        try {
            const message = JSON.parse(messageStr);
            console.log('Received bridge message in settings:', message);

            if (message.type === 'load_settings_response' && message.payload.success) {
                if (isProcessingSettings) {
                    console.log('Already processing settings, skipping...');
                    return;
                }
                
                isProcessingSettings = true;
                const backendSettings = message.payload.settings;
                console.log('Received settings from backend:', backendSettings);

                // Merge sequence: defaults -> backend -> local (local takes precedence)
                const currentSettings = loadSettings();
                const mergedSettings = {
                    ...DEFAULT_SETTINGS,
                    ...backendSettings,
                    ...currentSettings // Local settings override backend
                };

                console.log('Applying merged settings:', mergedSettings);
                localStorage.setItem('appSettings', JSON.stringify(mergedSettings));
                applySettings(mergedSettings);
                updateUI(mergedSettings);
                
                // Show success message for loading
                showSuccessMessage('Settings loaded successfully!');
                
                setTimeout(() => {
                    isProcessingSettings = false;
                }, 500);
            } else if (message.type === 'save_settings_response' && message.payload.success) {
                console.log('Settings successfully saved to backend');
                showSuccessMessage('Settings saved successfully!');
            } else if (message.type === 'export_data_response' && message.payload.success) {
                const dataStr = JSON.stringify(message.payload.data, null, 4);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `math_drill_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                if (exportBtn) {
                    exportBtn.disabled = false;
                    exportBtn.textContent = 'Export';
                }
                showSuccessMessage('Data exported successfully!');
            } else if (message.type === 'import_data_response' && message.payload.success) {
                if (importBtn) {
                    importBtn.disabled = false;
                    importBtn.textContent = 'Import';
                }
                showSuccessMessage('Data imported! Restart required.');
                alert('Data imported successfully. Please restart the addon.');
            } else if (message.type === 'error') {
                console.error('Bridge error:', message.payload.message);
                if (exportBtn) { exportBtn.disabled = false; exportBtn.textContent = 'Export'; }
                if (importBtn) { importBtn.disabled = false; importBtn.textContent = 'Import'; }
            }
        } catch (e) {
            console.error('Error handling bridge message:', e);
        }
    };

    // Helper to update UI elements based on settings
    function updateUI(settings) {
        const themeToggle = document.getElementById('themeToggle');
        const soundToggle = document.getElementById('soundToggle');
        const notificationsToggle = document.getElementById('notificationsToggle');
        const timerDisplay = document.getElementById('timerDisplay');
        const accuracyDisplay = document.getElementById('accuracyDisplay');
        const autoCheck = document.getElementById('autoCheck');
        const adaptiveToggle = document.getElementById('adaptiveDifficultyToggle');

        if (themeToggle) themeToggle.checked = settings.theme === 'dark' || settings.darkMode === true;
        if (soundToggle) soundToggle.checked = settings.soundEnabled ?? false;
        if (notificationsToggle) notificationsToggle.checked = settings.notificationsEnabled ?? true;
        if (timerDisplay) timerDisplay.checked = settings.showTimer ?? true;
        if (accuracyDisplay) accuracyDisplay.checked = settings.showAccuracy ?? true;
        if (autoCheck) autoCheck.checked = settings.autoCheckAnswers ?? false;
        if (adaptiveToggle) adaptiveToggle.checked = settings.adaptiveDifficulty ?? true;
    }

});

// Show success message
function showSuccessMessage(message = 'Settings saved successfully!') {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
        successMessage.textContent = '✓ ' + message;
        successMessage.style.display = 'block';

        // Auto hide after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }
}

// Get current settings
function getSettings() {
    return loadSettings();
}

// Update specific setting
function updateSetting(key, value) {
    const settings = loadSettings();
    settings[key] = value;
    saveSettings(settings);
    applySettings(settings);
    return settings;
}

// Check if a feature is enabled
function isSettingEnabled(key) {
    const settings = getSettings();
    return settings[key] === true;
}

// Get setting value
function getSettingValue(key) {
    const settings = getSettings();
    return settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
}
