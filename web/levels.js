class LevelsManager {
    constructor() {
        this.levels = [];
        this.stats = {};
        this.initializeEventListeners();
        this.setupBridge();
        this.loadLevels();
    }

    setupBridge() {
        // Don't block on bridge setup
        try {
            if (typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined') {
                new QWebChannel(qt.webChannelTransport, (channel) => {
                    window.pybridge = channel.objects.pybridge;
                    
                    if (window.pybridge && window.pybridge.messageReceived) {
                        window.pybridge.messageReceived.connect((response) => {
                            this.handlePythonResponse(response);
                        });
                    }
                    console.log('✓ Bridge ready');
                });
            }
        } catch (e) {
            console.warn('Bridge not available yet');
        }
    }

    handlePythonResponse(response) {
        try {
            console.log('📩 Received response:', response.substring(0, 200));
            const data = JSON.parse(response);
            console.log('✓ Parsed response type:', data.type);
            
            if (data.type === 'load_levels_response') {
                this.levels = data.payload.levels || [];
                this.stats = data.payload.stats || {};
                console.log('✓ Loaded', this.levels.length, 'levels');
                this.displayLevels();
                this.updateStats();
            } else if (data.type === 'error') {
                console.error('Error from Python:', data.payload.message);
                document.getElementById('levelsContainer').innerHTML = '<p class="no-levels">Error: ' + data.payload.message + '</p>';
            } else {
                console.warn('Unknown response type:', data.type);
            }
        } catch (e) {
            console.error('Error parsing Python response:', e, response);
        }
    }

    initializeEventListeners() {
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    loadLevels() {
        // Retry until bridge is ready
        const attemptLoad = () => {
            if (!window.pybridge) {
                console.warn('⏳ Bridge not ready, retrying...');
                setTimeout(attemptLoad, 100);
                return;
            }

            console.log('🚀 Sending load_levels message');
            const message = {
                type: 'load_levels',
                payload: {}
            };

            try {
                window.pybridge.sendMessage(JSON.stringify(message));
                console.log('📤 Levels load request sent');
            } catch (e) {
                console.error('❌ Error:', e);
            }
        };

        // Start trying after a small delay
        setTimeout(attemptLoad, 50);
    }

    displayLevels() {
        const container = document.getElementById('levelsContainer');
        container.innerHTML = '';

        if (!this.levels || this.levels.length === 0) {
            container.innerHTML = '<p class="no-levels">No levels found. Check your configuration.</p>';
            return;
        }

        this.levels.forEach((level) => {
            const card = this.createLevelCard(level);
            container.appendChild(card);
        });
    }

    createLevelCard(level) {
        const card = document.createElement('div');
        card.className = 'level-card';

        if (level.isLocked) {
            card.classList.add('locked');
        } else if (level.isCompleted) {
            card.classList.add('completed');
        }

        // Create stars display for completed levels
        let starsHtml = '';
        if (level.isCompleted) {
            starsHtml = '<div class="level-stars">';
            for (let i = 0; i < level.starsEarned; i++) {
                starsHtml += '<span class="star-filled">★</span>';
            }
            for (let i = level.starsEarned; i < 3; i++) {
                starsHtml += '<span class="star-empty">☆</span>';
            }
            starsHtml += '</div>';
        }

        // Create lock badge if locked
        let lockHtml = '';
        if (level.isLocked) {
            lockHtml = '<div class="lock-badge">🔒</div>';
        }

        // Create difficulty badge
        const diffColor = this.getDifficultyColor(level.difficulty);
        const diffBadge = `<span class="difficulty-badge" style="background-color: ${diffColor};">${level.difficulty}</span>`;

        const completionText = level.isCompleted 
            ? `<p class="completion-date">Completed</p>`
            : `<p class="requirements">Complete ${level.requirements.minCorrect}/${level.requirements.totalQuestions} questions</p>`;

        card.innerHTML = `
            <div class="level-card-header">
                <h3>${level.name}</h3>
                ${diffBadge}
            </div>
            <p class="level-description">${level.description}</p>
            ${completionText}
            ${starsHtml}
            ${lockHtml}
        `;

        // Add click handler only if unlocked
        if (!level.isLocked) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => this.startLevel(level.id));
        }

        return card;
    }

    getDifficultyColor(difficulty) {
        const colors = {
            'Easy': '#4CAF50',
            'Medium': '#FF9800',
            'Hard': '#FF5722',
            'Extreme': '#9C27B0'
        };
        return colors[difficulty] || '#999';
    }

    startLevel(levelId) {
        window.location.href = `level_progress.html?levelId=${levelId}`;
    }

    updateStats() {
        if (!this.stats) return;

        document.getElementById('totalStars').textContent = this.stats.totalStars || 0;
        document.getElementById('completedCount').textContent = this.stats.completedLevels || 0;
        document.getElementById('totalCount').textContent = this.stats.totalLevels || 0;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.levelsManager = new LevelsManager();
});
