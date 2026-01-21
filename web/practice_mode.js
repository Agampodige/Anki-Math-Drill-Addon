// Practice Mode Manager
class PracticeMode {
    constructor() {
        this.currentQuestion = null;
        this.questionCount = 0;
        this.correctCount = 0;
        this.streak = 0;
        this.attempts = [];
        this.lastQuestionId = 0;
        this.timerInterval = null;
        this.countdownInterval = null;
        this.questionStartTime = 0;
        this.isPracticing = false;
        this.isPaused = false;
        this.pauseStartTime = 0;
        this.totalPauseTime = 0;
        this.operation = 'addition';
        this.digits = 2;
        this.autoAdvanceTimer = null;
        this.feedbackShown = false;
        this.lastMilestone = 0;

        this.initializeEventListeners();
        this.initializeKeyboardShortcuts();
        this.initializeSoundToggle();
        this.loadAttempts();
    }

    initializeEventListeners() {
        document.getElementById('startBtn')?.addEventListener('click', () => this.startPractice());
        document.getElementById('stopBtn')?.addEventListener('click', () => this.stopPractice());
        document.getElementById('pauseBtn')?.addEventListener('click', () => this.togglePause());
        document.getElementById('resumeBtn')?.addEventListener('click', () => this.togglePause());
        document.getElementById('submitBtn')?.addEventListener('click', () => this.submitAnswer());
        document.getElementById('nextBtn')?.addEventListener('click', () => this.skipAutoAdvance());
        document.getElementById('answerInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !document.getElementById('submitBtn').disabled) {
                e.preventDefault();
                this.submitAnswer();
            }
        });
        document.getElementById('backBtn')?.addEventListener('click', () => navigateToHome());
        document.getElementById('helpBtn')?.addEventListener('click', () => this.showHelp());
        document.getElementById('closeHelp')?.addEventListener('click', () => this.hideHelp());
        document.getElementById('helpModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'helpModal') this.hideHelp();
        });
    }

    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                return;
            }

            switch (e.key) {
                case 'Escape':
                    if (this.isPracticing && !this.isPaused) {
                        e.preventDefault();
                        this.stopPractice();
                    }
                    break;
                case ' ':
                    if (this.feedbackShown) {
                        e.preventDefault();
                        this.skipAutoAdvance();
                    }
                    break;
                case 'p':
                case 'P':
                    if (this.isPracticing) {
                        e.preventDefault();
                        this.togglePause();
                    }
                    break;
                case '?':
                    e.preventDefault();
                    this.showHelp();
                    break;
            }
        });
    }

    initializeSoundToggle() {
        const soundToggle = document.getElementById('soundToggle');
        const soundWaves = document.getElementById('soundWaves');

        // Update initial state
        this.updateSoundIcon();

        soundToggle?.addEventListener('click', () => {
            if (window.soundManager) {
                window.soundManager.toggle();
                this.updateSoundIcon();
                window.soundManager.playClick();
            }
        });
    }

    updateSoundIcon() {
        const soundWaves = document.getElementById('soundWaves');
        if (window.soundManager && soundWaves) {
            soundWaves.style.display = window.soundManager.enabled ? 'block' : 'none';
        }
    }

    showHelp() {
        document.getElementById('helpModal').style.display = 'flex';
    }

    hideHelp() {
        document.getElementById('helpModal').style.display = 'none';
    }

    togglePause() {
        if (!this.isPracticing) return;

        this.isPaused = !this.isPaused;
        const pauseOverlay = document.getElementById('pauseOverlay');
        const pauseBtn = document.getElementById('pauseBtn');

        if (this.isPaused) {
            // Pause
            this.pauseStartTime = Date.now();
            this.stopTimer();
            pauseOverlay.style.display = 'flex';
            pauseBtn.textContent = '▶ Resume';
            pauseBtn.classList.add('resumed');
        } else {
            // Resume
            this.totalPauseTime += Date.now() - this.pauseStartTime;
            pauseOverlay.style.display = 'none';
            pauseBtn.textContent = '⏸ Pause';
            pauseBtn.classList.remove('resumed');

            // Restart timer if not showing feedback
            if (!this.feedbackShown) {
                this.startTimer();
            }
        }
    }

    skipAutoAdvance() {
        // Allow user to skip the auto-advance delay
        if (this.autoAdvanceTimer) {
            clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.generateNextQuestion();
    }

    startPractice() {
        this.operation = document.getElementById('operationSelect').value;
        this.digits = parseInt(document.getElementById('digitsSelect').value);

        this.isPracticing = true;
        this.isPaused = false;
        this.questionCount = 0;
        this.correctCount = 0;
        this.streak = 0;
        this.lastMilestone = 0;
        this.totalPauseTime = 0;

        // Hide settings, show practice area and controls
        document.getElementById('settingsPanel').style.display = 'none';
        document.getElementById('practiceArea').style.display = 'flex';
        document.getElementById('practiceControls').style.display = 'flex';
        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('backBtn').style.display = 'none';

        this.generateNextQuestion();
    }

    stopPractice() {
        // Confirm stop
        if (!confirm('Stop practicing? Your current streak and session will be lost.')) {
            return;
        }

        // Reset state
        this.isPracticing = false;
        this.isPaused = false;
        this.feedbackShown = false;

        // Clear timers
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);
        if (this.countdownInterval) { clearInterval(this.countdownInterval); this.countdownInterval = null; }

        // Hide overlays
        document.getElementById('pauseOverlay').style.display = 'none';

        // Show settings, hide practice area
        document.getElementById('settingsPanel').style.display = 'block';
        document.getElementById('practiceArea').style.display = 'none';
        document.getElementById('practiceControls').style.display = 'none';
        document.getElementById('progressContainer').style.display = 'none';
        document.getElementById('backBtn').style.display = 'flex';

        // Reset pause button
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.textContent = '⏸ Pause';
        pauseBtn.classList.remove('resumed');

        // Reset UI
        this.hideFeedback();
        document.getElementById('answerInput').value = '';
        document.getElementById('timerDisplay').textContent = '0.0s';
    }

    generateRandomNumber(digits) {
        const min = Math.pow(10, digits - 1);
        const max = Math.pow(10, digits) - 1;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    generateQuestion() {
        const digits = this.digits;
        let a, b, c, d, expression, answer, display;

        switch (this.operation) {
            case 'addition':
                a = this.generateRandomNumber(digits);
                b = this.generateRandomNumber(digits);
                answer = a + b;
                display = `${a} + ${b}`;
                break;

            case 'subtraction':
                a = this.generateRandomNumber(digits);
                b = this.generateRandomNumber(digits);
                // Ensure positive answer
                if (a < b) [a, b] = [b, a];
                answer = a - b;
                display = `${a} − ${b}`;
                break;

            case 'multiplication':
                a = this.generateRandomNumber(Math.min(digits, 3));
                b = this.generateRandomNumber(Math.min(digits, 3));
                answer = a * b;
                display = `${a} × ${b}`;
                break;

            case 'division':
                b = this.generateRandomNumber(Math.max(1, digits - 1));
                a = b * this.generateRandomNumber(digits - 1);
                answer = a / b;
                display = `${a} ÷ ${b}`;
                break;

            case 'complex':
                answer = this.generateComplexQuestion();
                display = answer.display;
                answer = answer.answer;
                break;

            default:
                a = this.generateRandomNumber(digits);
                b = this.generateRandomNumber(digits);
                answer = a + b;
                display = `${a} + ${b}`;
        }

        return {
            id: this.lastQuestionId + this.questionCount + 1,
            operation: this.operation,
            display: display,
            answer: answer,
            digits: digits
        };
    }

    generateComplexQuestion() {
        const digits = this.digits;
        const patterns = [
            this.patternMultipleAddition,
            this.patternAdditionWithMultiplication,
            this.patternMultipleSubtraction,
            this.patternSubtractionWithDivision,
            this.patternMixedOperations,
            this.patternAdditionWithDivision,
            this.patternThreeOperands,
            this.patternChainedOperations
        ];

        // Pick random pattern
        const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
        return randomPattern.call(this, digits);
    }

    patternMultipleAddition(digits) {
        const a = this.generateRandomNumber(digits);
        const b = this.generateRandomNumber(digits);
        const c = this.generateRandomNumber(digits);
        return {
            display: `${a} + ${b} + ${c}`,
            answer: a + b + c
        };
    }

    patternAdditionWithMultiplication(digits) {
        const a = this.generateRandomNumber(Math.min(digits, 2));
        const b = this.generateRandomNumber(Math.min(digits, 2));
        const c = this.generateRandomNumber(digits);
        // a × b + c
        return {
            display: `${a} × ${b} + ${c}`,
            answer: (a * b) + c
        };
    }

    patternMultipleSubtraction(digits) {
        const a = this.generateRandomNumber(digits);
        const b = this.generateRandomNumber(Math.min(a, digits));
        const c = this.generateRandomNumber(Math.min(a - b, digits));
        // a - b - c
        return {
            display: `${a} − ${b} − ${c}`,
            answer: a - b - c
        };
    }

    patternSubtractionWithDivision(digits) {
        const divisor = this.generateRandomNumber(Math.max(2, digits - 1));
        const dividend = divisor * this.generateRandomNumber(digits - 1);
        const subtrahend = this.generateRandomNumber(digits);
        // dividend ÷ divisor - subtrahend
        return {
            display: `${dividend} ÷ ${divisor} − ${subtrahend}`,
            answer: (dividend / divisor) - subtrahend
        };
    }

    patternMixedOperations(digits) {
        const a = this.generateRandomNumber(Math.min(digits, 2));
        const b = this.generateRandomNumber(Math.min(digits, 2));
        const c = this.generateRandomNumber(digits);
        const d = this.generateRandomNumber(Math.min(digits, 2));
        // a × b + c − d (but with proper order of operations)
        return {
            display: `${a} × ${b} + ${c} − ${d}`,
            answer: (a * b) + c - d
        };
    }

    patternAdditionWithDivision(digits) {
        const divisor = this.generateRandomNumber(Math.max(2, digits - 1));
        const dividend = divisor * this.generateRandomNumber(digits - 1);
        const addend = this.generateRandomNumber(digits);
        // dividend ÷ divisor + addend
        return {
            display: `${dividend} ÷ ${divisor} + ${addend}`,
            answer: (dividend / divisor) + addend
        };
    }

    patternThreeOperands(digits) {
        const a = this.generateRandomNumber(digits);
        const b = this.generateRandomNumber(digits);
        const c = this.generateRandomNumber(digits);
        const d = this.generateRandomNumber(digits);
        // a + b + c + d
        return {
            display: `${a} + ${b} + ${c} + ${d}`,
            answer: a + b + c + d
        };
    }

    patternChainedOperations(digits) {
        const a = this.generateRandomNumber(Math.min(digits, 2));
        const b = this.generateRandomNumber(Math.min(digits, 2));
        const c = this.generateRandomNumber(digits);
        const d = this.generateRandomNumber(Math.min(digits, 2));
        // (a + b) × c − d
        return {
            display: `(${a} + ${b}) × ${c} − ${d}`,
            answer: ((a + b) * c) - d
        };
    }

    generateNextQuestion() {
        this.hideFeedback();

        const card = document.getElementById('questionCard');
        if (this.currentQuestion) {
            card.classList.add('slide-out');
            setTimeout(() => {
                this.setupNextQuestion();
                card.classList.remove('slide-out');
                card.classList.add('slide-in');
                setTimeout(() => card.classList.remove('slide-in'), 300);
            }, 300);
        } else {
            this.setupNextQuestion();
        }
    }

    setupNextQuestion() {
        this.currentQuestion = this.generateQuestion();
        this.questionCount++;
        this.questionStartTime = Date.now();

        // Update display
        document.getElementById('questionText').textContent = this.currentQuestion.display + ' = ?';
        document.getElementById('questionNumber').textContent = this.questionCount;

        // Update progress bar (visual only for now, can be time-based or count-based)
        const progress = Math.min(100, (this.questionCount % 10) * 10);
        document.getElementById('progressBar').style.width = `${progress}%`;

        // Enable input
        const input = document.getElementById('answerInput');
        input.value = '';
        input.disabled = false;
        input.focus();

        document.getElementById('submitBtn').disabled = false;

        // Start timer
        this.startTimer();
    }

    startTimer() {
        let elapsed = 0;
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            elapsed += 0.1;
            document.getElementById('timerDisplay').textContent = elapsed.toFixed(1) + 's';
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    submitAnswer() {
        this.stopTimer();

        const userAnswer = parseFloat(document.getElementById('answerInput').value);
        const timeTaken = (Date.now() - this.questionStartTime - this.totalPauseTime) / 1000;
        const isCorrect = Math.abs(userAnswer - this.currentQuestion.answer) < 0.01;

        // Update stats
        if (isCorrect) {
            this.correctCount++;
            this.streak++;

            // Play correct sound
            if (window.soundManager) {
                window.soundManager.playCorrect();
            }

            // Check for milestones
            this.checkMilestone();
        } else {
            this.streak = 0;

            // Play incorrect sound
            if (window.soundManager) {
                window.soundManager.playIncorrect();
            }
        }

        // Store attempt
        const attempt = {
            id: this.currentQuestion.id,
            operation: this.currentQuestion.operation,
            digits: this.currentQuestion.digits,
            question: this.currentQuestion.display,
            userAnswer: userAnswer,
            correctAnswer: this.currentQuestion.answer,
            isCorrect: isCorrect,
            timeTaken: timeTaken,
            timestamp: new Date().toISOString()
        };

        this.attempts.push(attempt);
        this.saveAttempts();

        // Show feedback
        this.showFeedback(isCorrect, userAnswer, timeTaken);

        // Disable input
        document.getElementById('answerInput').disabled = true;
        document.getElementById('submitBtn').disabled = true;
    }

    checkMilestone() {
        const milestones = [5, 10, 20, 50, 100];

        for (let milestone of milestones) {
            if (this.streak === milestone && this.lastMilestone < milestone) {
                this.lastMilestone = milestone;
                this.showCelebration(milestone);
                break;
            }
        }
    }

    showCelebration(milestone) {
        const overlay = document.getElementById('celebrationOverlay');
        const message = document.getElementById('celebrationMessage');

        const messages = {
            5: '🔥 5 Streak! You\'re on fire!',
            10: '⭐ 10 Streak! Amazing!',
            20: '🚀 20 Streak! Incredible!',
            50: '💎 50 Streak! Legendary!',
            100: '👑 100 Streak! Unstoppable!'
        };

        message.textContent = messages[milestone] || `🎉 ${milestone} Streak!`;

        // Create confetti
        this.createConfetti();

        // Play milestone sound
        if (window.soundManager) {
            window.soundManager.playMilestone();
        }

        // Show overlay
        overlay.style.display = 'flex';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            overlay.style.display = 'none';
            document.getElementById('confettiContainer').innerHTML = '';
        }, 3000);
    }

    createConfetti() {
        const container = document.getElementById('confettiContainer');
        container.innerHTML = '';

        const colors = ['#10b981', '#34d399', '#fbbf24', '#f59e0b', '#ef4444', '#ec4899'];

        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(confetti);
        }
    }

    showFeedback(isCorrect, userAnswer, timeTaken) {
        const feedbackBox = document.getElementById('feedbackBox');
        const feedbackText = document.getElementById('feedbackText');
        const correctAnswer = this.currentQuestion.answer;

        feedbackBox.className = 'feedback-overlay ' + (isCorrect ? 'correct' : 'incorrect');
        feedbackText.textContent = isCorrect ? '✓ Correct' : '✗ Incorrect';

        document.getElementById('userAnswer').textContent = userAnswer.toString();
        document.getElementById('correctAnswer').textContent = correctAnswer.toString();
        document.getElementById('timeTaken').textContent = timeTaken.toFixed(2) + 's';

        // Update stats summary
        this.updateStatsSummary();

        feedbackBox.style.display = 'flex';
        this.feedbackShown = true;

        // Auto-advance after a shorter delay (0.8s for correct, 1.2s for incorrect)
        const delay = isCorrect ? 800 : 1200;
        const nextBtn = document.getElementById('nextBtn');

        // Clear any existing timers
        if (this.autoAdvanceTimer) {
            clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        const originalText = 'Next Question';
        const endTime = Date.now() + delay;

        const updateCountdown = () => {
            const remainingMs = Math.max(0, endTime - Date.now());
            if (remainingMs >= 1000) {
                const remainingSec = Math.ceil(remainingMs / 1000);
                nextBtn.textContent = `Next Question (${remainingSec}s)`;
            } else {
                nextBtn.textContent = `Next Question (${(remainingMs / 1000).toFixed(1)}s)`;
            }
        };

        updateCountdown();
        this.countdownInterval = setInterval(updateCountdown, 100);
        nextBtn.disabled = false; // allow immediate skipping by user

        this.autoAdvanceTimer = setTimeout(() => {
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
            nextBtn.textContent = originalText;
            this.generateNextQuestion();
        }, delay);
    }

    hideFeedback() {
        // Clear any auto-advance timers and countdowns
        if (this.autoAdvanceTimer) {
            clearTimeout(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        document.getElementById('feedbackBox').style.display = 'none';
        this.feedbackShown = false;
    }

    updateStatsSummary() {
        document.getElementById('correctCount').textContent = this.correctCount;
        document.getElementById('streakCount').textContent = this.streak;
        document.getElementById('totalQuestions').textContent = this.questionCount;

        const accuracy = this.questionCount > 0 ? Math.round((this.correctCount / this.questionCount) * 100) : 0;
        document.getElementById('accuracy').textContent = accuracy + '%';

        const totalTime = this.attempts.reduce((sum, a) => sum + a.timeTaken, 0);
        const avgTime = this.questionCount > 0 ? (totalTime / this.questionCount).toFixed(2) : '0.00';
        document.getElementById('avgTime').textContent = avgTime + 's';
    }

    async saveAttempts() {
        // Save to localStorage first (for offline support)
        const attemptsData = {
            lastId: this.lastQuestionId + this.questionCount,
            attempts: this.attempts
        };
        localStorage.setItem('mathDrillAttempts', JSON.stringify(attemptsData));

        // Also save to Python backend if available
        if (typeof pybridge !== 'undefined' && pybridge) {
            try {
                const message = JSON.stringify({
                    type: 'save_attempts',
                    payload: { attempts: attemptsData }
                });
                pybridge.sendMessage(message);
                console.log('Attempts saved to Python backend');
            } catch (e) {
                console.warn('Could not save to Python backend:', e);
            }
        }
    }

    loadAttempts() {
        const saved = localStorage.getItem('mathDrillAttempts');
        if (saved) {
            const data = JSON.parse(saved);
            this.attempts = data.attempts || [];
            this.lastQuestionId = data.lastId || 0;
        }
    }
}

// Initialize Practice Mode when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    window.practiceMode = new PracticeMode();
});
