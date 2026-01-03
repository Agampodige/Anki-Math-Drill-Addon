class SettingsManager {
    constructor() {
        // Initialize state from storage or defaults
        this.state = {
            theme: localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
            soundEnabled: localStorage.getItem('sound_enabled') !== 'false', // Default true
            showHints: localStorage.getItem('show_hints') !== 'false', // Default true
            difficulty: localStorage.getItem('difficulty') || 'intermediate'
        };
        
        // Bind methods
        this.toggleTheme = this.toggleTheme.bind(this);
        this.toggleSound = this.toggleSound.bind(this);
        this.toggleHints = this.toggleHints.bind(this);
        this.setDifficulty = this.setDifficulty.bind(this);
        
        this.init();
    }

    init() {
        // Listen for storage changes (cross-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme') {
                this.state.theme = e.newValue;
                this.applyTheme(e.newValue);
                this.updateUI();
            } else if (e.key === 'sound_enabled') {
                this.state.soundEnabled = e.newValue !== 'false';
                this.updateUI();
            } else if (e.key === 'show_hints') {
                this.state.showHints = e.newValue !== 'false';
                this.updateUI();
            } else if (e.key === 'difficulty') {
                this.state.difficulty = e.newValue;
                this.updateUI();
            }
        });
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                this.setTheme(newTheme);
            }
        });
        
        // Initial UI update
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.updateUI());
        } else {
            this.updateUI();
        }
    }

    updateUI() {
        // Update Theme Toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            if (this.state.theme === 'dark') {
                themeToggle.classList.add('active');
            } else {
                themeToggle.classList.remove('active');
            }
        }

        // Update Sound Toggle
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            if (this.state.soundEnabled) {
                soundToggle.classList.add('active');
            } else {
                soundToggle.classList.remove('active');
            }
        }

        // Update Hints Toggle
        const hintsToggle = document.getElementById('hintsToggle');
        if (hintsToggle) {
            if (this.state.showHints) {
                hintsToggle.classList.add('active');
            } else {
                hintsToggle.classList.remove('active');
            }
        }

        // Update Difficulty Select
        const difficultySelect = document.getElementById('difficultySelect');
        if (difficultySelect) {
            difficultySelect.value = this.state.difficulty;
        }
    }

    setTheme(theme) {
        this.state.theme = theme;
        localStorage.setItem('theme', theme);
        this.applyTheme(theme);
        this.updateUI();
        
        if (window.pythonBridge) {
            window.pythonBridge.send('set_theme', JSON.stringify({ theme }), '');
        }
    }

    toggleTheme() {
        const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    setSoundEnabled(enabled) {
        this.state.soundEnabled = enabled;
        localStorage.setItem('sound_enabled', enabled);
        this.updateUI();
    }

    toggleSound() {
        this.setSoundEnabled(!this.state.soundEnabled);
    }

    setShowHints(enabled) {
        this.state.showHints = enabled;
        localStorage.setItem('show_hints', enabled);
        this.updateUI();
    }

    toggleHints() {
        this.setShowHints(!this.state.showHints);
    }

    setDifficulty(level) {
        this.state.difficulty = level;
        localStorage.setItem('difficulty', level);
        this.updateUI();
    }
}

// Create global instance
window.settingsManager = new SettingsManager();