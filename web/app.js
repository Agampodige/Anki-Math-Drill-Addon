// Navigation System
function setupNavigation() {
    const homeButtons = document.querySelectorAll('.nav-card, [data-page]');
    const backButtons = document.querySelectorAll('#backBtn');

    console.log('Setting up navigation, found buttons:', homeButtons.length, backButtons.length);

    // Add click listeners to navigation buttons with robust error handling
    homeButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            try {
                e.preventDefault();
                e.stopPropagation();
                const page = this.getAttribute('data-page');
                console.log('Navigating to:', page);
                navigateToPage(page);
            } catch (error) {
                console.error('Navigation error:', error);
                // Fallback: direct navigation
                const page = this.getAttribute('data-page');
                if (page) {
                    window.location.href = page + '.html';
                }
            }
        }, { capture: true });
    });

    // Add click listeners to back buttons with robust error handling
    backButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            try {
                e.preventDefault();
                e.stopPropagation();
                console.log('Going back to home');
                navigateToHome();
            } catch (error) {
                console.error('Back navigation error:', error);
                // Fallback: direct navigation
                window.location.href = 'index.html';
            }
        }, { capture: true });
    });

    // Setup theme toggle button
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function (e) {
            try {
                e.preventDefault();
                e.stopPropagation();
                toggleTheme();
            } catch (error) {
                console.error('Theme toggle error:', error);
            }
        }, { capture: true });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM Content Loaded');
    setupNavigation();
    initializeTheme();
    setupThemeListener();
    setupThemeStorageListener();
    updateThemeToggleIcon();

    // Home page specific initialization
    if (document.getElementById('greetingText')) {
        updateHomeUI();
    }

    // Global click handler as backup - capture phase
    document.addEventListener('click', function (e) {
        console.log('Global click captured:', e.target.tagName, e.target.className, e.target.id);

        // Handle nav-card clicks that might have onclick attributes
        if (e.target.classList.contains('nav-card') || e.target.closest('.nav-card')) {
            const navCard = e.target.classList.contains('nav-card') ? e.target : e.target.closest('.nav-card');
            const page = navCard.getAttribute('data-page') || navCard.getAttribute('onclick');
            if (page) {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Global handler navigating to:', page);
                    // Extract page name from onclick if needed
                    const pageName = page.includes("'") ? page.split("'")[1] : page.replace('navigateToPage(', '').replace(')', '');
                    navigateToPage(pageName);
                    return;
                } catch (error) {
                    console.error('Global navigation error:', error);
                }
            }
        }

        // Handle back button clicks
        if (e.target.id === 'backBtn' || e.target.closest('#backBtn')) {
            try {
                e.preventDefault();
                e.stopPropagation();
                console.log('Global handler going back to home');
                navigateToHome();
                return;
            } catch (error) {
                console.error('Global back navigation error:', error);
            }
        }
    }, true);

    // Debug: Check if elements are clickable
    setTimeout(() => {
        const buttons = document.querySelectorAll('button, .nav-card, [onclick]');
        console.log('Found clickable elements:', buttons.length);
        buttons.forEach((btn, i) => {
            console.log(`Button ${i}:`, btn.tagName, btn.className, btn.onclick ? 'has onclick' : 'no onclick');
        });
    }, 1000);
});

// Also setup on window load as backup
window.addEventListener('load', function () {
    console.log('Window Load');
    setupNavigation();
    updateThemeToggleIcon();
});

