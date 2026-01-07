// Initialize the app when bridge is ready
window.addEventListener('load', function () {
    // Make test function globally available
    window.testBridge = function () {
        if (window.mathDrill) {
            window.mathDrill.testBridge();
        } else {
            console.error('MathDrill not initialized');
        }
    };

    // Make logAttempt globally available for testing
    window.logTestAttempt = function () {
        if (window.mathDrill) {
            window.mathDrill.logAttempt(true, 1.5, '1+1', 2, 2);
        } else {
            console.error('MathDrill not initialized');
        }
    };

    // Make testDirectLog globally available for testing
    window.testDirectLog = function () {
        if (window.pythonBridge) {
            console.log('Testing direct Python logging...');
            window.pythonBridge.send('test_direct_log', JSON.stringify({ test: true }), 'direct_log_callback');
        } else {
            console.error('Bridge not available for direct test');
        }
    };
});

class MathDrillWeb {
    constructor() {
        // Don't initialize immediately - wait for bridge
        this.initialized = false;

        // Session state
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

        // Check if bridge is ready, if so initialize now
        if (window.pythonBridge) {
            this.initialize();
        } else {
            // Wait for bridge to be ready
            this.waitForBridge();
        }
    }

    waitForBridge() {
        const checkInterval = setInterval(() => {
            if (window.pythonBridge) {
                clearInterval(checkInterval);
                this.initialize();
            }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.pythonBridge && !this.initialized) {
                console.warn('Bridge not available, initializing in standalone mode');
                this.initialize();
            }
        }, 5000);
    }

    initialize() {
        if (this.initialized) return;
        this.initialized = true;

        // Add bridge status indicator
        this.addBridgeStatusIndicator();

        console.log('Initializing MathDrillWeb...');

        console.log(' Bridge status:', window.pythonBridge ? 'Connected' : 'Not connected');

        this.initElements();
        this.initEventListeners();
        this.initTimers();
        this.updateStats();

        // Check for active session instead of just resetting
        this.checkActiveSession();
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
        
        // Multi-variable inputs
        this.multiVariableAnswers = document.getElementById('multiVariableAnswers');
        this.xInput = document.getElementById('xInput');
        this.yInput = document.getElementById('yInput');
        this.zInput = document.getElementById('zInput');

        // Modal elements
        this.modalOverlay = document.getElementById('modalOverlay');
        this.resultModal = document.getElementById('resultModal');
        this.achievementToast = document.getElementById('achievementToast');

        // Verify critical elements exist
        const criticalElements = ['answerInput', 'modeBox', 'operationBox', 'digitsBox',
            'sessionCount', 'todayCount', 'lifetimeCount'];
        const missing = criticalElements.filter(id => !this[id]);
        if (missing.length > 0) {
            console.error('Missing critical elements:', missing);
            throw new Error(`Missing critical DOM elements: ${missing.join(', ')}`);
        }
    }

    initEventListeners() {
        // Control changes
        if (this.modeBox) this.modeBox.addEventListener('change', () => this.resetSession());
        if (this.operationBox) this.operationBox.addEventListener('change', () => this.resetSession());
        if (this.digitsBox) this.digitsBox.addEventListener('change', () => this.resetSession());

        // Answer input
        if (this.answerInput) {
            this.answerInput.addEventListener('keydown', (e) => this.handleKeydown(e));
            this.answerInput.addEventListener('input', (e) => this.handleInput(e));
        }
        
        // Multi-variable inputs
        if (this.xInput) {
            this.xInput.addEventListener('keydown', (e) => this.handleKeydown(e));
            this.xInput.addEventListener('input', (e) => this.handleInput(e));
        }
        if (this.yInput) {
            this.yInput.addEventListener('keydown', (e) => this.handleKeydown(e));
            this.yInput.addEventListener('input', (e) => this.handleInput(e));
        }
        if (this.zInput) {
            this.zInput.addEventListener('keydown', (e) => this.handleKeydown(e));
            this.zInput.addEventListener('input', (e) => this.handleInput(e));
        }
        
        // Initialize input visibility
        this.initializeInputVisibility();

        // Modal close buttons
        const closeResultBtn = document.getElementById('closeResultBtn');
        if (closeResultBtn) {
            closeResultBtn.addEventListener('click', () => this.closeModal('result'));
        }
        const toastCloseBtn = document.getElementById('toastCloseBtn');
        if (toastCloseBtn) {
            toastCloseBtn.addEventListener('click', () => this.closeToast());
        }

        // Retake button
        const retakeBtn = document.getElementById('retakeBtn');
        if (retakeBtn) {
            retakeBtn.addEventListener('click', () => this.startRetakeMistakes());
        }

        // Modal overlay click
        if (this.modalOverlay) {
            this.modalOverlay.addEventListener('click', () => this.closeAllModals());
        }

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
            // Clear all inputs
            this.answerInput.value = '';
            if (this.xInput) this.xInput.value = '';
            if (this.yInput) this.yInput.value = '';
            if (this.zInput) this.zInput.value = '';
            
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

        // Only allow digits for regular input, but allow any input for multi-variable inputs
        const activeElement = document.activeElement;
        const isMultiVariableInput = activeElement === this.xInput || activeElement === this.yInput || activeElement === this.zInput;
        
        if (!isMultiVariableInput) {
            // Only allow digits for regular answer input
            if (!/^[0-9]$/.test(key) && key !== 'Tab') {
                e.preventDefault();
            }
        }
        // For multi-variable inputs, allow most characters (numbers, minus, etc.)
    }

    handleInput(e) {
        const activeElement = e.target;
        const isMultiVariableInput = activeElement === this.xInput || activeElement === this.yInput || activeElement === this.zInput;
        
        if (isMultiVariableInput) {
            // For multi-variable inputs, allow numbers and minus signs
            const value = activeElement.value;
            const filtered = value.replace(/[^0-9-]/g, '');
            if (value !== filtered) {
                activeElement.value = filtered;
            }
        } else {
            // For regular input, filter out non-numeric characters
            const value = e.target.value;
            const filtered = value.replace(/[^0-9-]/g, '');
            if (value !== filtered) {
                e.target.value = filtered;
            }
        }
    }

    initializeInputVisibility() {
        // Set initial input visibility based on current operation
        const currentOperation = this.operationBox ? this.operationBox.value : 'Addition';
        
        if (currentOperation === 'Linear Algebra') {
            // For Linear Algebra, hide main input and multi-variable inputs initially
            if (this.answerInput) this.answerInput.style.display = 'none';
            if (this.multiVariableAnswers) this.multiVariableAnswers.style.display = 'none';
        } else {
            // For other operations, show main input and hide multi-variable inputs
            if (this.answerInput) this.answerInput.style.display = 'block';
            if (this.multiVariableAnswers) this.multiVariableAnswers.style.display = 'none';
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
            switch (e.key.toLowerCase()) {
                case 's':
                    window.location.href = 'settings.html';
                    break;
                case 'a':
                    window.location.href = 'achievements.html';
                    break;
                case 'p':
                    window.location.href = 'progress.html';
                    break;
                case 'w':
                    window.location.href = 'weakness.html';
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

    cycleMode() {
        const index = (this.modeBox.selectedIndex + 1) % this.modeBox.options.length;
        this.modeBox.selectedIndex = index;
    }

    cycleOperation() {
        const index = (this.operationBox.selectedIndex + 1) % this.operationBox.options.length;
        this.operationBox.selectedIndex = index;
    }

    logAttempt(correct, timeTaken, questionText, userAnswer, correctAnswer) {
        console.log('=== logAttempt called ===');
        console.log('correct:', correct);
        console.log('timeTaken:', timeTaken);
        console.log('questionText:', questionText);
        console.log('userAnswer:', userAnswer);
        console.log('correctAnswer:', correctAnswer);
        console.log('window.pythonBridge available:', !!window.pythonBridge);

        const attempt = {
            operation: this.operationBox.value,
            digits: parseInt(this.digitsBox.value),
            correct: correct,
            time_taken: timeTaken,
            question_text: questionText,
            user_answer: parseInt(userAnswer) || null,
            correct_answer: correctAnswer,
            difficulty_level: this.calculateDifficultyLevel(),
            timestamp: new Date().toISOString()
        };

        console.log('JavaScript logging attempt:', attempt);

        this.sessionAttempts.push(attempt);

        // Send to backend with enhanced data
        if (window.pythonBridge) {
            console.log('Sending to Python bridge...');
            console.log('Bridge type:', typeof window.pythonBridge);
            console.log('Bridge send method:', typeof window.pythonBridge.send);

            try {
                window.pythonBridge.send('log_attempt', JSON.stringify(attempt), null);
                console.log('✅ Successfully sent to Python bridge');
            } catch (error) {
                console.error('❌ Error sending to Python bridge:', error);
            }
        } else {
            console.error('❌ Python bridge not available!');
            console.log('window.pythonBridge:', window.pythonBridge);
            console.log('typeof window.pythonBridge:', typeof window.pythonBridge);
        }

        // Trigger real-time update
        if (window.realtimeManager) {
            window.realtimeManager.handleSync({
                event_type: 'attempt_logged',
                data: attempt,
                timestamp: new Date().toISOString()
            });
        }
    }

    addBridgeStatusIndicator() {
        // Add a visual indicator for bridge status
        const statusDiv = document.createElement('div');
        statusDiv.id = 'bridgeStatus';
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            font-weight: bold;
            z-index: 9999;
            background: ${window.pythonBridge ? '#10B981' : '#EF4444'};
            color: white;
        `;
        statusDiv.textContent = window.pythonBridge ? '🔗 Bridge Connected' : '❌ Bridge Disconnected';
        document.body.appendChild(statusDiv);

        // Update status periodically
        setInterval(() => {
            const connected = !!window.pythonBridge;
            statusDiv.style.background = connected ? '#10B981' : '#EF4444';
            statusDiv.textContent = connected ? '🔗 Bridge Connected' : '❌ Bridge Disconnected';
        }, 1000);
    }

    // Test bridge communication (can be called from console)
    testBridge() {
        console.log('=== Testing bridge communication ===');
        if (window.pythonBridge) {
            console.log('Bridge available, sending test message...');
            window.pythonBridge.send('test_bridge', JSON.stringify({ test: true }), 'test_callback');
        } else {
            console.error('Bridge not available for testing');
        }
    }

    calculateDifficultyLevel() {
        // Calculate difficulty based on operation and digits
        const operation = this.operationBox.value;
        const digits = parseInt(this.digitsBox.value);

        let baseLevel = 1;

        // Operation difficulty
        if (operation === 'Addition') baseLevel = 1;
        else if (operation === 'Subtraction') baseLevel = 2;
        else if (operation === 'Multiplication') baseLevel = 3;
        else if (operation === 'Division') baseLevel = 4;
        else if (operation === 'Linear Algebra') baseLevel = 5;
        else if (operation === 'Mixed') baseLevel = 3;

        // Digit multiplier
        const digitMultiplier = digits;

        return Math.min(10, baseLevel * digitMultiplier);
    }

    resetSession() {
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
        
        // Clear multi-variable inputs
        if (this.xInput) this.xInput.value = '';
        if (this.yInput) this.yInput.value = '';
        if (this.zInput) this.zInput.value = '';
        
        // Reset input visibility based on current operation
        const currentOperation = this.operationBox ? this.operationBox.value : 'Addition';
        if (currentOperation === 'Linear Algebra') {
            if (this.multiVariableAnswers) this.multiVariableAnswers.style.display = 'none';
            if (this.answerInput) this.answerInput.style.display = 'none';
        } else {
            if (this.multiVariableAnswers) this.multiVariableAnswers.style.display = 'none';
            if (this.answerInput) this.answerInput.style.display = 'block';
        }

        // cleanup focus mode
        if (this.focusTimerInterval) {
            clearInterval(this.focusTimerInterval);
            this.focusTimerInterval = null;
        }
        this.activeLevelSession = null;
        const focusBanner = document.getElementById('focusBanner');
        if (focusBanner) focusBanner.style.display = 'none';

        const controls = document.querySelector('.controls-section');
        if (controls) controls.style.display = 'block';

        // Clear feedback classes
        this.answerInput.classList.remove('correct', 'incorrect');
        this.feedback.classList.remove('success', 'error', 'neutral');

        // Update UI
        this.updateStreakDisplay();
        if (this.ghostLine) this.ghostLine.style.display = 'none';
        if (this.timerDisplay) this.timerDisplay.style.display = 'none';
        if (this.progressContainer) this.progressContainer.style.display = 'none';
        this.questionText.textContent = 'Ready?';
        this.feedback.textContent = 'Press Enter to Start';
        this.answerInput.value = '';
        this.answerInput.readOnly = false;
        
        // Set focus to appropriate input based on operation
        const selectedOperation = this.operationBox ? this.operationBox.value : 'Addition';
        if (selectedOperation === 'Linear Algebra') {
            // Show multi-variable inputs and focus on first visible one
            if (this.multiVariableAnswers) {
                this.multiVariableAnswers.style.display = 'block';
                this.answerInput.style.display = 'none';
                
                // Initialize all inputs as visible for linear algebra mode
                if (this.xInput) {
                    this.xInput.style.display = 'block';
                    this.xInput.value = '';
                }
                if (this.yInput) {
                    this.yInput.style.display = 'block';
                    this.yInput.value = '';
                }
                if (this.zInput) {
                    this.zInput.style.display = 'block';
                    this.zInput.value = '';
                }
                
                // Focus on first input
                if (this.xInput) {
                    this.xInput.focus();
                }
            }
        } else {
            // Hide multi-variable inputs and focus on main input
            if (this.multiVariableAnswers) this.multiVariableAnswers.style.display = 'none';
            this.answerInput.style.display = 'block';
            this.answerInput.focus();
        }

        // Enable/disable controls based on mode
        const mode = this.modeBox.value;
        this.operationBox.disabled = mode === 'Adaptive Coach';
        this.digitsBox.disabled = mode === 'Adaptive Coach';

        if (mode === 'Adaptive Coach') {
            if (this.coachLabel) {
                this.coachLabel.style.display = 'block';
                this.coachLabel.textContent = 'Coach is analyzing your skills...';
            }
        } else {
            if (this.coachLabel) {
                this.coachLabel.style.display = 'none';
            }
        }

        // Setup progress bar and timer
        if (mode.includes('Drill')) {
            if (this.progressContainer) this.progressContainer.style.display = 'block';
            if (this.progressLabel) this.progressLabel.textContent = '0 / 20 Questions';
            if (this.timerDisplay) this.timerDisplay.style.display = 'block';
        } else if (mode.includes('Sprint')) {
            if (this.progressContainer) this.progressContainer.style.display = 'block';
            if (this.progressLabel) this.progressLabel.textContent = '60s Remaining';
            if (this.timerDisplay) this.timerDisplay.style.display = 'block';
        } else {
            if (this.progressContainer) this.progressContainer.style.display = 'none';
            if (this.timerDisplay) this.timerDisplay.style.display = 'none';
        }

        // Notify Python
        if (mode !== 'Level') { // Don't reset session on backend if we are just initializing UI for level
            this.sendToPython('reset_session', { mode });
        }
    }

    checkActiveSession() {
        console.log('Checking for active session...');
        if (window.pythonBridge) {
            this.sendToPython('get_active_session', {}, (response) => {
                if (response && response.active && response.session) {
                    console.log('Found active session:', response.session);
                    if (response.session.mode === 'Level') {
                        this.startLevelMode(response.session);
                    } else {
                        // For other modes, we might just want to reset or restore. 
                        // For now, let's reset to be safe unless we want to support resuming standard drills too.
                        this.resetSession();
                    }
                } else {
                    this.resetSession();
                }
            });
        } else {
            this.resetSession();
        }
    }

    startLevelMode(session) {
        console.log('Starting Level Mode UI:', session);
        this.sessionActive = true;
        this.activeLevelSession = session;

        // Hide standard controls
        const controls = document.querySelector('.controls-section');
        if (controls) controls.style.display = 'none';

        // Show Focus Banner
        const banner = document.getElementById('focusBanner');
        if (banner) {
            banner.style.display = 'block';
            const title = session.level_id ? `Level ${session.level_id}` : 'Level Challenge';
            const focusLevelTitle = document.getElementById('focusLevelTitle');
            if (focusLevelTitle) focusLevelTitle.textContent = title;

            // Set initial progress
            const current = session.questions_completed || 0;
            const total = session.target_questions || 20; // Default or from session
            const focusProgress = document.getElementById('focusProgress');
            if (focusProgress) focusProgress.textContent = `${current}/${total}`;
            const pct = (current / total) * 100;
            const focusProgressFill = document.getElementById('focusProgressFill');
            if (focusProgressFill) focusProgressFill.style.width = `${pct}%`;
        }

        // Configure game input
        this.modeBox.value = 'Level';
        this.operationBox.value = session.operation || 'Addition';
        this.digitsBox.value = session.digits || 1;

        this.questionText.textContent = 'Ready?';
        this.feedback.textContent = 'Focus Mode Active';
        this.answerInput.value = '';
        this.answerInput.readOnly = false;
        this.answerInput.focus();

        // Timer Logic
        this.startFocusTimer(session);

        // Force generation of first question if we don't have one active????
        // Ideally backend should provide current question if one exists.
        // For now, let's generate a new one to kickstart.
        setTimeout(() => this.generateQuestion(), 500);
    }

    startFocusTimer(session) {
        if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);

        const startTime = Date.now(); // Or session.start_time if available??
        // Verify if session has a start time from server to be more accurate on RESUME.
        // For now, we'll just track time since this specific page load or UI initialization.
        // Ideally, we should sync with server time.

        const timeLimit = session.criteria ? session.criteria.time_limit : 0;

        this.focusTimerInterval = setInterval(() => {
            if (!this.activeLevelSession) {
                clearInterval(this.focusTimerInterval);
                return;
            }

            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000); // Approximate
            // If we had server start time, we'd use that.

            const timerDisplay = document.getElementById('focusTimer');
            if (!timerDisplay) return;

            if (timeLimit > 0) {
                const remaining = Math.max(0, timeLimit - elapsedSeconds);
                const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
                const secs = (remaining % 60).toString().padStart(2, '0');
                timerDisplay.textContent = `${mins}:${secs}`;

                if (remaining <= 0) {
                    // Time up! Handle via backend end_session or local check?
                    // Ideally backend enforces it. We just show 00:00.
                }
            } else {
                const mins = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
                const secs = (elapsedSeconds % 60).toString().padStart(2, '0');
                timerDisplay.textContent = `${mins}:${secs}`;
            }
        }, 1000);
    }

    startSessionIfNeeded() {
        const mode = this.modeBox.value;
        if (!this.sessionActive) {
            this.sessionActive = true;
            this.sessionAttempts = [];
            this.sessionMistakes = [];
            this.sessionStartTime = new Date();

            if (mode.includes('Sprint')) {
                this.startSprintTimer();
            }

            // Always send start_session to Python, even for Free Play
            this.sendToPython('start_session', {
                mode,
                operation: this.operationBox.value,
                digits: parseInt(this.digitsBox.value)
            });
        }
    }

    startSprintTimer() {
        this.sessionTimer = setInterval(() => {
            const elapsed = (Date.now() - this.sessionStartTime) / 1000;
            const remaining = Math.max(0, 60 - elapsed);

            if (this.progressFill) this.progressFill.style.width = `${((60 - remaining) / 60) * 100}%`;
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

        // For Level sessions, get questions from backend to respect level criteria
        if (this.modeBox.value === 'Level' && this.activeLevelSession) {
            this.sendToPython('get_level_question', {}, (response) => {
                if (response && response.question) {
                    this.currentAnswer = response.answer;
                    this.questionText.textContent = response.question;
                    this.generateQuestionInternalSetup();
                } else {
                    // Fallback to internal generation if backend fails
                    this.generateQuestionInternal();
                }
            });
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
        this.generateQuestionInternalSetup();
        this.generateQuestionInternalMath();
    }

    generateQuestionInternalSetup() {
        this.answerInput.readOnly = false;
        this.answerInput.value = '';
        
        // Clear multi-variable inputs
        if (this.xInput) this.xInput.value = '';
        if (this.yInput) this.yInput.value = '';
        if (this.zInput) this.zInput.value = '';
        
        // Set focus to appropriate input
        if (this.multiVariableAnswers && this.multiVariableAnswers.style.display === 'block') {
            // Focus on first visible variable input
            if (this.xInput && this.xInput.style.display !== 'none') {
                this.xInput.focus();
            } else if (this.yInput && this.yInput.style.display !== 'none') {
                this.yInput.focus();
            } else if (this.zInput && this.zInput.style.display !== 'none') {
                this.zInput.focus();
            }
        } else {
            this.answerInput.focus();
        }

        // Clear previous feedback classes and set neutral state
        this.answerInput.classList.remove('correct', 'incorrect');
        this.feedback.classList.remove('success', 'error', 'neutral');
        this.feedback.classList.add('neutral');
        this.feedback.textContent = 'Enter your answer';

        // Add active state to question
        this.questionText.classList.add('active');
    }

    generateQuestionInternalMath() {
        let operation = this.operationBox.value;
        const digits = parseInt(this.digitsBox.value);

        if (operation === 'Mixed') {
            const operations = ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Linear Algebra'];
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
                // Ensure positive result for subtraction
                if (a < b) [a, b] = [b, a];
                answer = a - b;
                symbol = '-';
            } else if (operation === 'Multiplication') {
                // For multiplication, use smaller numbers to avoid very large results
                if (digits > 1) {
                    a = Math.floor(Math.random() * (Math.min(high, 20) - low + 1)) + low;
                    b = Math.floor(Math.random() * (Math.min(high, 20) - low + 1)) + low;
                }
                answer = a * b;
                symbol = '×';
            } else if (operation === 'Linear Algebra') {
                // Generate different types of algebra problems
                const equationType = Math.floor(Math.random() * 4); // 0-3
                
                // Show multi-variable inputs container
                this.multiVariableAnswers.style.display = 'block';
                
                if (equationType === 0) {
                    // Single linear equation: ax = b
                    a = Math.floor(Math.random() * (Math.min(high, 20) - 2 + 1)) + 2;
                    b = Math.floor(Math.random() * (Math.min(high, 100) - 1 + 1)) + 1;
                    answer = Math.floor(b / a);
                    this.questionText.textContent = `Solve: ${a}x = ${b}`;
                    this.currentAnswer = `x=${answer}`;
                    
                    // Show only x input
                    this.xInput.style.display = 'block';
                    this.yInput.style.display = 'none';
                    this.zInput.style.display = 'none';
                    this.xInput.placeholder = 'x = ?';
                    
                    return; // Early return for Linear Algebra
                } else if (equationType === 1) {
                    // Quadratic equation: x² + bx + c = 0 (perfect square)
                    const x = Math.floor(Math.random() * (digits === 1 ? 5 : 10)) + 1;
                    const bCoeff = -2 * x;
                    const cCoeff = x * x;
                    this.questionText.textContent = `Solve: x² + ${bCoeff}x + ${cCoeff} = 0`;
                    this.currentAnswer = `x=${x}`;
                    
                    // Show only x input
                    this.xInput.style.display = 'block';
                    this.yInput.style.display = 'none';
                    this.zInput.style.display = 'none';
                    this.xInput.placeholder = 'x = ?';
                    
                    return; // Early return for Linear Algebra
                } else if (equationType === 2) {
                    // 2x2 linear system
                    let attempts = 0;
                    const maxAttempts = 10;
                    
                    while (attempts < maxAttempts) {
                        const a1 = Math.floor(Math.random() * (digits === 1 ? 5 : 20)) + 1;
                        const b1 = Math.floor(Math.random() * (digits === 1 ? 5 : 20)) + 1;
                        const c1 = Math.floor(Math.random() * (digits === 1 ? 20 : 100)) + 1;
                        const a2 = Math.floor(Math.random() * (digits === 1 ? 5 : 20)) + 1;
                        const b2 = Math.floor(Math.random() * (digits === 1 ? 5 : 20)) + 1;
                        const c2 = Math.floor(Math.random() * (digits === 1 ? 20 : 100)) + 1;
                        
                        const determinant = a1 * b2 - b1 * a2;
                        if (Math.abs(determinant) > 0.001) { // Avoid floating point issues
                            const x = Math.round((c1 * b2 - b1 * c2) / determinant);
                            const y = Math.round((a1 * c2 - c1 * a2) / determinant);
                            
                            // Ensure reasonable answer ranges
                            if (Math.abs(x) <= 50 && Math.abs(y) <= 50) {
                                this.questionText.textContent = `Solve: ${a1}x + ${b1}y = ${c1}, ${a2}x + ${b2}y = ${c2}`;
                                this.currentAnswer = `x=${x}, y=${y}`;
                                
                                // Show x and y inputs
                                this.xInput.style.display = 'block';
                                this.yInput.style.display = 'block';
                                this.zInput.style.display = 'none';
                                this.xInput.placeholder = 'x = ?';
                                this.yInput.placeholder = 'y = ?';
                                
                                return; // Early return for Linear Algebra
                            }
                        }
                        attempts++;
                    }
                    
                    // Fallback to simple system if generation fails
                    const x = Math.floor(Math.random() * 10) + 1;
                    const y = Math.floor(Math.random() * 10) + 1;
                    const a1 = 1, b1 = 1, c1 = x + y;
                    const a2 = 1, b2 = -1, c2 = x - y;
                    
                    this.questionText.textContent = `Solve: ${a1}x + ${b1}y = ${c1}, ${a2}x + ${b2}y = ${c2}`;
                    this.currentAnswer = `x=${x}, y=${y}`;
                    
                    this.xInput.style.display = 'block';
                    this.yInput.style.display = 'block';
                    this.zInput.style.display = 'none';
                    this.xInput.placeholder = 'x = ?';
                    this.yInput.placeholder = 'y = ?';
                    
                    return;
                } else {
                    // Three variable system: x + y = a, y + z = b, x + z = c
                    const x = Math.floor(Math.random() * (digits === 1 ? 5 : 15)) + 1;
                    const y = Math.floor(Math.random() * (digits === 1 ? 5 : 15)) + 1;
                    const z = Math.floor(Math.random() * (digits === 1 ? 5 : 15)) + 1;
                    const a = x + y;
                    const b = y + z;
                    const c = x + z;
                    this.questionText.textContent = `Solve: x + y = ${a}, y + z = ${b}, x + z = ${c}`;
                    this.currentAnswer = `x=${x}, y=${y}, z=${z}`;
                    
                    // Show all three inputs
                    this.xInput.style.display = 'block';
                    this.yInput.style.display = 'block';
                    this.zInput.style.display = 'block';
                    this.xInput.placeholder = 'x = ?';
                    this.yInput.placeholder = 'y = ?';
                    this.zInput.placeholder = 'z = ?';
                    
                    return; // Early return for Linear Algebra
                }
                
                // Fallback if none of the above worked
                a = 1;
                b = 1;
                answer = 1;
                symbol = 'LA';
            }
        }

        // Hide multi-variable inputs for non-Linear Algebra operations
        if (operation !== 'Linear Algebra') {
            this.multiVariableAnswers.style.display = 'none';
            this.answerInput.style.display = 'block'; // Show main input
        } else {
            // For Linear Algebra, hide the main answer input
            this.answerInput.style.display = 'none';
        }

        // Only set fallback answer and question text if not Linear Algebra
        if (operation !== 'Linear Algebra') {
            this.currentAnswer = answer;
            this.questionText.textContent = `${a} ${symbol} ${b} = ?`;
        }

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
        console.log('Timer started for question:', this.questionText.textContent);

        // Smooth animation for question appearance
        this.questionText.style.opacity = '0';
        this.questionText.style.transform = 'translateY(10px)';
        setTimeout(() => {
            this.questionText.style.opacity = '1';
            this.questionText.style.transform = 'translateY(0)';
        }, 50);
    }

    checkAnswer() {
        console.log('=== checkAnswer called ===');
        console.log('startTime:', this.startTime);
        console.log('answerInput.value:', this.answerInput.value);

        if (this.startTime === null) {
            console.log('startTime is null, generating question...');
            this.generateQuestion();
            return;
        }

        const userText = this.answerInput.value.trim();
        console.log('userText:', userText);
        
        // For Linear Algebra, collect from multi-variable inputs instead
        if (this.multiVariableAnswers && this.multiVariableAnswers.style.display === 'block') {
            let userAnswer = '';
            
            // Collect values from visible inputs
            if (this.xInput && this.xInput.style.display !== 'none') {
                const xValue = this.xInput.value.trim();
                if (xValue) userAnswer += `x=${xValue}`;
            }
            
            if (this.yInput && this.yInput.style.display !== 'none') {
                const yValue = this.yInput.value.trim();
                if (yValue) {
                    if (userAnswer) userAnswer += ', ';
                    userAnswer += `y=${yValue}`;
                }
            }
            
            if (this.zInput && this.zInput.style.display !== 'none') {
                const zValue = this.zInput.value.trim();
                if (zValue) {
                    if (userAnswer) userAnswer += ', ';
                    userAnswer += `z=${zValue}`;
                }
            }
            
            // Use the collected answer for Linear Algebra
            if (!userAnswer) {
                console.log('No input in multi-variable fields, returning...');
                return;
            }
            
            // Update userText for answer checking
            userText = userAnswer;
        }
        
        if (!userText) {
            console.log('userText is empty, returning...');
            return;
        }

        const elapsed = (Date.now() / 1000) - this.startTime;
        let correct = false;

        // Check if this is a Linear Algebra question (string answer)
        if (typeof this.currentAnswer === 'string' && this.currentAnswer.includes('=')) {
            // Linear Algebra answers are strings like "x=5" or "x=3, y=2"
            // Normalize both answers for comparison
            const normalizeAnswer = (answer) => {
                return answer.trim()
                    .toLowerCase()
                    .replace(/\s+/g, '') // Remove all spaces
                    .replace(/,+/g, ', ') // Ensure single comma with space
                    .replace(/,\s*$/, '') // Remove trailing comma
                    .replace(/,\s*,/g, ',') // Remove double commas
                    .trim();
            };
            
            correct = normalizeAnswer(userText) === normalizeAnswer(this.currentAnswer);
        } else {
            // Regular numeric answers
            try {
                const val = parseFloat(userText);
                correct = Math.abs(val - this.currentAnswer) < 0.001;
            } catch (e) {
                correct = false;
            }
        }

        console.log('elapsed:', elapsed);
        console.log('correct:', correct);

        const questionText = this.questionText.textContent;
        const userAnswer = userText;
        const correctAnswer = this.currentAnswer;
        const timeTaken = elapsed;

        console.log('About to call logAttempt...');
        // Use the enhanced logAttempt method
        this.logAttempt(correct, timeTaken, questionText, userAnswer, correctAnswer);

        // Play sound
        try {
            if (window.settingsManager && window.settingsManager.settings && window.settingsManager.settings.sound) {
                this.sendToPython('play_sound', { success: correct });
            }
        } catch (e) {
            console.warn('Sound settings not available:', e);
        }

        // Clear previous feedback classes
        this.answerInput.classList.remove('correct', 'incorrect');
        this.xInput.classList.remove('correct', 'incorrect');
        this.yInput.classList.remove('correct', 'incorrect');
        this.zInput.classList.remove('correct', 'incorrect');
        this.feedback.classList.remove('success', 'error', 'neutral');

        if (correct) {
            this.streak++;
            this.updateStreakDisplay();

            // Enhanced correct answer feedback
            if (this.multiVariableAnswers.style.display === 'block') {
                // Apply to visible multi-variable inputs
                if (this.xInput.style.display !== 'none') this.xInput.classList.add('correct');
                if (this.yInput.style.display !== 'none') this.yInput.classList.add('correct');
                if (this.zInput.style.display !== 'none') this.zInput.classList.add('correct');
            } else {
                this.answerInput.classList.add('correct');
            }
            this.feedback.classList.add('success');
            this.feedback.innerHTML = `✅ Correct! (${elapsed.toFixed(2)}s)${this.streak > 1 ? ` • 🔥 Streak: ${this.streak}` : ''}`;

            this.flashOverlay('success');
            this.answerInput.readOnly = true;
            
            // Clear inputs after a delay for better UX
            setTimeout(() => {
                if (this.multiVariableAnswers.style.display === 'block') {
                    if (this.xInput.style.display !== 'none') this.xInput.value = '';
                    if (this.yInput.style.display !== 'none') this.yInput.value = '';
                    if (this.zInput.style.display !== 'none') this.zInput.value = '';
                    
                    // Refocus on first visible input for linear algebra
                    if (this.xInput.style.display !== 'none') {
                        this.xInput.focus();
                    } else if (this.yInput.style.display !== 'none') {
                        this.yInput.focus();
                    } else if (this.zInput.style.display !== 'none') {
                        this.zInput.focus();
                    }
                } else {
                    this.answerInput.value = '';
                    this.answerInput.focus();
                }
                this.answerInput.readOnly = false;
            }, 500);

            if (this.retakActive) {
                const qText = this.questionText.textContent;
                this.retakeMastery[qText] = (this.retakeMastery[qText] || 0) + 1;

                if (this.retakeMastery[qText] >= 2) {
                    this.retakeQueue.shift();
                    this.feedback.innerHTML = '🎯 MASTERED! Ready for next challenge';
                } else {
                    const item = this.retakeQueue.shift();
                    this.retakeQueue.push(item);
                    this.feedback.innerHTML = '👍 1/2 - One more correct answer to master!';
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

            // Enhanced incorrect answer feedback
            if (this.multiVariableAnswers.style.display === 'block') {
                // Apply to visible multi-variable inputs
                if (this.xInput.style.display !== 'none') this.xInput.classList.add('incorrect');
                if (this.yInput.style.display !== 'none') this.yInput.classList.add('incorrect');
                if (this.zInput.style.display !== 'none') this.zInput.classList.add('incorrect');
            } else {
                this.answerInput.classList.add('incorrect');
            }
            this.feedback.classList.add('error');
            this.feedback.innerHTML = `❌ Incorrect. The answer is ${this.currentAnswer}. Your answer: ${userText}`;

            this.flashOverlay('error');
            this.shakeInput();

            this.startTime = null;
            
            // Clear appropriate inputs
            if (this.multiVariableAnswers.style.display === 'block') {
                if (this.xInput.style.display !== 'none') this.xInput.value = '';
                if (this.yInput.style.display !== 'none') this.yInput.value = '';
                if (this.zInput.style.display !== 'none') this.zInput.value = '';
            } else {
                this.answerInput.value = '';
            }

            if (this.retakActive) {
                this.retakeMastery[currQText] = 0;
                const item = this.retakeQueue.shift();
                this.retakeQueue.push(item);
                this.feedback.innerHTML = '💪 Keep practicing! Try this one again';
                setTimeout(() => this.generateQuestion(), 1500);
                return;
            }

            this.updateProgress();
        }
    }

    updateStreakDisplay() {
        this.streakCounter.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg> <span id="streakValue">${this.streak}</span>`;
        this.updateStats();
    }

    updateProgress() {
        const mode = this.modeBox.value;
        const count = this.sessionAttempts.length;

        // Update Focus Mode UI if active
        if (this.activeLevelSession && document.getElementById('focusBanner').style.display !== 'none') {
            const current = (this.activeLevelSession.questions_completed || 0) + count;
            const total = this.activeLevelSession.target_value || 20; // Assuming target_value for questions

            document.getElementById('focusProgress').textContent = `${current}/${total}`;
            const pct = Math.min((current / total) * 100, 100);
            const focusProgressFill = document.getElementById('focusProgressFill');
            if (focusProgressFill) focusProgressFill.style.width = `${pct}%`;
        }

        if (mode.includes('Drill')) {
            if (this.progressFill) this.progressFill.style.width = `${(count / 20) * 100}%`;
            this.progressLabel.textContent = `${count} / 20`;

            if (count >= 20) {
                this.endSession();
            }
        } else if (mode === 'Level') {
            // For level sessions, check if we have an active session with target
            this.sendToPython('get_active_session', {}, (response) => {
                if (response.active && response.session.target_value) {
                    const target = response.session.target_value;
                    if (this.progressFill) this.progressFill.style.width = `${(count / target) * 100}%`;
                    this.progressLabel.textContent = `${count} / ${target}`;

                    // Auto-end session when target is reached
                    if (count >= target) {
                        this.endSession();
                    }
                }
            });
        }
    }

    endSession() {
        this.sessionActive = false;

        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }

        this.answerInput.readOnly = true;

        // Hide timer and progress when session ends
        if (this.timerDisplay) this.timerDisplay.style.display = 'none';
        if (this.progressContainer) this.progressContainer.style.display = 'none';

        const total = this.sessionAttempts.length;
        const correct = this.sessionAttempts.filter(a => a.correct).length;
        const totalTime = this.sessionAttempts.reduce((sum, a) => sum + a.time, 0);
        const avgSpeed = total > 0 ? totalTime / total : 0;
        const accuracy = total > 0 ? (correct / total) * 100 : 0;

        const sessionData = {
            mode: this.modeBox.value,
            operation: this.operationBox.value,
            digits: parseInt(this.digitsBox.value),
            total,
            correct,
            avgSpeed,
            totalTime,
            mistakes: this.sessionMistakes,
            maxStreak: this.streak
        };

        // For level sessions, let the Python backend handle navigation
        if (this.modeBox.value === 'Level') {
            this.sendToPython('end_session', sessionData, (response) => {
                // Don't show result modal for level sessions - Python handles navigation
                console.log('Level session ended, navigation handled by Python');
            });
        } else {
            // Regular sessions show the result modal
            this.sendToPython('end_session', sessionData, (response) => {
                this.updateStats(); // Refresh stats on main page
                this.showResultModal(sessionData, response.newBadges);
            });
        }
    }

    showResultModal(sessionData, newBadges) {
        const modal = this.resultModal;
        const accuracy = sessionData.total > 0 ? (sessionData.correct / sessionData.total) * 100 : 0;

        const resultAccuracy = document.getElementById('resultAccuracy');
        const resultSpeed = document.getElementById('resultSpeed');
        const resultTotal = document.getElementById('resultTotal');
        const resultTime = document.getElementById('resultTime');
        
        if (resultAccuracy) resultAccuracy.textContent = `${accuracy.toFixed(1)}%`;
        if (resultSpeed) resultSpeed.textContent = `${sessionData.avgSpeed.toFixed(2)}s`;
        if (resultTotal) resultTotal.textContent = sessionData.total;
        if (resultTime) resultTime.textContent = `${sessionData.totalTime.toFixed(1)}s`;

        if (sessionData.mistakes.length === 0) {
            if (mistakesSection) mistakesSection.style.display = 'none';
            if (retakeBtn) retakeBtn.style.display = 'none';

            // Show perfect message
            const perfectMsg = document.createElement('div');
            perfectMsg.style.fontWeight = 'bold';
            perfectMsg.style.textAlign = 'center';
            perfectMsg.style.marginBottom = '20px';
            perfectMsg.textContent = 'Perfect Session! ';
            if (mistakesSection) mistakesSection.parentNode.insertBefore(perfectMsg, mistakesSection);
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
            if (this.timerDisplay) {
                this.timerDisplay.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> <span id="timerValue">${elapsed.toFixed(1)}s</span>`;
                console.log(`Timer updated: ${elapsed.toFixed(1)}s`);
            } else {
                console.error('Timer display element not found!');
            }
        } else {
            if (this.timerDisplay) {
                this.timerDisplay.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> <span id="timerValue">0.0s</span>`;
            }
        }
    }

    updateStats() {
        this.sendToPython('get_stats', {}, (stats) => {
            if (!stats) {
                console.warn('No stats data received');
                return;
            }

            // Update stat displays with null checks
            if (this.sessionCount) this.sessionCount.textContent = stats.session || 0;
            if (this.todayCount) this.todayCount.textContent = stats.today || 0;
            if (this.lifetimeCount) this.lifetimeCount.textContent = stats.lifetime || 0;

            if (this.statsDetail) {
                if (stats.today > 0) {
                    const accuracy = stats.accuracy || 0;
                    const avgSpeed = stats.avgSpeed || 0;
                    const totalTime = stats.totalTime || 0;
                    this.statsDetail.textContent = `Today: ${accuracy.toFixed(0)}% accuracy • ${avgSpeed.toFixed(2)}s avg • ${Math.floor(totalTime)}s total`;
                } else {
                    this.statsDetail.textContent = 'Start answering to see stats';
                }
            }

            // Update daily goals if available
            if (stats.daily_goals) {
                this.updateDailyGoalsDisplay(stats.daily_goals);
            }
        });
    }

    updateDailyGoalsDisplay(dailyGoals) {
        // Update daily goals display in UI
        const goalsContainer = document.getElementById('dailyGoalsContainer');
        if (goalsContainer && dailyGoals) {
            const questionProgress = dailyGoals.question_progress || 0;
            const timeProgress = dailyGoals.time_progress || 0;

            goalsContainer.innerHTML = `
                <div class="daily-goals-section">
                    <h4>Daily Goals</h4>
                    <div class="goal-item">
                        <span>Questions: ${dailyGoals.questions_completed}/${dailyGoals.target_questions}</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${questionProgress}%"></div>
                        </div>
                    </div>
                    <div class="goal-item">
                        <span>Time: ${Math.floor(dailyGoals.time_spent_minutes)}min/${dailyGoals.target_time_minutes}min</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${timeProgress}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    async setDailyGoals(targetQuestions, targetTimeMinutes) {
        if (window.realtimeManager) {
            const result = await window.realtimeManager.setDailyGoals(targetQuestions, targetTimeMinutes);
            if (result) {
                this.updateDailyGoalsDisplay(result);
                this.showToast('Daily goals updated!', 'success');
            }
        }
    }

    async exportUserData() {
        if (window.realtimeManager) {
            const result = await window.realtimeManager.exportData();
            if (result && !result.error) {
                // Create download link
                const dataStr = JSON.stringify(result, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `math_drill_backup_${new Date().toISOString().split('T')[0]}.json`;
                link.click();

                URL.revokeObjectURL(url);
                this.showToast('Data exported successfully!', 'success');
            } else {
                this.showToast('Failed to export data', 'error');
            }
        }
    }

    async importUserData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (window.realtimeManager) {
                const result = await window.realtimeManager.importData(data);
                if (result && result.success) {
                    this.showToast('Data imported successfully!', 'success');
                    // Refresh all data
                    this.updateStats();
                    if (window.realtimeManager) {
                        window.realtimeManager.refreshAllData();
                    }
                } else {
                    this.showToast('Failed to import data', 'error');
                }
            }
        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Invalid file format', 'error');
        }
    }

    showToast(message, type = 'info') {
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--error-color)' : 'var(--primary)'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
        `;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
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

        switch (type) {
            case 'result':
                this.resultModal.style.display = 'block';
                break;
        }
    }

    closeModal(type) {
        switch (type) {
            case 'result':
                this.resultModal.style.display = 'none';
                this.resetSession();
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

    showAchievementToast(badges) {
        const toast = this.achievementToast;
        const message = document.getElementById('toastMessage');

        message.innerHTML = badges.map(b => `<p>UNLOCKED: ${b.name}<br>${b.desc}</p>`).join('');
        toast.style.display = 'block';
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

// Global function for Python to call
window.updateFromPython = function (action, data) {
    if (window.mathDrill) {
        switch (action) {
            case 'updateStats':
                window.mathDrill.updateStats();
                break;
            case 'showAchievementToast':
                window.mathDrill.showAchievementToast(data);
                break;
            // Add more as needed
        }
    }
};
