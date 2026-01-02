class MathDrillWeb {
    constructor() {
        this.sessionActive = false;
        this.sessionAttempts = [];
        this.sessionMistakes = [];
        this.sessionStartTime = null;
        this.startTime = null;
        this.streak = 0;
        this.currentAnswer = 0;
        this.retakActive = false;
        this.retakeQueue = [];
        this.retakeMastery = {};
        this.currentFocusArea = null;
        this.focusSessionCount = 0;
        
        this.initElements();
        this.initEventListeners();
        this.initTimers();
        this.updateStats();
    }

    initElements() {
        // Header elements
        this.coachLabel = document.getElementById('coachLabel');
        this.streakCounter = document.getElementById('streakCounter');
        
        // Control elements
        this.modeBox = document.getElementById('modeBox');
        this.operationBox = document.getElementById('operationBox');
        this.digitsBox = document.getElementById('digitsBox');
        
        // Stats elements
        this.sessionCount = document.getElementById('sessionCount');
        this.todayCount = document.getElementById('todayCount');
        this.lifetimeCount = document.getElementById('lifetimeCount');
        this.statsDetail = document.getElementById('statsDetail');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressLabel = document.getElementById('progressLabel');
        this.progressFill = document.getElementById('progressFill');
        this.ghostLine = document.getElementById('ghostLine');
        
        // Challenge elements
        this.questionNumber = document.getElementById('questionNumber');
        this.timerDisplay = document.getElementById('timerDisplay');
        this.questionText = document.getElementById('questionText');
        this.answerInput = document.getElementById('answerInput');
        this.feedback = document.getElementById('feedback');
        
        // Modal elements
        this.modalOverlay = document.getElementById('modalOverlay');
        this.resultModal = document.getElementById('resultModal');
        this.settingsModal = document.getElementById('settingsModal');
        this.achievementsModal = document.getElementById('achievementsModal');
        this.weaknessModal = document.getElementById('weaknessModal');
        this.masteryModal = document.getElementById('masteryModal');
        this.progressModal = document.getElementById('progressModal');
        this.achievementToast = document.getElementById('achievementToast');
    }

    initEventListeners() {
        // Control changes
        this.modeBox.addEventListener('change', () => this.resetSession());
        this.operationBox.addEventListener('change', () => this.resetSession());
        this.digitsBox.addEventListener('change', () => this.resetSession());
        
        // Answer input
        this.answerInput.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.answerInput.addEventListener('input', (e) => this.handleInput(e));
        
        // Header buttons (excluding progress button since it's now a hyperlink)
        document.querySelectorAll('.icon-btn[data-action]').forEach(btn => {
            console.log('Setting up button:', btn.dataset.action, btn);
            btn.addEventListener('click', () => {
                console.log('Button clicked:', btn.dataset.action);
                this.handleHeaderAction(btn.dataset.action);
            });
        });
        
        // Modal close buttons
        document.getElementById('closeResultBtn').addEventListener('click', () => this.closeModal('result'));
        document.getElementById('closeSettingsBtn').addEventListener('click', () => this.closeModal('settings'));
        document.getElementById('closeAchievementsBtn').addEventListener('click', () => this.closeModal('achievements'));
        document.getElementById('closeWeaknessBtn').addEventListener('click', () => this.closeModal('weakness'));
        document.getElementById('closeMasteryBtn').addEventListener('click', () => this.closeModal('mastery'));
        document.getElementById('closeProgressBtn').addEventListener('click', () => this.closeModal('progress'));
        document.getElementById('toastCloseBtn').addEventListener('click', () => this.closeToast());
        
        // Settings
        document.getElementById('soundToggle').addEventListener('click', () => this.toggleSound());
        
        // Retake button
        document.getElementById('retakeBtn').addEventListener('click', () => this.startRetakeMistakes());
        
        // Modal overlay click
        this.modalOverlay.addEventListener('click', () => this.closeAllModals());
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
    }

    initTimers() {
        // UI update timer
        setInterval(() => this.updateLiveTimer(), 100);
        
        // Session timer (for sprint mode)
        this.sessionTimer = null;
    }

    handleKeydown(e) {
        const key = e.key;
        
        // Allow Enter for submitting
        if (key === 'Enter') {
            e.preventDefault();
            this.checkAnswer();
            return;
        }
        
        // Allow Escape for clearing
        if (key === 'Escape') {
            this.answerInput.value = '';
            if (this.sessionActive) {
                this.resetSession();
            }
            return;
        }
        
        // Allow Backspace, Delete, and navigation keys
        if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
            return;
        }
        
        // Allow minus sign (for negative numbers)
        if (key === '-' && (!this.answerInput.value || this.answerInput.selectionStart === 0)) {
            return;
        }
        
        // Only allow digits
        if (!/^\d$/.test(key) && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
        }
    }

    handleInput(e) {
        // Filter out non-numeric characters
        const value = e.target.value;
        const filtered = value.replace(/[^0-9-]/g, '');
        if (value !== filtered) {
            e.target.value = filtered;
        }
    }

    handleGlobalKeydown(e) {
        // End Session Early (Ctrl+Q)
        if (e.ctrlKey && e.key === 'q') {
            if (this.sessionActive) {
                this.endSession();
            }
            return;
        }
        
        // Dialog shortcuts
        if (!e.ctrlKey && !e.altKey) {
            switch(e.key.toLowerCase()) {
                case 's':
                    this.openModal('settings');
                    break;
                case 'a':
                    this.openModal('achievements');
                    break;
                case 'p':
                    navigateToProgress();
                    break;
                case 'w':
                    this.openModal('weakness');
                    break;
                case 'm':
                    this.cycleMode();
                    break;
                case 'o':
                    this.cycleOperation();
                    break;
                case 'f1':
                    this.digitsBox.selectedIndex = 0;
                    break;
                case 'f2':
                    this.digitsBox.selectedIndex = 1;
                    break;
                case 'f3':
                    this.digitsBox.selectedIndex = 2;
                    break;
            }
        }
    }

    handleHeaderAction(action) {
        console.log('handleHeaderAction called with:', action);
        switch(action) {
            case 'progress':
                this.openModal('progress');
                break;
            case 'weakness':
                this.openModal('weakness');
                break;
            case 'achievements':
                this.openModal('achievements');
                break;
            case 'settings':
                this.openModal('settings');
                break;
        }
    }

    cycleMode() {
        const index = (this.modeBox.selectedIndex + 1) % this.modeBox.options.length;
        this.modeBox.selectedIndex = index;
    }

    cycleOperation() {
        const index = (this.operationBox.selectedIndex + 1) % this.operationBox.options.length;
        this.operationBox.selectedIndex = index;
    }

    resetSession() {
        this.sessionActive = false;
        this.sessionAttempts = [];
        this.sessionMistakes = [];
        this.sessionStartTime = null;
        this.retakActive = false;
        this.streak = 0;
        this.startTime = null;
        this.currentFocusArea = null;
        this.focusSessionCount = 0;
        
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }
        
        // Reset UI
        this.streakCounter.textContent = '🔥 0';
        this.progressFill.style.width = '0%';
        this.ghostLine.style.display = 'none';
        this.questionText.textContent = 'Ready?';
        this.feedback.textContent = 'Press Enter to Start';
        this.answerInput.value = '';
        this.answerInput.readOnly = false;
        this.answerInput.focus();
        
        // Enable/disable controls based on mode
        const mode = this.modeBox.value;
        this.operationBox.disabled = mode === 'Adaptive Coach';
        this.digitsBox.disabled = mode === 'Adaptive Coach';
        
        if (mode === 'Adaptive Coach') {
            this.coachLabel.style.display = 'block';
            this.coachLabel.textContent = 'Coach is analyzing your skills...';
        } else {
            this.coachLabel.style.display = 'none';
        }
        
        // Setup progress bar
        if (mode.includes('Drill')) {
            this.progressContainer.style.display = 'block';
            this.progressLabel.textContent = '0 / 20 Questions';
        } else if (mode.includes('Sprint')) {
            this.progressContainer.style.display = 'block';
            this.progressLabel.textContent = '60s Remaining';
        } else {
            this.progressContainer.style.display = 'none';
        }
        
        // Notify Python
        this.sendToPython('reset_session', { mode });
    }

    startSessionIfNeeded() {
        const mode = this.modeBox.value;
        if (mode !== 'Free Play' && !this.sessionActive) {
            this.sessionActive = true;
            this.sessionAttempts = [];
            this.sessionMistakes = [];
            this.sessionStartTime = new Date();
            
            if (mode.includes('Sprint')) {
                this.startSprintTimer();
            }
            
            this.sendToPython('start_session', {
                mode,
                operation: this.operationBox.value,
                digits: parseInt(this.digitsBox.value.split()[0])
            });
        }
    }

    startSprintTimer() {
        this.sessionTimer = setInterval(() => {
            const elapsed = (Date.now() - this.sessionStartTime) / 1000;
            const remaining = Math.max(0, 60 - elapsed);
            
            this.progressFill.style.width = `${((60 - remaining) / 60) * 100}%`;
            this.progressLabel.textContent = `${Math.ceil(remaining)}s Remaining`;
            
            if (remaining <= 0) {
                this.endSession();
            }
        }, 1000);
    }

    generateQuestion() {
        if (!this.retakActive) {
            this.startSessionIfNeeded();
        }
        
        // Retake logic
        if (this.retakActive) {
            if (this.retakeQueue.length === 0) {
                this.retakActive = false;
                this.feedback.textContent = '🌟 MASTERY COMPLETE! 🌟';
                this.feedback.style.color = 'var(--success-color)';
                this.questionNumber.textContent = 'ALL MISTAKES MASTERED';
                this.questionText.textContent = 'Perfect!';
                return;
            }
            
            const [qText, qAns] = this.retakeQueue[0];
            this.currentAnswer = qAns;
            this.questionText.textContent = qText;
            
            const count = this.retakeQueue.length;
            const mastered = Object.values(this.retakeMastery).filter(v => v >= 2).length;
            this.questionNumber.textContent = `RETAKE MODE: ${count} Left (${mastered} Mastered)`;
            
            this.answerInput.readOnly = false;
            this.answerInput.value = '';
            this.answerInput.focus();
            this.feedback.textContent = 'Get each right twice in a row!';
            this.feedback.style.color = 'var(--muted-color)';
            
            this.startTime = Date.now() / 1000;
            return;
        }
        
        // Coach mode
        if (this.modeBox.value === 'Adaptive Coach') {
            this.sendToPython('get_coach_recommendation', {}, (response) => {
                if (response.target) {
                    this.currentFocusArea = response.target;
                    this.focusSessionCount++;
                    
                    this.operationBox.value = response.target[0];
                    const digitIndex = Math.max(0, Math.min(response.target[1] - 1, this.digitsBox.options.length - 1));
                    this.digitsBox.selectedIndex = digitIndex;
                    
                    this.coachLabel.textContent = `Coach: ${response.reason}`;
                }
                this.generateQuestionInternal();
            });
        } else {
            this.generateQuestionInternal();
        }
    }

    generateQuestionInternal() {
        this.answerInput.readOnly = false;
        this.answerInput.value = '';
        this.answerInput.focus();
        this.feedback.textContent = '';
        this.feedback.style.color = 'var(--muted-color)';
        
        let operation = this.operationBox.value;
        const digits = parseInt(this.digitsBox.value.split()[0]);
        
        if (operation === 'Mixed') {
            const operations = ['Addition', 'Subtraction', 'Multiplication', 'Division'];
            operation = operations[Math.floor(Math.random() * operations.length)];
        }
        
        let a, b, answer, symbol;
        
        const low = digits === 1 ? 2 : Math.pow(10, digits - 1);
        const high = Math.pow(10, digits) - 1;
        
        if (operation === 'Division') {
            const bLow = 2;
            const bHigh = digits === 1 ? 12 : (digits > 2 ? Math.pow(10, digits - 1) - 1 : 20);
            if (digits === 2) bHigh = 20;
            if (digits === 3) bHigh = 50;
            
            b = Math.floor(Math.random() * (bHigh - bLow + 1)) + bLow;
            answer = Math.floor(Math.random() * (Math.min(high, 20) - 2 + 1)) + 2;
            a = b * answer;
            symbol = '÷';
        } else {
            a = Math.floor(Math.random() * (high - low + 1)) + low;
            b = Math.floor(Math.random() * (high - low + 1)) + low;
            
            if (operation === 'Addition') {
                answer = a + b;
                symbol = '+';
            } else if (operation === 'Subtraction') {
                if (a < b) [a, b] = [b, a];
                answer = a - b;
                symbol = '−';
            } else if (operation === 'Multiplication') {
                answer = a * b;
                symbol = '×';
            }
        }
        
        this.currentAnswer = answer;
        
        // Update question number
        const count = this.sessionAttempts.length + 1;
        const mode = this.modeBox.value;
        if (mode.includes('Drill')) {
            this.questionNumber.textContent = `QUESTION ${count} OF 20`;
        } else if (mode.includes('Sprint')) {
            this.questionNumber.textContent = `SPRINT MODE - Q#${count}`;
        } else {
            this.questionNumber.textContent = `QUESTION #${count}`;
        }
        
        this.questionText.textContent = `${a} ${symbol} ${b} =`;
        this.startTime = Date.now() / 1000;
    }

    checkAnswer() {
        if (this.startTime === null) {
            this.generateQuestion();
            return;
        }
        
        const userText = this.answerInput.value.trim();
        if (!userText) return;
        
        const elapsed = (Date.now() / 1000) - this.startTime;
        let correct = false;
        
        try {
            const val = parseFloat(userText);
            correct = Math.abs(val - this.currentAnswer) < 0.001;
        } catch (e) {
            correct = false;
        }
        
        // Log attempt
        this.sendToPython('log_attempt', {
            operation: this.operationBox.value,
            digits: parseInt(this.digitsBox.value.split()[0]),
            correct,
            time: elapsed
        });
        
        this.sessionAttempts.push({ correct, time: elapsed });
        
        // Play sound
        this.sendToPython('play_sound', { success: correct });
        
        if (correct) {
            this.streak++;
            this.feedback.textContent = `Correct! (${elapsed.toFixed(2)}s)`;
            this.feedback.style.color = 'var(--success-color)';
            this.flashOverlay('success');
            
            this.answerInput.readOnly = true;
            
            if (this.retakActive) {
                const qText = this.questionText.textContent;
                this.retakeMastery[qText] = (this.retakeMastery[qText] || 0) + 1;
                
                if (this.retakeMastery[qText] >= 2) {
                    this.retakeQueue.shift();
                    this.feedback.textContent = '✅ MASTERED!';
                } else {
                    const item = this.retakeQueue.shift();
                    this.retakeQueue.push(item);
                    this.feedback.textContent = '1/2 - Keep going!';
                }
                
                setTimeout(() => this.generateQuestion(), 800);
                return;
            }
            
            this.updateProgress();
            
            if (this.sessionActive || this.modeBox.value === 'Free Play') {
                if (this.sessionAttempts.length > 0) {
                    setTimeout(() => this.generateQuestion(), 600);
                }
            }
        } else {
            this.streak = 0;
            const currQText = this.questionText.textContent;
            this.sessionMistakes.push([currQText, this.currentAnswer, userText]);
            
            this.feedback.textContent = `Wrong. Answer: ${this.currentAnswer}`;
            this.feedback.style.color = 'var(--error-color)';
            this.flashOverlay('error');
            this.shakeInput();
            
            this.startTime = null;
            this.answerInput.value = '';
            
            if (this.retakActive) {
                this.retakeMastery[currQText] = 0;
                const item = this.retakeQueue.shift();
                this.retakeQueue.push(item);
                setTimeout(() => this.generateQuestion(), 1500);
                return;
            }
            
            this.updateProgress();
        }
        
        this.streakCounter.textContent = `🔥 ${this.streak}`;
        this.updateStats();
    }

    updateProgress() {
        const mode = this.modeBox.value;
        const count = this.sessionAttempts.length;
        
        if (mode.includes('Drill')) {
            this.progressFill.style.width = `${(count / 20) * 100}%`;
            this.progressLabel.textContent = `${count} / 20`;
            
            if (count >= 20) {
                this.endSession();
            }
        }
    }

    endSession() {
        this.sessionActive = false;
        
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }
        
        this.answerInput.readOnly = true;
        
        const total = this.sessionAttempts.length;
        const correct = this.sessionAttempts.filter(a => a.correct).length;
        const totalTime = this.sessionAttempts.reduce((sum, a) => sum + a.time, 0);
        const avgSpeed = total > 0 ? totalTime / total : 0;
        const accuracy = total > 0 ? (correct / total) * 100 : 0;
        
        const sessionData = {
            mode: this.modeBox.value,
            operation: this.operationBox.value,
            digits: parseInt(this.digitsBox.value.split()[0]),
            total,
            correct,
            avgSpeed,
            totalTime,
            mistakes: this.sessionMistakes,
            maxStreak: this.streak
        };
        
        this.sendToPython('end_session', sessionData, (response) => {
            this.showResultModal(sessionData, response.newBadges);
        });
    }

    showResultModal(sessionData, newBadges) {
        const modal = this.resultModal;
        const accuracy = sessionData.total > 0 ? (sessionData.correct / sessionData.total) * 100 : 0;
        
        document.getElementById('resultAccuracy').textContent = `${accuracy.toFixed(1)}%`;
        document.getElementById('resultSpeed').textContent = `${sessionData.avgSpeed.toFixed(2)}s`;
        document.getElementById('resultTotal').textContent = sessionData.total;
        document.getElementById('resultTime').textContent = `${sessionData.totalTime.toFixed(1)}s`;
        
        const mistakesSection = document.getElementById('mistakesSection');
        const mistakesList = document.getElementById('mistakesList');
        const retakeBtn = document.getElementById('retakeBtn');
        
        if (sessionData.mistakes.length > 0) {
            mistakesSection.style.display = 'block';
            mistakesList.innerHTML = '';
            
            sessionData.mistakes.forEach(mistake => {
                const item = document.createElement('div');
                item.className = 'mistake-item';
                item.textContent = `• ${mistake[0]} = ${mistake[1]} (You: ${mistake[2]})`;
                mistakesList.appendChild(item);
            });
            
            retakeBtn.style.display = 'block';
        } else {
            mistakesSection.style.display = 'none';
            retakeBtn.style.display = 'none';
            
            // Show perfect message
            const perfectMsg = document.createElement('div');
            perfectMsg.style.color = 'var(--accent-color)';
            perfectMsg.style.fontSize = '18px';
            perfectMsg.style.fontWeight = 'bold';
            perfectMsg.style.textAlign = 'center';
            perfectMsg.style.marginBottom = '20px';
            perfectMsg.textContent = 'Perfect Session! 🎉';
            mistakesSection.parentNode.insertBefore(perfectMsg, mistakesSection);
        }
        
        this.openModal('result');
        
        if (newBadges && newBadges.length > 0) {
            setTimeout(() => this.showAchievementToast(newBadges), 500);
        }
    }

    startRetakeMistakes() {
        const uniqueMistakes = [];
        const seen = new Set();
        
        this.sessionMistakes.forEach(mistake => {
            if (!seen.has(mistake[0])) {
                uniqueMistakes.push([mistake[0], mistake[1]]);
                seen.add(mistake[0]);
            }
        });
        
        this.closeModal('result');
        this.startRetake(uniqueMistakes);
    }

    startRetake(mistakes) {
        this.retakActive = true;
        this.retakeQueue = mistakes;
        this.retakeMastery = {};
        mistakes.forEach(([qText, _]) => {
            this.retakeMastery[qText] = 0;
        });
        
        this.sessionAttempts = [];
        this.sessionMistakes = [];
        this.generateQuestion();
    }

    updateLiveTimer() {
        if (this.startTime) {
            const elapsed = (Date.now() / 1000) - this.startTime;
            this.timerDisplay.textContent = `⏱ ${elapsed.toFixed(1)}s`;
        } else {
            this.timerDisplay.textContent = '⏱ 0.0s';
        }
    }

    updateStats() {
        this.sendToPython('get_stats', {}, (stats) => {
            this.sessionCount.textContent = stats.session;
            this.todayCount.textContent = stats.today;
            this.lifetimeCount.textContent = stats.lifetime;
            
            if (stats.today > 0) {
                this.statsDetail.textContent = `Today: ${stats.accuracy.toFixed(0)}% accuracy • ${stats.avgSpeed.toFixed(2)}s avg • ${Math.floor(stats.totalTime)}s total`;
            } else {
                this.statsDetail.textContent = 'Start answering to see stats';
            }
        });
    }

    flashOverlay(type) {
        const color = type === 'success' ? 'var(--success-color)' : 'var(--error-color)';
        this.questionText.style.backgroundColor = color;
        this.questionText.style.transition = 'background-color 0.3s ease';
        
        setTimeout(() => {
            this.questionText.style.backgroundColor = 'transparent';
        }, 300);
    }

    shakeInput() {
        this.answerInput.classList.add('shake');
        setTimeout(() => {
            this.answerInput.classList.remove('shake');
        }, 300);
    }

    openModal(type) {
        this.modalOverlay.style.display = 'flex';
        
        switch(type) {
            case 'result':
                this.resultModal.style.display = 'block';
                break;
            case 'settings':
                this.settingsModal.style.display = 'block';
                this.loadSettings();
                break;
            case 'achievements':
                this.achievementsModal.style.display = 'block';
                this.loadAchievements();
                break;
            case 'weakness':
                this.weaknessModal.style.display = 'block';
                this.loadWeakness();
                break;
            case 'mastery':
                this.masteryModal.style.display = 'block';
                this.loadMastery();
                break;
            case 'progress':
                this.progressModal.style.display = 'block';
                this.loadProgress();
                break;
        }
    }

    closeModal(type) {
        switch(type) {
            case 'result':
                this.resultModal.style.display = 'none';
                this.resetSession();
                break;
            case 'settings':
                this.settingsModal.style.display = 'none';
                break;
            case 'achievements':
                this.achievementsModal.style.display = 'none';
                break;
            case 'weakness':
                this.weaknessModal.style.display = 'none';
                break;
            case 'mastery':
                this.masteryModal.style.display = 'none';
                break;
            case 'progress':
                this.progressModal.style.display = 'none';
                break;
        }
        
        this.closeAllModals();
        this.answerInput.focus();
    }

    closeAllModals() {
        this.modalOverlay.style.display = 'none';
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    closeToast() {
        this.achievementToast.style.display = 'none';
    }

    loadSettings() {
        this.sendToPython('get_settings', {}, (settings) => {
            const btn = document.getElementById('soundToggle');
            btn.textContent = `Sound Effects: ${settings.soundEnabled ? 'ON' : 'OFF'}`;
        });
    }

    loadAchievements() {
        this.sendToPython('get_achievements', {}, (achievements) => {
            const list = document.getElementById('achievementsList');
            list.innerHTML = '';
            
            achievements.forEach(achievement => {
                const card = document.createElement('div');
                card.className = `achievement-card ${achievement.unlocked ? 'unlocked' : ''}`;
                
                card.innerHTML = `
                    <div class="achievement-icon">${achievement.unlocked ? '🏆' : '🔒'}</div>
                    <div class="achievement-info">
                        <h4>${achievement.name}</h4>
                        <p>${achievement.desc}</p>
                    </div>
                `;
                
                list.appendChild(card);
            });
        });
    }

    loadWeakness() {
        this.sendToPython('get_weakness', {}, (weaknesses) => {
            const list = document.getElementById('weaknessList');
            list.innerHTML = '';
            
            if (weaknesses.length === 0) {
                const noData = document.createElement('div');
                noData.style.color = 'var(--success-color)';
                noData.style.fontSize = '16px';
                noData.style.fontWeight = 'bold';
                noData.style.textAlign = 'center';
                noData.style.padding = '20px';
                noData.textContent = '🎉 No weakness data available!';
                list.appendChild(noData);
                return;
            }
            
            weaknesses.forEach(weakness => {
                const card = document.createElement('div');
                let cardClass = 'weakness-card';
                
                if (!weakness.practiced) {
                    cardClass += ' unpracticed';
                } else if (weakness.weaknessScore > 70) {
                    cardClass += ' high-weakness';
                } else if (weakness.weaknessScore > 50) {
                    cardClass += ' medium-weakness';
                } else {
                    cardClass += ' low-weakness';
                }
                
                card.className = cardClass;
                
                const scoreText = !weakness.practiced ? 'NEW' : `Score: ${weakness.weaknessScore.toFixed(0)}`;
                const statsText = weakness.practiced ? 
                    `Accuracy: ${weakness.accuracy.toFixed(0)}% | Speed: ${weakness.speed.toFixed(1)}s` : 
                    'Not practiced yet';
                
                card.innerHTML = `
                    <div class="weakness-info">
                        <h4>${weakness.operation} - ${weakness.digits} digits</h4>
                        <p>Level: ${weakness.level}</p>
                        <p>${statsText}</p>
                        ${!weakness.practiced ? '<p class="suggestions">📝 Start here to build foundation skills</p>' : ''}
                        ${weakness.suggestions && weakness.suggestions.length > 0 ? `<p class="suggestions">Tips: ${weakness.suggestions.join(' | ')}</p>` : ''}
                    </div>
                    <div class="weakness-score">${scoreText}</div>
                `;
                
                list.appendChild(card);
            });
        });
    }

    loadMastery() {
        this.sendToPython('get_mastery', {}, (data) => {
            const grid = document.getElementById('masteryGrid');
            grid.innerHTML = '';
            
            // Headers
            grid.innerHTML += '<div class="mastery-header"></div>';
            [1, 2, 3].forEach(d => {
                const header = document.createElement('div');
                header.className = 'mastery-header';
                header.textContent = `${d} Digit`;
                grid.appendChild(header);
            });
            
            ['Addition', 'Subtraction', 'Multiplication', 'Division'].forEach(op => {
                const header = document.createElement('div');
                header.className = 'mastery-header';
                header.textContent = op;
                grid.appendChild(header);
                
                [1, 2, 3].forEach(d => {
                    const stats = data[`${op}-${d}`] || { level: 'Novice', acc: 0, speed: 0, count: 0 };
                    const cell = document.createElement('div');
                    cell.className = `mastery-cell ${stats.level.toLowerCase()}`;
                    
                    cell.innerHTML = `
                        <div class="mastery-level">${stats.level.toUpperCase()}</div>
                        <div class="mastery-detail">${stats.acc.toFixed(0)}% | ${stats.speed.toFixed(1)}s</div>
                        <div class="mastery-count">(${stats.count} plays)</div>
                    `;
                    
                    grid.appendChild(cell);
                });
            });
        });
    }

    toggleSound() {
        this.sendToPython('toggle_sound', {}, (settings) => {
            const btn = document.getElementById('soundToggle');
            btn.textContent = `Sound Effects: ${settings.soundEnabled ? 'ON' : 'OFF'}`;
        });
    }

    showAchievementToast(badges) {
        const toast = this.achievementToast;
        const message = document.getElementById('toastMessage');
        
        message.innerHTML = badges.map(b => `<p>UNLOCKED: ${b.name}<br>${b.desc}</p>`).join('');
        toast.style.display = 'block';
    }

    loadProgress() {
        // Load progress data with sample data for now
        this.updateProgressStats();
        this.updateProgressMastery();
        this.updateProgressActivity();
        this.updateProgressBests();
        this.updateProgressAchievements();
    }

    updateProgressStats() {
        // Sample data - in real implementation this would come from Python
        document.getElementById('progressTotalQuestions').textContent = '247';
        document.getElementById('progressAvgAccuracy').textContent = '87.3%';
        document.getElementById('progressAvgSpeed').textContent = '3.2s';
        document.getElementById('progressCurrentStreak').textContent = '12';
    }

    updateProgressMastery() {
        const masteryGrid = document.getElementById('progressMasteryGrid');
        masteryGrid.innerHTML = '';
        
        // Headers
        masteryGrid.innerHTML += '<div class="mastery-header"></div>';
        [1, 2, 3].forEach(d => {
            const header = document.createElement('div');
            header.className = 'mastery-header';
            header.textContent = `${d} Digit`;
            masteryGrid.appendChild(header);
        });
        
        // Sample mastery data
        const masteryData = {
            'Addition': ['Apprentice', 'Pro', 'Master'],
            'Subtraction': ['Novice', 'Apprentice', 'Pro'],
            'Multiplication': ['Novice', 'Novice', 'Apprentice'],
            'Division': ['Novice', 'Novice', 'Novice']
        };
        
        ['Addition', 'Subtraction', 'Multiplication', 'Division'].forEach(op => {
            const opLabel = document.createElement('div');
            opLabel.className = 'operation-label';
            opLabel.textContent = op;
            masteryGrid.appendChild(opLabel);
            
            [1, 2, 3].forEach(d => {
                const level = masteryData[op][d-1];
                const cell = document.createElement('div');
                cell.className = `mastery-cell ${level.toLowerCase()}`;
                cell.innerHTML = `
                    <div class="mastery-level">${level.toUpperCase()}</div>
                    <div class="mastery-detail">${85 + d*3}% | ${4.5 - d*0.3}s</div>
                    <div class="mastery-count">(${10 + d*5} plays)</div>
                `;
                masteryGrid.appendChild(cell);
            });
        });
    }

    updateProgressActivity() {
        const activityContainer = document.getElementById('progressRecentActivity');
        activityContainer.innerHTML = '';
        
        // Sample activity data
        const activities = [
            { date: '2024-01-02', timeAgo: '1 day ago', questions: 25, accuracy: 88, speed: 3.2 },
            { date: '2024-01-01', timeAgo: '2 days ago', questions: 18, accuracy: 92, speed: 2.8 },
            { date: '2023-12-31', timeAgo: '3 days ago', questions: 32, accuracy: 85, speed: 3.5 },
            { date: '2023-12-30', timeAgo: '4 days ago', questions: 15, accuracy: 90, speed: 2.9 }
        ];
        
        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div>
                    <div>${activity.date}</div>
                    <div class="activity-date">${activity.timeAgo}</div>
                </div>
                <div class="activity-stats">
                    <span class="activity-count">${activity.questions} questions</span>
                    <span class="activity-accuracy">${activity.accuracy}%</span>
                    <span>${activity.speed}s avg</span>
                </div>
            `;
            activityContainer.appendChild(item);
        });
    }

    updateProgressBests() {
        const bestsContainer = document.getElementById('progressPersonalBests');
        bestsContainer.innerHTML = '';
        
        const bests = [
            { title: '🎯 Drill (20 Questions)', value: '45.2s' },
            { title: '⚡ Sprint (60s)', value: '28 questions' },
            { title: '🎯 Best Accuracy', value: '96.8%' },
            { title: '⚡ Fastest Speed', value: '1.8s' }
        ];
        
        bests.forEach(best => {
            const item = document.createElement('div');
            item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 8px; background-color: var(--dark-bg); border-radius: 6px;';
            item.innerHTML = `
                <span style="color: var(--text-color); font-size: 14px;">${best.title}</span>
                <span style="color: var(--accent-color); font-weight: bold;">${best.value}</span>
            `;
            bestsContainer.appendChild(item);
        });
    }

    updateProgressAchievements() {
        const achievementsContainer = document.getElementById('progressAchievements');
        achievementsContainer.innerHTML = '';
        
        const achievements = [
            { name: '🏆 Speed Demon', desc: 'Complete 20 questions in under 2 seconds each', unlocked: true },
            { name: '🔒 Accuracy Master', desc: 'Achieve 95% accuracy over 50 questions', unlocked: false, progress: 75 },
            { name: '🔒 Marathon Runner', desc: 'Complete 100 questions in one session', unlocked: false, progress: 45 },
            { name: '🏆 Quick Learner', desc: 'Reach Pro level in any skill', unlocked: true }
        ];
        
        achievements.forEach(achievement => {
            const item = document.createElement('div');
            item.style.cssText = 'margin-bottom: 12px; padding: 10px; background-color: var(--dark-bg); border-radius: 6px;';
            
            const progress = achievement.progress || 100;
            const color = achievement.unlocked ? '#e0af68' : 'var(--accent-color)';
            
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="color: ${color}; font-weight: bold; font-size: 14px;">${achievement.name}</span>
                    <span style="color: var(--text-color); font-size: 12px;">${achievement.unlocked ? 'Unlocked!' : `${progress}%`}</span>
                </div>
                <div style="background-color: var(--progress-bg); border-radius: 3px; height: 4px; overflow: hidden;">
                    <div style="background-color: ${color}; height: 100%; width: ${progress}%; transition: width 0.3s ease;"></div>
                </div>
                <div style="color: var(--muted-color); font-size: 11px; margin-top: 4px;">
                    ${achievement.desc}
                </div>
            `;
            achievementsContainer.appendChild(item);
        });
    }

    sendToPython(action, data, callback) {
        // Send message to Python through WebChannel
        console.log('sendToPython called:', action, data);
        if (window.pythonBridge) {
            const callbackId = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            console.log('Generated callback ID:', callbackId);
            
            if (callback) {
                // Store callback for later execution
                if (!window.pythonBridge.callbacks) {
                    window.pythonBridge.callbacks = {};
                }
                window.pythonBridge.callbacks[callbackId] = callback;
            }
            
            // Send the message
            console.log('Sending to Python bridge...');
            window.pythonBridge.send(action, JSON.stringify(data), callbackId);
        } else {
            console.warn('Python bridge not available');
        }
    }
}

