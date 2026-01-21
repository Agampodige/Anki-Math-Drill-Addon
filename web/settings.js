// Settings Page Handler

// Default settings
const DEFAULT_SETTINGS = {
    theme: 'auto',
    soundEnabled: true,
    notificationsEnabled: true,
    problemsPerSession: 10,
    difficultyLevel: 'medium',
    showTimer: true,
    showAccuracy: true,
    autoCheckAnswers: false,
    darkMode: true
};

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
}

// Save settings to localStorage and backend
function saveSettings(settings) {
    // Save to localStorage first
    localStorage.setItem('appSettings', JSON.stringify(settings));

    // Also save to backend file
    if (window.pybridge) {
        const message = {
            type: 'save_settings',
            payload: {
                settings: settings
            }
        };
        try {
            window.pybridge.sendMessage(JSON.stringify(message));
            console.log('Settings saved to backend');
        } catch (e) {
            console.warn('Could not save to backend:', e);
        }
    }
}

// Apply settings to the application
function applySettings(settings) {
    // Apply theme
    if (window.applyTheme) {
        applyTheme(settings.theme);
    }

    // Store settings in window for global access
    window.appSettings = settings;

    // Log for debugging
    console.log('Settings applied:', settings);
}

// Load settings from backend file (if available)
function loadSettingsFromBackend() {
    if (window.pybridge) {
        const message = {
            type: 'load_settings',
            payload: {}
        };
        try {
            window.pybridge.sendMessage(JSON.stringify(message));
            console.log('Loading settings from backend...');
        } catch (e) {
            console.warn('Could not load from backend:', e);
        }
    }
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', function () {
    const settings = loadSettings();
    applySettings(settings);

    // UI Elements
    const themeToggle = document.getElementById('themeToggle');
    const soundToggle = document.getElementById('soundToggle');
    const notificationsToggle = document.getElementById('notificationsToggle');
    const timerDisplay = document.getElementById('timerDisplay');
    const accuracyDisplay = document.getElementById('accuracyDisplay');
    const autoCheck = document.getElementById('autoCheck');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const resetBtn = document.getElementById('resetBtn');
    const backBtn = document.getElementById('backBtn');

    // Set form values
    if (themeToggle) {
        themeToggle.checked = settings.theme === 'dark' || settings.theme === 'auto';
        themeToggle.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            if (window.applyTheme) {
                applyTheme(theme);
            }
        });
    }
    if (soundToggle) soundToggle.checked = settings.soundEnabled;
    if (notificationsToggle) notificationsToggle.checked = settings.notificationsEnabled;
    if (timerDisplay) timerDisplay.checked = settings.showTimer;
    if (accuracyDisplay) accuracyDisplay.checked = settings.showAccuracy;
    if (autoCheck) autoCheck.checked = settings.autoCheckAnswers;

    // Back button handler
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Save button handler
    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            const newSettings = {
                theme: themeToggle?.checked ? 'dark' : 'light',
                soundEnabled: soundToggle?.checked ?? true,
                notificationsEnabled: notificationsToggle?.checked ?? true,
                showTimer: timerDisplay?.checked ?? true,
                showAccuracy: accuracyDisplay?.checked ?? true,
                autoCheckAnswers: autoCheck?.checked ?? false,
                // Keep default values for removed settings to avoid breaking other parts of the app
                problemsPerSession: settings.problemsPerSession || 10,
                difficultyLevel: settings.difficultyLevel || 'medium',
                darkMode: themeToggle?.checked ?? true
            };

            saveSettings(newSettings);
            applySettings(newSettings);
            showSuccessMessage('Settings saved successfully!');

            console.log('Settings saved:', newSettings);
        });
    }

    // Reset button handler
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            if (confirm('Are you sure you want to reset all settings to default?')) {
                saveSettings(DEFAULT_SETTINGS);
                applySettings(DEFAULT_SETTINGS);

                // Update form
                if (themeToggle) themeToggle.checked = DEFAULT_SETTINGS.theme === 'dark' || DEFAULT_SETTINGS.theme === 'auto';
                if (soundToggle) soundToggle.checked = DEFAULT_SETTINGS.soundEnabled;
                if (notificationsToggle) notificationsToggle.checked = DEFAULT_SETTINGS.notificationsEnabled;
                if (timerDisplay) timerDisplay.checked = DEFAULT_SETTINGS.showTimer;
                if (accuracyDisplay) accuracyDisplay.checked = DEFAULT_SETTINGS.showAccuracy;
                if (autoCheck) autoCheck.checked = DEFAULT_SETTINGS.autoCheckAnswers;

                // Apply theme
                if (window.applyTheme) {
                    applyTheme(DEFAULT_SETTINGS.theme);
                }

                showSuccessMessage('Settings reset to default!');
            }
        });
    }
    // Export Data handler
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (window.pybridge) {
                const message = {
                    type: 'export_data',
                    payload: {}
                };
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
                        const message = {
                            type: 'import_data',
                            payload: { data: data }
                        };
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

    // Handle responses from Python via a global function (if not already handled)
    window.handleBridgeMessage = function (messageStr) {
        try {
            const message = JSON.parse(messageStr);
            console.log('Received bridge message:', message);

            if (message.type === 'export_data_response' && message.payload.success) {
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
                alert('Error: ' + message.payload.message);
                if (exportBtn) { exportBtn.disabled = false; exportBtn.textContent = 'Export'; }
                if (importBtn) { importBtn.disabled = false; importBtn.textContent = 'Import'; }
            }
        } catch (e) {
            console.error('Error handling bridge message:', e);
        }
    };
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