function updateHomeStatsFromBackend(attempts) {
    if (!attempts || !Array.isArray(attempts)) {
        console.error('Invalid attempts data received from backend');
        return;
    }

    const total = attempts.length;
    const correct = attempts.filter(a => a.isCorrect).length;
    const accuracy = Math.round((correct / total) * 100);

    // Calculate daily streak
    const dates = new Set();
    attempts.forEach(a => {
        const ts = a.timestamp || a.date;
        if (!ts) return;
        const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.add(dateStr);
    });

    let streak = 0;
    const today = new Date();
    const checkDate = new Date(today);

    while (true) {
        const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        if (dates.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // If it's today and no attempts yet, check yesterday to continue streak
            if (streak === 0) {
                checkDate.setDate(checkDate.getDate() - 1);
                const yesterdayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
                if (dates.has(yesterdayStr)) {
                    // Start streak count from 1 if yesterday was active
                    // wait, if today is not in set but yesterday is, streak is the streak ending yesterday.
                    // Let's just count backwards from yesterday.
                    let yesterdayStreak = 0;
                    let tempDate = new Date(checkDate);
                    while (true) {
                        const s = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
                        if (dates.has(s)) {
                            yesterdayStreak++;
                            tempDate.setDate(tempDate.getDate() - 1);
                        } else break;
                    }
                    streak = yesterdayStreak;
                }
            }
            break;
        }
    }

    // Update the UI with real stats
    if (document.getElementById('homeStatTotalAttempts')) {
        document.getElementById('homeStatTotalAttempts').textContent = total;
        document.getElementById('homeStatAccuracy').textContent = accuracy + '%';
        document.getElementById('homeStatStreak').textContent = streak;
    }

    console.log(`Updated home stats with real data: ${total} attempts, ${accuracy}% accuracy, ${streak} day streak`);
}

function updateHomeUI() {
    // 1. Set Greeting
    const greetingText = document.getElementById('greetingText');
    const greetingEmoji = document.getElementById('greetingEmoji');
    if (greetingText) {
        const { text, emoji } = getGreeting();
        greetingText.textContent = text;
        if (greetingEmoji) greetingEmoji.textContent = emoji;
    }

    // 2. Load and Display Stats - request fresh data from backend
    if (isConnected && pybridge) {
        sendToPython('get_attempts', {});
    } else {
        // Fallback to localStorage for development/testing
        const stats = calculateHomeStats();
        if (document.getElementById('homeStatTotalAttempts')) {
            document.getElementById('homeStatTotalAttempts').textContent = stats.total;
            document.getElementById('homeStatAccuracy').textContent = stats.accuracy + '%';
            document.getElementById('homeStatStreak').textContent = stats.streak;
        }
    }
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good Morning', emoji: '🌅' };
    if (hour >= 12 && hour < 17) return { text: 'Good Afternoon', emoji: '☀️' };
    if (hour >= 17 && hour < 21) return { text: 'Good Evening', emoji: '🌇' };
    return { text: 'Good Night', emoji: '🌙' };
}

function calculateHomeStats() {
    // If Python bridge is available, request real data from backend
    if (isConnected && pybridge) {
        sendToPython('get_attempts', {});
        return { total: 0, accuracy: 0, streak: 0 }; // Return placeholder while loading
    }

    // Fallback to localStorage for development/testing
    const attemptsStr = localStorage.getItem('mathDrillAttempts');
    let attempts = [];
    try {
        if (attemptsStr) attempts = JSON.parse(attemptsStr);
    } catch (e) {
        console.error('Error parsing attempts for home stats:', e);
    }

    if (!attempts || attempts.length === 0) {
        return { total: 0, accuracy: 0, streak: 0 };
    }

    const total = attempts.length;
    const correct = attempts.filter(a => a.isCorrect).length;
    const accuracy = Math.round((correct / total) * 100);

    // Calculate daily streak
    const dates = new Set();
    attempts.forEach(a => {
        const ts = a.timestamp || a.date;
        if (!ts) return;
        const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dates.add(dateStr);
    });

    let streak = 0;
    const today = new Date();
    const checkDate = new Date(today);

    while (true) {
        const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        if (dates.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // If it's today and no attempts yet, check yesterday to continue streak
            if (streak === 0) {
                checkDate.setDate(checkDate.getDate() - 1);
                const yesterdayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
                if (dates.has(yesterdayStr)) {
                    // Start streak count from 1 if yesterday was active
                    // wait, if today is not in set but yesterday is, streak is the streak ending yesterday.
                    // Let's just count backwards from yesterday.
                    let yesterdayStreak = 0;
                    let tempDate = new Date(checkDate);
                    while (true) {
                        const s = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
                        if (dates.has(s)) {
                            yesterdayStreak++;
                            tempDate.setDate(tempDate.getDate() - 1);
                        } else break;
                    }
                    streak = yesterdayStreak;
                }
            }
            break;
        }
    }

    return { total, accuracy, streak };
}

