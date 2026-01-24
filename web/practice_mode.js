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
        this.adaptiveState = {
            level: 1, // 1: Easy, 2: Medium, 3: Hard
            consecutiveCorrect: 0,
            history: []
        };
        this.isAdaptive = false;
        this.weaknesses = [];

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
        const nextBtn = document.getElementById('nextBtn');
        const originalText = window.t('practice.continue');
        
        const updateCountdown = () => {
            const remainingMs = Math.max(0, endTime - Date.now());
            if (remainingMs >= 1000) {
                const remainingSec = Math.ceil(remainingMs / 1000);
                const nextQuestionText = window.t('practice.next_question');
                nextBtn.textContent = `${nextQuestionText} (${remainingSec}s)`;
            } else {
                const nextQuestionText = window.t('practice.next_question');
                nextBtn.textContent = `${nextQuestionText} (${(remainingMs / 1000).toFixed(1)}s)`;
            }
        };

        if (this.isPaused) {
            // Pause
            this.pauseStartTime = Date.now();
            this.stopTimer();
            const pauseOverlay = document.getElementById('pauseOverlay');
            pauseOverlay.style.display = 'flex';
            const resumeText = window.t('practice.resume');
            document.getElementById('pauseBtn').textContent = `▶ ${resumeText}`;
            document.getElementById('pauseBtn').classList.add('resumed');
        } else {
            // Resume
            const pauseDuration = Date.now() - this.pauseStartTime;
            this.totalPauseTime += pauseDuration;

            // Record pause in session manager
            if (window.sessionManager) {
                window.sessionManager.recordPause(pauseDuration);
            }

            pauseOverlay.style.display = 'none';
            const pauseText = window.t('practice.pause');
            pauseBtn.textContent = `⏸ ${pauseText}`;
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

        // Load adaptive setting from global appSettings if available
        if (window.appSettings) {
            this.isAdaptive = window.appSettings.adaptiveDifficulty || false;
        } else {
            // Fallback to localStorage if appSettings not in window
            const saved = localStorage.getItem('appSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.isAdaptive = settings.adaptiveDifficulty || false;
            }
        }

        if (this.isAdaptive) {
        } else {
        }

        // Start session tracking
        if (window.sessionManager) {
            window.sessionManager.startSession(this.operation, this.digits, this.isAdaptive);
        }

        this.isPracticing = true;
        this.isPaused = false;
        this.questionCount = 0;
        this.correctCount = 0;
        this.streak = 0;
        this.lastMilestone = 0;
        this.totalPauseTime = 0;
        this.adaptiveState = {
            level: 1,
            consecutiveCorrect: 0,
            history: []
        };

        // Hide settings, show practice area and controls
        document.getElementById('settingsPanel').style.display = 'none';
        document.getElementById('practiceArea').style.display = 'flex';
        document.getElementById('practiceControls').style.display = 'flex';
        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('backBtn').style.display = 'none';

        this.generateNextQuestion();

        // Fetch weaknesses for current operation/digits
        if (this.isAdaptive) {
            this.fetchWeaknesses();
        }
    }

    async fetchWeaknesses() {
        if (typeof pybridge !== 'undefined' && pybridge) {
            try {
                const message = JSON.stringify({
                    type: 'get_weaknesses',
                    payload: {
                        operation: this.operation,
                        digits: this.digits
                    }
                });

                // Set up a one-time listener for the response
                const handler = (msg) => {
                    const data = JSON.parse(msg);
                    if (data.type === 'get_weaknesses_response' && data.payload.success) {
                        this.weaknesses = data.payload.weaknesses || [];
                        pybridge.messageReceived.disconnect(handler);
                    }
                };
                pybridge.messageReceived.connect(handler);
                pybridge.sendMessage(message);
            } catch (e) {
                console.warn('Could not fetch weaknesses:', e);
            }
        }
    }

    stopPractice() {
        // Confirm stop
        if (!confirm('Stop practicing? Your current session will be saved.')) {
            return;
        }

        // End session and get summary
        let sessionSummary = null;
        if (window.sessionManager && window.sessionManager.currentSession) {
            sessionSummary = window.sessionManager.endSession('completed');
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

        // Show session summary if available
        if (sessionSummary) {
            this.showSessionSummary(sessionSummary);
        }

        // Show settings, hide practice area
        document.getElementById('settingsPanel').style.display = 'block';
        document.getElementById('practiceArea').style.display = 'none';
        document.getElementById('practiceControls').style.display = 'none';
        document.getElementById('progressContainer').style.display = 'none';
        document.getElementById('backBtn').style.display = 'flex';

        // Reset pause button
        const pauseBtn = document.getElementById('pauseBtn');
        const pauseText = window.t('practice.pause');
        pauseBtn.textContent = `⏸ ${pauseText}`;
        pauseBtn.classList.remove('resumed');

        // Reset UI
        this.hideFeedback();
        document.getElementById('answerInput').value = '';
        document.getElementById('timerDisplay').textContent = '0.0s';
    }

    generateRandomNumber(digits, toughness = 2) {
        const min = Math.pow(10, digits - 1);
        const max = Math.pow(10, digits) - 1;

        if (toughness === 1) {
            // "Easy" - try to pick "friendly" numbers
            if (digits === 1) return Math.floor(Math.random() * 5) + 1; // 1-5
            if (digits === 2) {
                const friendly = [10, 11, 12, 15, 20, 25, 30, 40, 50];
                return friendly[Math.floor(Math.random() * friendly.length)];
            }
        }

        if (toughness === 3) {
            // "Hard" - pick from upper range
            const mid = min + (max - min) / 2;
            return Math.floor(Math.random() * (max - mid + 1)) + Math.floor(mid);
        }

        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    generateQuestion() {
        const digits = this.digits;
        let a, b, c, d, expression, answer, display;

        // Determine toughness
        let toughness = 2; // Default Medium
        if (this.isAdaptive) {
            // 30% chance of an easy question even if user is at high level (Smart Mixing)
            if (Math.random() < 0.3) {
                toughness = 1;
            } else {
                toughness = this.adaptiveState.level;
            }

            // High priority: If we have weaknesses and a random roll (25%), target a weakness
            if (this.weaknesses.length > 0 && Math.random() < 0.25) {
                const weakness = this.weaknesses[Math.floor(Math.random() * this.weaknesses.length)];

                // Determine display symbol based on operation
                let symbol = '+';
                if (weakness.op === 'subtraction') symbol = '−';
                else if (weakness.op === 'multiplication') symbol = '×';
                else if (weakness.op === 'division') symbol = '÷';

                return {
                    id: this.lastQuestionId + this.questionCount + 1,
                    operation: weakness.op,
                    display: `${weakness.num1} ${symbol} ${weakness.num2}`,
                    answer: this.calculateAnswer(weakness.num1, weakness.num2, weakness.op),
                    digits: this.digits,
                    toughness: toughness,
                    isWeaknessTarget: true
                };
            }
        }

        switch (this.operation) {
            case 'addition':
                if (toughness === 1 && digits === 2) {
                    // Addition without carrying
                    a = Math.floor(Math.random() * 4) + 1; // Tens 1-4
                    b = Math.floor(Math.random() * 4) + 1; // Tens 1-4
                    const a1 = Math.floor(Math.random() * 4); // Ones 0-4
                    const b1 = Math.floor(Math.random() * 4); // Ones 0-4
                    a = a * 10 + a1;
                    b = b * 10 + b1;
                } else if (toughness === 3 && digits === 2) {
                    // Addition with guaranteed carrying
                    a = Math.floor(Math.random() * 4) + 6; // 6-9
                    b = Math.floor(Math.random() * 4) + 6; // 6-9
                    const a1 = Math.floor(Math.random() * 4) + 6;
                    const b1 = Math.floor(Math.random() * 4) + 6;
                    a = a * 10 + a1;
                    b = b * 10 + b1;
                } else {
                    a = this.generateRandomNumber(digits, toughness);
                    b = this.generateRandomNumber(digits, toughness);
                }
                answer = a + b;
                display = `${a} + ${b}`;
                break;

            case 'subtraction':
                a = this.generateRandomNumber(digits, toughness);
                b = this.generateRandomNumber(digits, toughness);
                if (a < b) [a, b] = [b, a];

                if (toughness === 1 && digits === 2) {
                    // Subtraction without borrowing
                    const a_tens = Math.floor(Math.random() * 8) + 2;
                    const b_tens = Math.floor(Math.random() * a_tens);
                    const a_ones = Math.floor(Math.random() * 8) + 1;
                    const b_ones = Math.floor(Math.random() * a_ones);
                    a = a_tens * 10 + a_ones;
                    b = b_tens * 10 + b_ones;
                }

                answer = a - b;
                display = `${a} − ${b}`;
                break;

            case 'multiplication':
                if (toughness === 1) {
                    a = [2, 3, 5, 10][Math.floor(Math.random() * 4)];
                    b = this.generateRandomNumber(Math.min(digits, 2), 2);
                } else if (toughness === 3) {
                    a = Math.floor(Math.random() * 3) + 7; // 7, 8, 9
                    b = Math.floor(Math.random() * 3) + 7; // 7, 8, 9
                } else {
                    a = this.generateRandomNumber(Math.min(digits, 3), toughness);
                    b = this.generateRandomNumber(Math.min(digits, 3), toughness);
                }
                answer = a * b;
                display = `${a} × ${b}`;
                break;

            case 'division':
                if (toughness === 1) {
                    b = [2, 5, 10][Math.floor(Math.random() * 3)];
                    answer = Math.floor(Math.random() * 10) + 1;
                    a = b * answer;
                } else {
                    b = this.generateRandomNumber(Math.max(1, digits - 1), toughness);
                    a = b * this.generateRandomNumber(digits - 1, toughness);
                }
                answer = a / b;
                display = `${a} ÷ ${b}`;
                break;

            case 'complex':
                answer = this.generateComplexQuestion();
                display = answer.display;
                answer = answer.answer;
                break;

            default:
                a = this.generateRandomNumber(digits, toughness);
                b = this.generateRandomNumber(digits, toughness);
                answer = a + b;
                display = `${a} + ${b}`;
        }

        return {
            id: this.lastQuestionId + this.questionCount + 1,
            operation: this.operation,
            display: display,
            answer: answer,
            digits: digits,
            toughness: toughness,
            num1: a,
            num2: b
        };
    }

    calculateAnswer(a, b, op) {
        switch (op) {
            case 'addition': return a + b;
            case 'subtraction': return a - b;
            case 'multiplication': return a * b;
            case 'division': return a / b;
            default: return 0;
        }
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
        const equalsText = window.t('practice.equals');
        const questionText = window.t('practice.question');
        document.getElementById('questionText').textContent = this.currentQuestion.display + ` ${equalsText} ?`;
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

            // Adaptive logic update
            if (this.isAdaptive) {
                this.adaptiveState.consecutiveCorrect++;
                // Increase level if 3 correct in a row and not yet at Hard (3)
                if (this.adaptiveState.consecutiveCorrect >= 3 && this.adaptiveState.level < 3) {
                    this.adaptiveState.level++;
                    this.adaptiveState.consecutiveCorrect = 0;
                }
            }

            // Play correct sound
            if (window.soundManager) {
                window.soundManager.playCorrect();
            }

            // Check for milestones
            this.checkMilestone();
        } else {
            this.streak = 0;

            // Adaptive logic update
            if (this.isAdaptive) {
                this.adaptiveState.consecutiveCorrect = 0;
                // Decrease level on error
                if (this.adaptiveState.level > 1) {
                    this.adaptiveState.level--;
                }
            }

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
            num1: this.currentQuestion.num1,
            num2: this.currentQuestion.num2,
            userAnswer: userAnswer,
            correctAnswer: this.currentQuestion.answer,
            isCorrect: isCorrect,
            timeTaken: timeTaken,
            timestamp: new Date().toISOString()
        };

        this.attempts.push(attempt);
        this.saveAttempts();

        // Record attempt in session manager
        if (window.sessionManager) {
            window.sessionManager.recordAttempt(attempt);
        }

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

        const correctText = window.t('practice.correct');
        const incorrectText = window.t('practice.incorrect');
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
        const correctFeedbackText = window.t('practice.correct_feedback');
        const incorrectFeedbackText = window.t('practice.incorrect_feedback');
        feedbackText.textContent = isCorrect ? correctFeedbackText : incorrectFeedbackText;

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

    showSessionSummary(session) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'sessionSummaryModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        // Get session summary
        const summary = window.sessionManager.getSessionSummary(session);
        
        // Determine performance emoji and color
        let performanceEmoji = '📊';
        let performanceColor = 'var(--text-color)';
        if (summary.performanceRating === 'excellent') {
            performanceEmoji = '🏆';
            performanceColor = 'var(--success-color)';
        } else if (summary.performanceRating === 'good') {
            performanceEmoji = '⭐';
            performanceColor = 'var(--primary-color)';
        } else if (summary.performanceRating === 'fair') {
            performanceEmoji = '📈';
            performanceColor = 'var(--warning-color)';
        } else if (summary.performanceRating === 'needs_improvement') {
            performanceEmoji = '💪';
            performanceColor = 'var(--error-color)';
        }

        // Create modal content
        modal.innerHTML = `
            <div style="
                background: var(--bg-light);
                border-radius: var(--border-radius-xl);
                padding: var(--spacing-2xl);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: var(--shadow-xl);
                animation: slideUp 0.3s ease;
            ">
                <div style="text-align: center; margin-bottom: var(--spacing-xl);">
                    <div style="font-size: 48px; margin-bottom: var(--spacing-md);">${performanceEmoji}</div>
                    <h2 style="margin: 0; color: var(--text-color); font-size: var(--font-size-2xl);">Session Complete!</h2>
                    <p style="margin: var(--spacing-sm) 0 0 0; color: var(--text-muted); font-size: var(--font-size-sm);">Great job on completing your practice session</p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); margin-bottom: var(--spacing-xl);">
                    <div style="background: var(--bg-secondary); padding: var(--spacing-md); border-radius: var(--border-radius-lg); text-align: center;">
                        <div style="font-size: var(--font-size-2xl); font-weight: bold; color: ${performanceColor};">${summary.accuracy}%</div>
                        <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">Accuracy</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: var(--spacing-md); border-radius: var(--border-radius-lg); text-align: center;">
                        <div style="font-size: var(--font-size-2xl); font-weight: bold; color: var(--primary-color);">${summary.questionsAttempted}</div>
                        <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">Questions</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: var(--spacing-md); border-radius: var(--border-radius-lg); text-align: center;">
                        <div style="font-size: var(--font-size-2xl); font-weight: bold; color: var(--success-color);">${summary.averageTime}s</div>
                        <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">Avg Time</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: var(--spacing-md); border-radius: var(--border-radius-lg); text-align: center;">
                        <div style="font-size: var(--font-size-2xl); font-weight: bold; color: var(--warning-color);">${summary.bestStreak}</div>
                        <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--spacing-xs);">Best Streak</div>
                    </div>
                </div>

                <div style="background: var(--warning-50); border: 1px solid var(--warning-color); padding: var(--spacing-md); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-xl);">
                    <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                        <span style="font-size: var(--font-size-base);">💡</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--warning-900); font-size: var(--font-size-sm);">Performance Insights</div>
                            <div style="color: var(--warning-700); font-size: var(--font-size-xs); margin-top: var(--spacing-xs);">
                                ${this.getPerformanceInsight(summary)}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: var(--spacing-md);">
                    <button onclick="this.closest('#sessionSummaryModal').remove()" style="
                        flex: 1;
                        background: var(--text-muted);
                        color: white;
                        border: none;
                        padding: var(--spacing-md) var(--spacing-xl);
                        border-radius: var(--border-radius-md);
                        font-size: var(--font-size-sm);
                        font-weight: 600;
                        cursor: pointer;
                        transition: var(--transition-colors);
                    " onmouseover="this.style.background='var(--text-light)'" onmouseout="this.style.background='var(--text-muted)'">
                        Close
                    </button>
                    <button onclick="window.location.href='analytics.html'" style="
                        flex: 1;
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        padding: var(--spacing-md) var(--spacing-xl);
                        border-radius: var(--border-radius-md);
                        font-size: var(--font-size-sm);
                        font-weight: 600;
                        cursor: pointer;
                        transition: var(--transition-colors);
                    " onmouseover="this.style.background='var(--primary-dark)'" onmouseout="this.style.background='var(--primary-color)'">
                        View Analytics
                    </button>
                </div>
            </div>

            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            </style>
        `;

        // Add to body and handle click outside
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    getPerformanceInsight(summary) {
        if (summary.performanceRating === 'excellent') {
            return 'Outstanding performance! Your accuracy and speed are both impressive.';
        } else if (summary.performanceRating === 'good') {
            return 'Great work! You\'re performing well and showing good consistency.';
        } else if (summary.performanceRating === 'fair') {
            return 'Good effort! Focus on accuracy and try to maintain a steady pace.';
        } else {
            return 'Keep practicing! Focus on understanding the problems before answering.';
        }
    }
}

// Initialize Practice Mode when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    window.practiceMode = new PracticeMode();
});
