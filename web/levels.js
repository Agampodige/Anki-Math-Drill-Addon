/**
 * LevelsManager handles the fetching and display of level data.
 * Refactored for modularity and performance.
 */
class LevelsManager {
    constructor() {
        this.levels = [];
        this.stats = {};
        this.bridge = null;

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
    }

    // --- Bridge & Data Loading ---

    setupBridge() {
        // Safe bridge initialization with retry logic
        const initBridge = () => {
            if (typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined') {
                new QWebChannel(qt.webChannelTransport, (channel) => {
                    this.bridge = channel.objects.pybridge;
                    if (this.bridge) {
                        this.bridge.messageReceived.connect(this.handlePythonResponse.bind(this));
                        console.log('✓ Bridge connected');
                        this.loadLevels();
                    }
                });
            } else {
                console.warn('Bridge not ready, retrying...');
                setTimeout(initBridge, 100);
            }
        };
        initBridge();
    }

    loadLevels() {
        if (!this.bridge) return;

        console.log('🚀 Requesting levels...');
        this.bridge.sendMessage(JSON.stringify({
            type: 'load_levels',
            payload: {}
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
        this.renderLevelList();
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

    renderLevelList() {
        const container = document.getElementById('levelsContainer');
        if (!container) return;

        container.innerHTML = '';

        if (this.levels.length === 0) {
            container.innerHTML = '<div class="empty-state">No levels available.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        this.levels.forEach(level => {
            fragment.appendChild(this.createLevelCard(level));
        });
        container.appendChild(fragment);
    }

    createLevelCard(level) {
        const card = document.createElement('div');
        card.className = `level-card ${this.getCardStateClass(level)}`;

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
        }

        // Lock Overlay (if locked)
        if (level.isLocked) {
            card.appendChild(this.createLockOverlay(level));
        } else {
            // Clickable if unlocked
            card.style.cursor = 'pointer';
            // Use dataset for event delegation if we wanted, but closure is fine here for simplicity
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

    createLockOverlay(level) {
        const overlay = document.createElement('div');
        overlay.className = 'lock-overlay'; // This needs to be styled in CSS to cover the card

        // Lock Icon
        let content = '<div class="lock-icon">🔒</div>';

        // Unlock Requirement Text
        const needed = this.getStarsNeeded(level.unlockCondition);
        if (needed) {
            content += `<div class="unlock-text">Need ${needed} Stars</div>`;
        }

        // We ensure the card has "position: relative" via CSS class "locked" usually
        // But we add the overlay as a child.

        // NOTE: The previous code had lock icon separate from overlay. 
        // We'll combine them or keep separate based on existing CSS.
        // Assuming existing CSS handles .lock-badge and .lock-overlay separately?
        // Let's stick to a cleaner single overlay approach if possible, 
        // but to handle existing CSS, I will replicate structure if needed.
        // Replicating previous structure:

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="lock-badge">🔒</div>
            ${needed ? `
            <div class="lock-overlay">
                <div class="unlock-text">
                    ${needed} ${needed === 1 ? 'Star' : 'Stars'} Needed<br>
                    ${'⭐'.repeat(Math.min(needed, 3))}
                </div>
            </div>` : ''}
        `;

        return wrapper;
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

    getStarsNeeded(condition) {
        if (condition && condition.startsWith('total_stars_')) {
            return parseInt(condition.split('_')[2]) || null;
        }
        return null;
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
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    window.levelsManager = new LevelsManager();
});
