class LevelsPage {
    constructor() {
        this.levels = [];
        this.currentLevel = null;
        this.init();
    }

    init() {
        this.loadLevels();

        // Escape to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    async loadLevels() {
        if (window.pythonBridge) {
            try {
                const result = await this.sendToPython('get_levels');
                if (result && result.length > 0) {
                    this.levels = result;
                    this.updateTotalStars();
                    this.renderLevels();
                } else {
                    console.warn('No levels returned from backend');
                    // Assuming a method like showError exists or we can just update loading text
                    document.getElementById('loading').textContent = "No levels found.";
                }
            } catch (e) {
                console.error("Failed to load levels", e);
                document.getElementById('loading').textContent = "Error loading levels.";
            }
        } else {
            // Mock data for testing
            this.levels = [
                { id: 1, title: "Test Level 1", description: "Test Desc", status: "unlocked", stars: 0, operation: "Addition", digits: 1, criteria: { questions: 10, min_accuracy: 0, time_limit: 0 } },
                { id: 2, title: "Locked Level", description: "Locked", status: "locked", stars: 0, operation: "Subtraction", digits: 1, required_stars: 1, criteria: { questions: 10, min_accuracy: 0, time_limit: 0 } }
            ];
            this.updateTotalStars();
            this.renderLevels();
        }
    }

    updateTotalStars() {
        let total = 0;
        this.levels.forEach(l => total += (l.stars || 0));

        const header = document.querySelector('.header-content');
        let starBadge = document.getElementById('total-stars-badge');

        if (!starBadge) {
            starBadge = document.createElement('div');
            starBadge.id = 'total-stars-badge';
            starBadge.className = 'total-stars-badge';
            starBadge.style.cssText = 'background: #FFD700; color: #333; padding: 5px 15px; border-radius: 20px; font-weight: bold; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
            // Insert after title
            const title = header.querySelector('h1');
            if (title) header.insertBefore(starBadge, title.nextSibling);
            else header.appendChild(starBadge);
        }

        starBadge.innerHTML = `<span>★</span> ${total} Stars`;
    }

    renderLevels() {
        document.getElementById('loading').style.display = 'none';
        const grid = document.getElementById('levelsGrid');
        grid.innerHTML = '';

        this.levels.forEach(level => {
            const card = document.createElement('div');
            card.className = `level-card ${level.status}`;

            // Add stars indicator if completed or unlocked
            let starsHtml = '';
            const stars = level.stars || 0;
            if (level.status !== 'locked') {
                starsHtml = `
                    <div class="level-stars">
                        ${Array(3).fill(0).map((_, i) =>
                    `<span class="star ${i < stars ? 'filled' : ''}">★</span>`
                ).join('')}
                    </div>
                `;
            }

            // Lock overlay content
            let lockHtml = '';
            if (level.status === 'locked') {
                const req = level.required_stars || 0;
                lockHtml = `
                    <div class="lock-overlay">
                        <span class="lock-icon">🔒</span>
                        <span class="lock-req">${req} ★ Required</span>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="level-id">${level.id}</div>
                <div class="level-info">
                    <h3>${level.title}</h3>
                    <p>${level.description}</p>
                    <div class="level-meta">
                        <span class="tag ${level.operation.toLowerCase()}">${level.operation}</span>
                        <span class="tag">${level.digits} Digit${level.digits > 1 ? 's' : ''}</span>
                    </div>
                </div>
                ${starsHtml}
                ${lockHtml}
            `;

            if (level.status !== 'locked') {
                card.onclick = () => this.openLevelModal(level);
            } else {
                card.onclick = (event) => this.showLockedMessage(level, event);
            }

            grid.appendChild(card);
        });
    }

    openLevelModal(level) {
        if (!level) return;
        this.currentLevel = level;

        document.getElementById('modalTitle').textContent = level.title;
        document.getElementById('modalDesc').textContent = level.description;
        document.getElementById('modalMeta').textContent = `${level.operation} • ${level.digits} Digit(s)`;

        // Criteria
        const c = level.criteria || {};
        document.getElementById('modalGoal').textContent = `${c.questions || 10} Questions`;
        document.getElementById('modalAcc').textContent = `Min ${c.min_accuracy || 0}% Accuracy`;

        const timeContainer = document.getElementById('modalTimeContainer');
        const timeEl = document.getElementById('modalTime');
        if (c.time_limit > 0) {
            timeContainer.style.display = 'flex';
            timeEl.textContent = `Max ${c.time_limit} Seconds`;
        } else {
            timeContainer.style.display = 'none';
        }

        const modal = document.getElementById('levelModal');
        modal.classList.add('active');

        document.getElementById('startLevelBtn').onclick = () => this.startLevel(level);
    }

    closeModal() {
        document.getElementById('levelModal').classList.remove('active');
        this.currentLevel = null;
    }

    startLevel(level) {
        // Navigate to level progress page
        if (window.pythonBridge) {
            // Start the session and navigate to progress page
            this.sendToPython('start_session', {
                mode: 'Level',
                operation: level.operation,
                digits: level.digits,
                target_value: level.criteria.questions,
                level_id: level.id,
                criteria: level.criteria
            }).then(() => {
                this.sendToPython('navigate_to_level_progress');
            });
        }
    }

    sendToPython(action, data = {}) {
        return new Promise((resolve, reject) => {
            if (window.pythonBridge) {
                const callbackId = 'cb_' + Date.now() + Math.random();
                if (!window.pythonBridge.callbacks) window.pythonBridge.callbacks = {};
                window.pythonBridge.callbacks[callbackId] = resolve;
                window.pythonBridge.send(action, JSON.stringify(data), callbackId);
            } else {
                reject("No bridge");
            }
        });
    }
    showLockedMessage(level, event) {
        // Shake animation
        const card = event.currentTarget;
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);

        // Optional: Show a toast or clearer message
        // For now, the overlay text "X Stars Required" is sufficient feedback combined with the shake
        console.log(`Level ${level.id} is locked. Requires ${level.required_stars} stars.`);
    }
}

// Global for modal close button
window.closeLevelModal = () => {
    if (window.levelsPage) window.levelsPage.closeModal();
};