function navigateToPage(pageName) {
    const pages = {
        'levels': 'levels.html',
        'practice_mode': 'practice_mode.html',
        'analytics': 'analytics.html',
        'settings': 'settings.html'
    };

    if (pages[pageName]) {
        window.location.href = pages[pageName];
    }
}

function navigateToHome() {
    window.location.href = 'index.html';
}

// Theme Management with Auto Detection & Accent Colors
const THEME_COLORS = {
    'green': {
        'primary': '#10b981',
        'dark': '#059669',
        'light': '#34d399',
        'lighter': '#6ee7b7',
        '50': '#f0fdf4',
        '100': '#dcfce7',
        '500': '#10b981',
        '600': '#059669',
        '700': '#047857'
    },
    'blue': {
        'primary': '#3b82f6',
        'dark': '#2563eb',
        'light': '#60a5fa',
        'lighter': '#93c5fd',
        '50': '#eff6ff',
        '100': '#dbeafe',
        '500': '#3b82f6',
        '600': '#2563eb',
        '700': '#1d4ed8'
    },
    'purple': {
        'primary': '#a855f7',
        'dark': '#9333ea',
        'light': '#c084fc',
        'lighter': '#d8b4fe',
        '50': '#faf5ff',
        '100': '#f3e8ff',
        '500': '#a855f7',
        '600': '#9333ea',
        '700': '#7e22ce'
    },
    'orange': {
        'primary': '#f97316',
        'dark': '#ea580c',
        'light': '#fb923c',
        'lighter': '#fdba74',
        '50': '#fff7ed',
        '100': '#ffedd5',
        '500': '#f97316',
        '600': '#ea580c',
        '700': '#c2410c'
    },
    'red': {
        'primary': '#ef4444',
        'dark': '#dc2626',
        'light': '#f87171',
        'lighter': '#fca5a5',
        '50': '#fef2f2',
        '100': '#fee2e2',
        '500': '#ef4444',
        '600': '#dc2626',
        '700': '#b91c1c'
    }
};

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'auto';
    applyTheme(savedTheme);

    const savedColor = localStorage.getItem('accentColor') || 'green';
    applyAccentColor(savedColor);
}

function applyAccentColor(colorName) {
    const palette = THEME_COLORS[colorName] || THEME_COLORS['green'];
    const root = document.documentElement;

    // Set CSS variables
    root.style.setProperty('--primary-color', palette['primary']);
    root.style.setProperty('--primary-dark', palette['dark']);
    root.style.setProperty('--primary-light', palette['light']);
    root.style.setProperty('--primary-lighter', palette['lighter']);

    // Set numeric scale variables if needed
    root.style.setProperty('--primary-50', palette['50']);
    root.style.setProperty('--primary-100', palette['100']);
    root.style.setProperty('--primary-500', palette['500']);
    root.style.setProperty('--primary-600', palette['600']);
    root.style.setProperty('--primary-700', palette['700']);

    // Also update secondary/accent variables to match (monochromatic theme)
    root.style.setProperty('--secondary-color', palette['primary']);
    root.style.setProperty('--accent-color', palette['primary']);
    root.style.setProperty('--accent-light', palette['light']);

    // Save preference
    localStorage.setItem('accentColor', colorName);

    // Dispatch event for settings page to update UI
    window.dispatchEvent(new CustomEvent('accent-color-changed', { detail: { color: colorName } }));
}

