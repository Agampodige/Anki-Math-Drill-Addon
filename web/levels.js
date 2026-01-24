/**
 * LevelsManager handles the fetching and display of level data.
 * Refactored for modularity and performance.
 */
class LevelsManager {
    constructor() {
        this.levels = [];
        this.filteredLevels = [];
        this.stats = {};
        this.bridge = null;

        // Filter state
        this.filters = {
            search: '',
            difficulty: 'all',
            status: 'all',
            sort: 'id'
        };

        this.renderBatchSize = 15;
        this.renderQueue = [];
        this.renderInProgress = false;

        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.setupBridge();
    }

    initializeEventListeners() {
        document.getElementById('backBtn')?.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // Filter Toggle
        const filterToggleBtn = document.getElementById('filterToggleBtn');
        const searchFilterSection = document.getElementById('searchFilterSection');
        const toggleText = document.querySelector('.toggle-text');
        const filterIcon = document.querySelector('.filter-icon');
        const closeIcon = document.querySelector('.close-icon');
        
        let isFilterVisible = false;
        
        filterToggleBtn?.addEventListener('click', () => {
            isFilterVisible = !isFilterVisible;
            
            if (isFilterVisible) {
                searchFilterSection.style.display = 'block';
                filterToggleBtn.classList.add('active');
                toggleText.textContent = window.t('common.hide_filters');
                filterIcon.style.display = 'none';
                closeIcon.style.display = 'block';
            } else {
                searchFilterSection.style.display = 'none';
                filterToggleBtn.classList.remove('active');
                toggleText.textContent = window.t('common.show_filters');
                filterIcon.style.display = 'block';
                closeIcon.style.display = 'none';
            }
        });

        // Search
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        
        // Search with debounce
        const debounce = (fn, delay) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn.apply(this, args), delay);
            };
        };

        const handleSearch = debounce((e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.applyFilters();
        }, 300);

        searchInput?.addEventListener('input', (e) => {
            clearSearch.style.display = e.target.value ? 'flex' : 'none';
            handleSearch(e);
        });

        clearSearch?.addEventListener('click', () => {
            searchInput.value = '';
            this.filters.search = '';
            clearSearch.style.display = 'none';
            this.applyFilters();
        });

        // Difficulty filters
        document.getElementById('difficultyFilters')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('#difficultyFilters .filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
                this.filters.difficulty = e.target.dataset.filter;
                this.applyFilters();
            }
        });

        // Status filters
        document.getElementById('statusFilters')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                document.querySelectorAll('#statusFilters .filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
                this.filters.status = e.target.dataset.filter;
                this.applyFilters();
            }
        });

        // Sort
        document.getElementById('sortSelect')?.addEventListener('change', (e) => {
            this.filters.sort = e.target.value;
            this.applyFilters();
        });

        // MCQ Mode Toggle
        const mcqToggle = document.getElementById('mcqModeToggle');
        if (mcqToggle) {
            try {
                // Load saved MCQ setting
                const savedMCQMode = this.getMCQMode();
                mcqToggle.checked = savedMCQMode;
                
                mcqToggle.addEventListener('change', (e) => {
                    this.setMCQMode(e.target.checked);
                });
            } catch (error) {
                console.error('Error setting up MCQ toggle:', error);
            }
        }
    }

    // --- Bridge & Data Loading ---

    setupBridge() {
        // Reuse the bridge initialized by app.js
        const connectToBridge = () => {
            if (window.pybridge) {
                this.bridge = window.pybridge;
                try {
                    this.bridge.messageReceived.connect(this.handlePythonResponse.bind(this));
                    this.loadLevels();
                } catch (error) {
                    console.error('Error connecting to bridge:', error);
                }
            } else {
                console.log('Bridge not available, waiting...');
            }
        };

        if (window.pybridge) {
            connectToBridge();
        } else {
            window.addEventListener('pybridge-connected', (event) => {
                console.log('Bridge connected event received');
                connectToBridge();
            });
        }
    }

    loadLevels() {
        if (!this.bridge) return;

        this.bridge.sendMessage(JSON.stringify({
            type: 'load_levels',
            payload: { compact: true }
        }));
    }

    handlePythonResponse(responseStr) {
        try {
            const data = JSON.parse(responseStr);
            if (data.type === 'load_levels_response') {
                this.levels = data.payload.levels || [];
                this.stats = data.payload.stats || {};
                this.render();
            } else if (data.type === 'error') {
                this.showError(data.payload.message);
            }
        } catch (e) {
            console.error('Failed to parse response:', e);
        }
    }

    // --- Rendering ---

    render() {
        this.renderStats();
        this.filteredLevels = [...this.levels];
        this.applyFilters();
    }

    renderStats() {
        if (!this.stats) return;

        // Update top stats bar
        this.setText('totalStars', this.stats.totalStars || 0);
        this.setText('completedCount', this.stats.completedLevels || 0);
        this.setText('totalCount', this.stats.totalLevels || 0);

        const percent = this.stats.progressPercentage || 0;
        this.setText('progressPercentage', `${percent}%`);
        this.setText('progressText', `${percent}%`);

        const fill = document.getElementById('progressFill');
        if (fill) fill.style.width = `${percent}%`;
    }

    applyFilters() {
        let filtered = [...this.levels];

        // Search filter
        if (this.filters.search) {
            filtered = filtered.filter(level =>
                level.name.toLowerCase().includes(this.filters.search) ||
                level.description.toLowerCase().includes(this.filters.search)
            );
        }

        // Difficulty filter
        if (this.filters.difficulty !== 'all') {
            filtered = filtered.filter(level => level.difficulty === this.filters.difficulty);
        }

        // Status filter
        if (this.filters.status !== 'all') {
            if (this.filters.status === 'completed') {
                filtered = filtered.filter(level => level.isCompleted);
            } else if (this.filters.status === 'available') {
                filtered = filtered.filter(level => !level.isLocked && !level.isCompleted);
            } else if (this.filters.status === 'locked') {
                filtered = filtered.filter(level => level.isLocked);
            }
        }

        // Sort
        filtered.sort((a, b) => {
            switch (this.filters.sort) {
                case 'id':
                    return a.id - b.id;
                case 'difficulty':
                    const diffOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3, 'Extreme': 4 };
                    return (diffOrder[a.difficulty] || 0) - (diffOrder[b.difficulty] || 0);
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'stars':
                    return (b.starsEarned || 0) - (a.starsEarned || 0);
                default:
                    return 0;
            }
        });

        this.filteredLevels = filtered;
        this.renderLevelList();
    }

    renderLevelList() {
        const container = document.getElementById('levelsContainer');
        if (!container) return;

        // Reset rendering state
        this.renderQueue = [...this.filteredLevels];
        this.renderInProgress = false;
        container.innerHTML = '';

        if (this.renderQueue.length === 0) {
            const message = this.levels.length === 0
                ? 'No levels available.'
                : 'No levels match your filters.';
            container.innerHTML = `<div class="empty-state">${message}</div>`;
            return;
        }

        this.startIncrementalRender();
    }

    startIncrementalRender() {
        const container = document.getElementById('levelsContainer');
        if (!container || this.renderQueue.length === 0) return;

        const renderBatch = () => {
            const fragment = document.createDocumentFragment();
            const batch = this.renderQueue.splice(0, this.renderBatchSize);

            batch.forEach(level => {
                fragment.appendChild(this.createLevelCard(level));
            });

            container.appendChild(fragment);

            if (this.renderQueue.length > 0) {
                requestAnimationFrame(renderBatch);
            }
        };

        requestAnimationFrame(renderBatch);
    }

    createLevelCard(level) {
        const card = document.createElement('div');
        card.className = `level-card ${this.getCardStateClass(level)}`;
        card.setAttribute('data-difficulty', level.difficulty);

        // Header
        const header = document.createElement('div');
        header.className = 'level-card-header';
        header.innerHTML = `
            <h3>${level.name}</h3>
            <span class="difficulty-badge" style="background-color: ${this.getDifficultyColor(level.difficulty)}">
                ${level.difficulty}
            </span>
        `;
        card.appendChild(header);

        // Description
        const desc = document.createElement('p');
        desc.className = 'level-description';
        desc.textContent = level.description;
        card.appendChild(desc);

        // Requirements or Completion Status
        const status = document.createElement('div');
        status.innerHTML = level.isCompleted
            ? `<p class="completion-date">Completed</p>`
            : `<p class="requirements">Goal: ${level.requirements.minCorrect}/${level.requirements.totalQuestions} correct</p>`;
        card.appendChild(status);

        // Stars (if completed)
        if (level.isCompleted) {
            card.appendChild(this.createStarDisplay(level.starsEarned));

            // Performance metrics
            if (level.bestAccuracy || level.bestTime) {
                card.appendChild(this.createPerformanceDisplay(level));
            }
        }

        // Lock Overlay (if locked)
        if (level.isLocked) {
            card.appendChild(this.createLockOverlay(level));
        } else {
            // Clickable if unlocked
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => this.startLevel(level.id));
        }

        return card;
    }

    createStarDisplay(earned) {
        const container = document.createElement('div');
        container.className = 'level-stars';

        let html = '';
        // 3 stars max
        for (let i = 1; i <= 3; i++) {
            const isFilled = i <= earned;
            html += `<span class="${isFilled ? 'star-filled' : 'star-empty'}">${isFilled ? '★' : '☆'}</span>`;
        }
        container.innerHTML = html;
        return container;
    }

    createPerformanceDisplay(level) {
        const container = document.createElement('div');
        container.className = 'level-performance';

        let html = '';

        if (level.bestAccuracy) {
            html += `
                <div class="performance-item">
                    <span class="performance-icon">🎯</span>
                    <span class="performance-value">${Math.round(level.bestAccuracy)}%</span>
                </div>
            `;
        }

        if (level.bestTime) {
            const minutes = Math.floor(level.bestTime / 60);
            const seconds = Math.round(level.bestTime % 60);
            const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
            html += `
                <div class="performance-item">
                    <span class="performance-icon">⏱️</span>
                    <span class="performance-value">${timeStr}</span>
                </div>
            `;
        }

        container.innerHTML = html;
        return container;
    }

    createLockOverlay(level) {
        const wrapper = document.createElement('div');

        const requirementText = this.getUnlockRequirementText(level.unlockCondition);

        wrapper.innerHTML = `
            <div class="lock-badge">🔒</div>
            ${requirementText ? `
            <div class="lock-overlay">
                <div class="unlock-text">
                    ${requirementText}
                </div>
            </div>` : ''}
        `;

        return wrapper;
    }

    getUnlockRequirementText(condition) {
        if (!condition || condition === 'none') return null;

        if (condition.startsWith('total_stars_')) {
            const needed = parseInt(condition.split('_')[2]) || 0;
            return `Need ${needed} Total Stars`;
        }

        if (condition.startsWith('complete_level_')) {
            const parts = condition.split('_');
            const reqId = parseInt(parts[2]);
            const starsIdx = parts.indexOf('stars');
            const reqStars = (starsIdx !== -1 && parts.length > starsIdx + 1) ? (parseInt(parts[starsIdx + 1]) || 1) : 1;

            // Try to find level name for context
            const reqLevel = this.levels.find(l => l.id === reqId);
            const levelRef = reqLevel ? (reqLevel.name.split(':')[0] || reqLevel.name) : `Level ${reqId}`;

            if (reqStars > 1) {
                return `${levelRef}: ${reqStars} Stars Needed`;
            } else {
                return `Complete ${levelRef}`;
            }
        }

        return "Locked";
    }

    // --- Helpers ---

    getCardStateClass(level) {
        if (level.isLocked) return 'locked';
        if (level.isCompleted) return 'completed';
        return '';
    }

    getDifficultyColor(diff) {
        const colors = {
            'Easy': '#4CAF50',
            'Medium': '#FF9800',
            'Hard': '#FF5722',
            'Extreme': '#9C27B0'
        };
        return colors[diff] || '#999';
    }


    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    showError(msg) {
        const container = document.getElementById('levelsContainer');
        if (container) container.innerHTML = `<p class="error">Error: ${msg}</p>`;
    }

    startLevel(id) {
        window.location.href = `level_progress.html?levelId=${id}`;
    }

    getMCQMode() {
        try {
            // Check global appSettings first
            if (window.appSettings) {
                return window.appSettings.mcqMode || false;
            }
            
            // Fallback to localStorage
            const saved = localStorage.getItem('appSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                return settings.mcqMode || false;
            }
            
            return false;
        } catch (error) {
            console.error('Error getting MCQ mode:', error);
            return false;
        }
    }

    setMCQMode(enabled) {
        try {
            // Update global appSettings if available
            if (window.appSettings) {
                window.appSettings.mcqMode = enabled;
            }
            
            // Update localStorage
            const saved = localStorage.getItem('appSettings');
            const settings = saved ? JSON.parse(saved) : {};
            settings.mcqMode = enabled;
            localStorage.setItem('appSettings', JSON.stringify(settings));
            
            // Send to Python bridge for persistence
            if (window.pybridge) {
                window.pybridge.sendMessage(JSON.stringify({
                    type: 'save_settings',
                    payload: { settings: settings }
                }));
            }
        } catch (error) {
            console.error('Error setting MCQ mode:', error);
        }
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    window.levelsManager = new LevelsManager();
});