// Initialize the app
const app = new MathDrillWeb();

// Navigation function for progress page
function navigateToProgress() {
    console.log('Navigating to progress page...');
    if (window.pythonBridge) {
        window.pythonBridge.send('navigate_to_progress', '{}', '');
    } else {
        console.warn('Python bridge not available for navigation');
    }
}

// Navigation function for main page
function navigateToMain() {
    console.log('Navigating to main page...');
    if (window.pythonBridge) {
        window.pythonBridge.send('navigate_to_main', '{}', '');
    } else {
        console.warn('Python bridge not available for navigation');
    }
}

// Wait for WebChannel to be ready
window.addEventListener('load', () => {
    console.log('Page loaded, checking for python bridge...');
    
    // Check if python bridge is available
    const checkBridge = () => {
        if (window.pythonBridge) {
            console.log('✅ Python bridge is available!');
        } else {
            console.log('⏳ Python bridge not ready yet, retrying...');
            setTimeout(checkBridge, 100);
        }
    };
    
    checkBridge();
});

// Global function for Python to call
window.updateFromPython = function(action, data) {
    switch(action) {
        case 'updateStats':
            app.updateStats();
            break;
        case 'showAchievementToast':
            app.showAchievementToast(data);
            break;
        // Add more as needed
    }
};