function applyTheme(themeName) {
    const body = document.body;
    let effectiveTheme = themeName;

    // Handle auto theme detection
    if (themeName === 'auto') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply theme
    if (effectiveTheme === 'dark') {
        body.classList.add('dark-theme');
        body.classList.remove('light-theme');
    } else {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
    }

    // Save preference
    localStorage.setItem('theme', themeName);

    // Update theme select if it exists
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = themeName;
    }
}

// Listen for system theme changes when set to auto
function setupThemeListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addListener((e) => {
        const currentTheme = localStorage.getItem('theme') || 'auto';
        if (currentTheme === 'auto') {
            applyTheme('auto');
        }
    });

    // Listen for storage changes to sync tabs
    window.addEventListener('storage', (event) => {
        if (event.key === 'theme') {
            applyTheme(event.newValue || 'auto');
            updateThemeToggleIcon();
        } else if (event.key === 'accentColor') {
            applyAccentColor(event.newValue || 'green');
        }
    });
}


// Update theme toggle button icon
function updateThemeToggleIcon() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        const currentTheme = localStorage.getItem('theme') || 'auto';
        const body = document.body;
        let icon = '🌙'; // light mode icon

        if (body.classList.contains('dark-theme')) {
            icon = '☀️'; // dark mode icon
        } else {
            icon = '🌙'; // light mode icon
        }

        themeToggleBtn.textContent = icon;
    }
}
let pybridge = null;
let isConnected = false;

// Create mock bridge for development/testing
function createMockBridge() {
    pybridge = {
        sendMessage: function (message) {
            console.log(' Mock bridge - would send to Python:', message);

            try {
                const data = JSON.parse(message);

                // Handle different message types
                switch (data.type) {
                    case 'save_settings':
                        // Simulate saving settings to file
                        console.log(' Mock bridge - saving settings:', data.payload.settings);
                        // Store in localStorage for persistence during session
                        localStorage.setItem('mockSettings', JSON.stringify(data.payload.settings));

                        // Simulate success response
                        setTimeout(() => {
                            const mockResponse = JSON.stringify({
                                type: 'settings_saved',
                                payload: { success: true }
                            });
                            handlePythonMessage(mockResponse);
                        }, 50);
                        break;

                    case 'get_attempts':
                        // Simulate loading attempts from localStorage
                        const attemptsStr = localStorage.getItem('mathDrillAttempts');
                        let attempts = [];
                        try {
                            if (attemptsStr) attempts = JSON.parse(attemptsStr);
                        } catch (e) {
                            console.error('Mock bridge - error parsing attempts:', e);
                        }
                        
                        // If no attempts in localStorage, try to load from the actual data file
                        if (attempts.length === 0) {
                            console.log('Mock bridge - no attempts in localStorage, using sample data');
                            // Create some sample data for testing
                            attempts = [
                                {
                                    id: 1,
                                    operation: "addition",
                                    digits: 2,
                                    question: "15 + 27",
                                    userAnswer: 42,
                                    correctAnswer: 42,
                                    isCorrect: true,
                                    timeTaken: 3.5,
                                    timestamp: new Date(Date.now() - 86400000).toISOString() // Yesterday
                                },
                                {
                                    id: 2,
                                    operation: "subtraction",
                                    digits: 2,
                                    question: "84 - 36",
                                    userAnswer: 48,
                                    correctAnswer: 48,
                                    isCorrect: true,
                                    timeTaken: 4.2,
                                    timestamp: new Date().toISOString() // Today
                                },
                                {
                                    id: 3,
                                    operation: "multiplication",
                                    digits: 1,
                                    question: "7 × 8",
                                    userAnswer: 56,
                                    correctAnswer: 56,
                                    isCorrect: true,
                                    timeTaken: 2.1,
                                    timestamp: new Date().toISOString() // Today
                                }
                            ];
                        }
                        
                        setTimeout(() => {
                            const mockResponse = JSON.stringify({
                                type: 'get_attempts_response',
                                payload: { 
                                    attempts: attempts,
                                    success: true 
                                }
                            });
                            handlePythonMessage(mockResponse);
                        }, 100);
                        break;

                    case 'hello':
                        // Simulate hello response
                        setTimeout(() => {
                            const mockResponse = JSON.stringify({
                                type: 'hello_response',
                                payload: { message: 'Hello from mock Python bridge!' }
                            });
                            handlePythonMessage(mockResponse);
                        }, 100);
                        break;

                    default:
                        console.log(' Mock bridge - unhandled message type:', data.type);
                }
            } catch (e) {
                console.error('Mock bridge - error parsing message:', e);
            }
        }
    };

    // Set connected flag for mock mode
    isConnected = true;
    console.log(' Mock bridge created for development');

    // Dispatch event for other scripts
    window.dispatchEvent(new CustomEvent('pybridge-connected', { detail: { bridge: pybridge } }));
    
    // If we're on the home page, update the UI with fresh data
    if (document.getElementById('greetingText')) {
        updateHomeUI();
    }
}

