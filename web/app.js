// Navigation System
function setupNavigation() {
    const homeButtons = document.querySelectorAll('.nav-button');
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
    updateThemeToggleIcon();

    // Home page specific initialization
    if (document.getElementById('greetingText')) {
        updateHomeUI();
    }
    
    // Global click handler as backup - capture phase
    document.addEventListener('click', function(e) {
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

function updateHomeUI() {
    // 1. Set Greeting
    const greetingText = document.getElementById('greetingText');
    const greetingEmoji = document.getElementById('greetingEmoji');
    if (greetingText) {
        const { text, emoji } = getGreeting();
        greetingText.textContent = text;
        if (greetingEmoji) greetingEmoji.textContent = emoji;
    }

    // 2. Load and Display Stats
    const stats = calculateHomeStats();
    if (document.getElementById('homeStatTotalAttempts')) {
        document.getElementById('homeStatTotalAttempts').textContent = stats.total;
        document.getElementById('homeStatAccuracy').textContent = stats.accuracy + '%';
        document.getElementById('homeStatStreak').textContent = stats.streak;
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
    // Try to load attempts from localStorage set by analytics or practice
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

// Theme Management with Auto Detection
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'auto';
    applyTheme(savedTheme);
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
    } else {
        body.classList.remove('dark-theme');
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
}

// Toggle between light and dark themes
function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'auto';
    let newTheme = 'light';

    if (currentTheme === 'light') {
        newTheme = 'dark';
    } else if (currentTheme === 'dark') {
        newTheme = 'auto';
    }

    applyTheme(newTheme);
    updateThemeToggleIcon();
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

// Python Bridge Integration (for Anki addon)
let pybridge = null;
let isConnected = false;

// Initialize WebChannel connection
if (typeof qt !== 'undefined' && qt.webChannelTransport) {
    window.addEventListener('load', function () {
        new QWebChannel(qt.webChannelTransport, function (channel) {
            pybridge = channel.objects.pybridge;

            if (pybridge) {
                isConnected = true;
                console.log('✅ Successfully connected to Python bridge');

                // Dispatch event for other scripts
                window.dispatchEvent(new CustomEvent('pybridge-connected', { detail: { bridge: pybridge } }));

                // Set up message listener
                pybridge.messageReceived.connect(function (message) {
                    console.log('📩 Received from Python:', message);
                    handlePythonMessage(message);
                });
            } else {
                console.log('❌ Failed to connect to Python bridge');
            }
        });
    });
}

function handlePythonMessage(message) {
    try {
        const data = JSON.parse(message);
        const type = data.type;
        const payload = data.payload;

        switch (type) {
            case 'hello_response':
                console.log(`👋 Python says: ${payload.message}`);
                break;
            case 'data_response':
                console.log(`📊 Received data: `, payload);
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