// Initialize WebChannel connection
if (typeof qt !== 'undefined' && qt.webChannelTransport) {
    window.addEventListener('load', function () {
        if (typeof QWebChannel !== 'undefined') {
            new QWebChannel(qt.webChannelTransport, function (channel) {
                pybridge = channel.objects.pybridge;

                if (pybridge) {
                    window.pybridge = pybridge;
                    isConnected = true;
                    console.log(' Successfully connected to Python bridge');

                    // Dispatch event for other scripts
                    window.dispatchEvent(new CustomEvent('pybridge-connected', { detail: { bridge: pybridge } }));

                    // If we're on the home page, update the UI with fresh data
                    if (document.getElementById('greetingText')) {
                        updateHomeUI();
                    }

                    // Set up message listener
                    pybridge.messageReceived.connect(function (message) {
                        console.log(' Received from Python:', message);
                        handlePythonMessage(message);
                    });
                } else {
                    console.log(' Failed to connect to Python bridge');
                }
            });
        } else {
            console.log(' QWebChannel not available');
        }
    });
} else {
    console.log(' Running outside Qt environment - using mock bridge');
}
createMockBridge();

function handlePythonMessage(message) {
    try {
        const data = JSON.parse(message);
        const type = data.type;
        const payload = data.payload;

        switch (type) {
            case 'hello_response':
                console.log(`👋 Python says: ${payload.message}`);
                break;
            case 'settings_saved':
                console.log(`✅ Settings saved successfully:`, payload);
                break;
            case 'data_response':
                console.log(`📊 Received data: `, payload);
                break;
            case 'get_attempts_response':
                console.log(`📈 Received attempts data for home stats:`, payload);
                if (payload.attempts && Array.isArray(payload.attempts)) {
                    updateHomeStatsFromBackend(payload.attempts);
                }
                break;
            case 'load_settings_response':
                console.log(`⚙️ Settings loaded from backend:`, payload.settings);
                if (payload.settings) {
                    // Merge backend settings with current localStorage
                    // We don't have DEFAULT_SETTINGS here, but we can preserve what's in localStorage
                    const saved = localStorage.getItem('appSettings');
                    const currentSettings = saved ? JSON.parse(saved) : {};
                    const mergedSettings = { ...currentSettings, ...payload.settings };

                    localStorage.setItem('appSettings', JSON.stringify(mergedSettings));

                    // If we're on the settings page, window.handleBridgeMessage should handle it.
                    // If not, we still want to apply theme etc.
                    if (typeof applySettings === 'function') {
                        applySettings(mergedSettings);
                    }
                }
                break;
            case 'save_settings_response':
                console.log(`✓ Settings saved to backend`);
                break;
            default:
                // Try to delegate to global handler if exists (e.g. for analytics)
                if (typeof window.handleBackendMessage === 'function') {
                    window.handleBackendMessage(message);
                    return;
                }
                console.log('Unknown message type:', type);
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
}

function sendToPython(type, payload) {
    if (isConnected && pybridge) {
        const message = JSON.stringify({
            type: type,
            payload: payload
        });
        pybridge.sendMessage(message);
    } else {
        console.warn('Python bridge not connected');
    }
}
