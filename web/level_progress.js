/**
 * LevelProgress manages the gameplay within a level.
 * Refactored for robust state management and precise timing.
 */
class LevelProgress {
    constructor() {
        // State
        this.levelId = null;
        this.levelData = null;
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.correctCount = 0;

        // Timing
        this.levelStartTime = 0;
        this.questionStartTime = 0;
        this.totalTimeTaken = 0; // accumulated time
        this.timerInterval = null;
        this.autoAdvanceTimer = null;

        // UI State
        this.state = 'LOADING'; // LOADING, READY, PLAYING, FEEDBACK, FINISHED

        // MCQ State
        this.isMCQMode = false;
        this.mcqOptions = [];
        this.selectedMCQOption = null;

        this.bridge = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupBridge();
    }

    setupEventListeners() {
        // Navigation
        this.bindClick('backButton', () => this.goBack());
        this.bindClick('backToLevelsBtn', () => this.goBack());

        // Game Actions
        this.bindClick('submitButton', () => this.submitAnswer());
        this.bindClick('nextButton', () => this.nextQuestion()); // Manual advance if needed

        // Modal Actions
        this.bindClick('nextLevelBtn', () => this.goToNextLevel());
        this.bindClick('retryLevelBtn', () => this.retryLevel());

        // Input
        const input = document.getElementById('answerInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.submitAnswer();
            });
        }

        // MCQ option listeners
        document.querySelectorAll('.mcq-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (!option.disabled) {
                    this.selectMCQOption(option.dataset.option);
                }
            });
        });

        // MCQ keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.state !== 'PLAYING' || !this.isMCQMode) return;
            
            switch(e.key.toLowerCase()) {
                case '1':
                case '2':
                case '3':
                case '4':
                    e.preventDefault();
                    const optionIndex = parseInt(e.key) - 1;
                    const optionLabels = ['A', 'B', 'C', 'D'];
                    if (optionIndex < optionLabels.length) {
                        this.selectMCQOption(optionLabels[optionIndex]);
                    }
                    break;
                case 'a':
                case 's':
                case 'd':
                case 'f':
                    e.preventDefault();
                    const keyMap = { 'a': 'A', 's': 'B', 'd': 'C', 'f': 'D' };
                    this.selectMCQOption(keyMap[e.key.toLowerCase()]);
                    break;
            }
        });
    }

    bindClick(id, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }

    setupBridge() {
        const initBridge = () => {
            if (typeof QWebChannel !== 'undefined' && typeof qt !== 'undefined') {
                new QWebChannel(qt.webChannelTransport, (channel) => {
                    this.bridge = channel.objects.pybridge;
                    if (this.bridge) {
                        this.bridge.messageReceived.connect(this.handlePythonResponse.bind(this));
                        this.loadLevelData();
                    }
                });
            } else {
                setTimeout(initBridge, 100);
            }
        };
        initBridge();
    }

    loadLevelData() {
        const params = new URLSearchParams(window.location.search);
        this.levelId = parseInt(params.get('levelId')) || 1;

        this.sendToPython({
            type: 'get_level',
            payload: { levelId: this.levelId }
        });
    }

    handlePythonResponse(responseStr) {
        try {
            console.log('Received Python response:', responseStr.substring(0, 200) + '...');
            const data = JSON.parse(responseStr);
            const type = data.type;
            const payload = data.payload;

            console.log('Processing response type:', type);

            if (type === 'get_level_response') {
                console.log('Starting level with payload:', payload);
                this.startLevel(payload);
            } else if (type === 'complete_level_response') {
                this.showCompletionModal(payload);
            } else if (type === 'error') {
                console.error('Backend Error:', payload.message);
                alert('Error: ' + payload.message); // Simple fallback
            } else {
                console.log('Unhandled response type:', type);
            }
        } catch (e) {
            console.error('Response parse error:', e);
            console.error('Response string was:', responseStr);
        }
    }

    sendToPython(msg) {
        if (this.bridge) {
            this.bridge.sendMessage(JSON.stringify(msg));
        }
    }

    // --- Game Logic ---

    startLevel(data) {
        try {
            console.log('Starting level with data:', data);
            this.levelData = data;
            
            // Add safeguards for question generation
            const maxQuestions = Math.min(data.requirements.totalQuestions || 10, 50); // Cap at 50 questions
            console.log(`Generating ${maxQuestions} questions (was ${data.requirements.totalQuestions})`);
            
            this.questions = this.generateQuestions(data, maxQuestions);
            this.currentQuestionIndex = 0;
            this.correctCount = 0;
            this.totalTimeTaken = 0;

            // Load MCQ mode setting
            this.loadMCQMode();

            this.updateHeaderUI();
            this.setState('PLAYING');
            this.loadQuestion(0);

            this.levelStartTime = Date.now();
            // If level has a total time limit, we could track it here
            if (this.levelData.requirements.timeLimit) {
                this.startLevelTimer(this.levelData.requirements.timeLimit);
            }
        } catch (error) {
            console.error('Error starting level:', error);
            alert('Error starting level: ' + error.message);
        }
    }

    generateQuestions(level, maxCount = null) {
        try {
            // Generate robust questions based on ops
            const count = maxCount !== null ? maxCount : level.requirements.totalQuestions;
            const qs = [];
            console.log(`Generating ${count} questions for ${level.operation} with ${level.digits} digits`);
            
            // Add progress logging for large question sets
            const logInterval = Math.max(1, Math.floor(count / 10));
            
            for (let i = 0; i < count; i++) {
                if (i % logInterval === 0) {
                    console.log(`Question generation progress: ${i}/${count}`);
                }
                qs.push(this.createQuestion(level.operation, level.digits));
            }
            console.log(`Generated ${qs.length} questions successfully`);
            return qs;
        } catch (error) {
            console.error('Error generating questions:', error);
            // Return fallback questions if generation fails
            return [
                { prompt: '1 + 1 = ?', answer: 2 },
                { prompt: '2 + 2 = ?', answer: 4 },
                { prompt: '3 + 3 = ?', answer: 6 }
            ];
        }
    }

    createQuestion(op, digits) {
        try {
            const max = Math.pow(10, digits);
            const min = Math.pow(10, digits - 1);

            // Helper
            const rand = (min, max) => {
                try {
                    return Math.floor(Math.random() * (max - min)) + min;
                } catch (error) {
                    console.error('Error in rand function:', error);
                    return Math.floor(Math.random() * 9) + 1; // Fallback
                }
            };

            if (op === 'addition') {
                const a = rand(min, max);
                const b = rand(min, max);
                return { prompt: `${a} + ${b} = ?`, answer: a + b };
            }
            else if (op === 'subtraction') {
                const a = rand(min, max);
                const b = rand(min, max);
                return {
                    prompt: `${Math.max(a, b)} - ${Math.min(a, b)} = ?`,
                    answer: Math.max(a, b) - Math.min(a, b)
                };
            }
            else if (op === 'multiplication') {
                // For mult, we might want smaller numbers for sanity if digits is large,
                // but let's stick to the digits rule or cap it like original
                const limit = Math.pow(10, Math.ceil(digits / 2)) - 1;
                const a = rand(2, limit);
                const b = rand(2, limit);
                return { prompt: `${a} × ${b} = ?`, answer: a * b };
            }
            else if (op === 'division') {
                // inverse of mult
                const limit = Math.pow(10, Math.ceil(digits / 2)) - 2;
                const divisor = rand(2, limit);
                const quotient = rand(min, max);
                const dividend = divisor * quotient;
                return {
                    prompt: `${dividend} ÷ ${divisor} = ?`,
                    answer: quotient
                };
            }
            else if (op === 'complex') {
                return this.createComplexQuestion(digits);
            }

            return { prompt: '0 + 0 = ?', answer: 0 };
        } catch (error) {
            console.error('Error creating question:', error);
            return { prompt: '1 + 1 = ?', answer: 2 }; // Fallback question
        }
    }

    createComplexQuestion(digits) {
        try {
            // Simple random complex ops
            const a = Math.floor(Math.random() * 20) + 1;
            const b = Math.floor(Math.random() * 20) + 1;
            const c = Math.floor(Math.random() * 10) + 1;

            const types = [
                () => ({ prompt: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c }),
                () => ({ prompt: `${a} × ${b} + ${c} = ?`, answer: a * b + c }),
                () => ({ prompt: `${a} + ${b} + ${c} = ?`, answer: a + b + c }),
            ];

            const type = types[Math.floor(Math.random() * types.length)];
            return type();
        } catch (error) {
            console.error('Error creating complex question:', error);
            return { prompt: '1 + 1 + 1 = ?', answer: 3 }; // Fallback
        }
    }

    loadQuestion(index) {
        if (index >= this.questions.length) {
            this.finishLevel();
            return;
        }

        const card = document.getElementById('questionCard');
        if (this.currentQuestionIndex !== index && index > 0) {
            card.classList.add('slide-out');
            setTimeout(() => {
                this.setupQuestion(index);
                card.classList.remove('slide-out');
                card.classList.add('slide-in');
                setTimeout(() => card.classList.remove('slide-in'), 300);
            }, 300);
        } else {
            this.setupQuestion(index);
        }
    }

    setupQuestion(index) {
        const q = this.questions[index];
        this.currentQuestionIndex = index;
        this.questionStartTime = Date.now();

        // UI - Update to match new HTML structure
        const questionDisplay = document.getElementById('questionDisplay');
        if (questionDisplay) {
            questionDisplay.textContent = q.prompt;
        }
        this.setValue('answerInput', '');
        this.setText('progressText', `${index + 1}/${this.questions.length}`);

        const feedback = document.getElementById('feedbackArea');
        if (feedback) feedback.style.display = 'none';

        // Setup input mode based on MCQ setting
        if (this.isMCQMode) {
            this.setupMCQMode();
        } else {
            this.setupTypingMode();
        }

        this.updateProgressBar();
    }

    submitAnswer() {
        if (this.state !== 'PLAYING') return;

        // Route to appropriate submit method based on mode
        if (this.isMCQMode) {
            // MCQ mode is handled by selectMCQOption -> submitMCQAnswer
            return;
        }

        const input = document.getElementById('answerInput');
        const val = parseFloat(input.value);
        if (isNaN(val)) return; // Valid numeric check

        const q = this.questions[this.currentQuestionIndex];
        const correct = Math.abs(val - q.answer) < 0.001; // Float tolerance

        // Accumulate time
        const now = Date.now();
        const duration = (now - this.questionStartTime) / 1000;
        this.totalTimeTaken += duration;

        if (correct) {
            this.correctCount++;
        }

        this.setState('FEEDBACK');
        this.showFeedback(correct, q.answer);
    }

    showFeedback(isCorrect, correctAnswer) {
        const area = document.getElementById('feedbackArea');
        const icon = document.getElementById('feedbackIcon');
        const title = document.getElementById('feedbackTitle');
        const userAnswerEl = document.getElementById('userAnswer');
        const correctAnswerEl = document.getElementById('correctAnswer');
        const timeTakenEl = document.getElementById('timeTaken');

        if (area && icon && title) {
            // Set feedback type styling
            area.className = 'feedback-area' + (isCorrect ? ' correct' : ' incorrect');
            
            // Set icon and title
            icon.textContent = isCorrect ? '✓' : '✗';
            title.textContent = isCorrect ? 'Correct!' : 'Incorrect';
            
            // Set answer details
            if (userAnswerEl) {
                const input = document.getElementById('answerInput');
                userAnswerEl.textContent = input ? input.value : '-';
            }
            if (correctAnswerEl) {
                correctAnswerEl.textContent = correctAnswer;
            }
            if (timeTakenEl) {
                const duration = ((Date.now() - this.questionStartTime) / 1000).toFixed(1);
                timeTakenEl.textContent = `${duration}s`;
            }
            
            area.style.display = 'block';
        }

        // Hide input areas during feedback
        if (this.isMCQMode) {
            document.getElementById('mcqInputArea').style.display = 'none';
        } else {
            document.getElementById('answerInput').disabled = true;
            document.getElementById('submitButton').disabled = true;
        }

        // Auto Advance
        const delay = isCorrect ? 1000 : 2000;
        this.autoAdvanceTimer = setTimeout(() => {
            this.nextQuestion();
        }, delay);

        // Update stats
        this.updateStatsUI();
    }

    nextQuestion() {
        if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);

        this.setState('PLAYING');
        this.loadQuestion(this.currentQuestionIndex + 1);
    }

    finishLevel() {
        this.setState('FINISHED');
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.sendToPython({
            type: 'complete_level',
            payload: {
                levelId: this.levelId,
                correctAnswers: this.correctCount,
                totalQuestions: this.questions.length,
                timeTaken: this.totalTimeTaken
            }
        });
    }

    // --- UI Updates ---

    updateHeaderUI() {
        this.setText('levelTitle', this.levelData.name);
        this.setText('levelDescription', this.levelData.description);
    }

    updateProgressBar() {
        const pct = ((this.currentQuestionIndex) / this.questions.length) * 100;
        const bar = document.getElementById('progressBar');
        if (bar) bar.style.width = `${pct}%`;
    }

    updateStatsUI() {
        const acc = Math.round((this.correctCount / (this.currentQuestionIndex + 1)) * 100);
        this.setText('accuracyText', `${acc}%`);
    }

    showCompletionModal(result) {
        const modal = document.getElementById('completionModal');
        const overlay = document.getElementById('modalOverlay');

        // Update Content
        this.setText('finalAccuracy', `${Math.round(result.accuracy)}%`);
        this.setText('finalTime', `${Math.round(result.timeTaken)}s`);

        const title = modal.querySelector('h2');
        if (title) {
            title.textContent = result.success ? window.t('levels.level_complete') : window.t('levels.level_failed');
            title.style.color = result.success ? 'var(--text-color)' : 'var(--danger-color)';
        }

        const stars = document.getElementById('earnedStars');
        stars.innerHTML = '';
        const limit = 3;
        for (let i = 0; i < limit; i++) {
            const s = document.createElement('span');
            const isActive = result.success && i < result.starsEarned;
            s.className = 'star-lg' + (isActive ? '' : ' empty');
            s.style.color = isActive ? '#fbbf24' : '#334155';
            s.style.fontSize = '3rem';
            s.textContent = '★';
            stars.appendChild(s);
        }

        const nextBtn = document.getElementById('nextLevelBtn');
        if (nextBtn) nextBtn.style.display = (result.success && result.nextLevelId) ? 'inline-block' : 'none';

        if (modal) modal.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
    }

    // --- Helpers ---

    setState(newState) {
        this.state = newState;
    }

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    setValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    startLevelTimer(limit) {
        // Simple countdown
        const timerText = document.getElementById('timerText');
        const timerDiv = document.getElementById('timerStatDiv');
        if (timerDiv) timerDiv.style.display = 'flex';

        let remaining = limit;
        this.timerInterval = setInterval(() => {
            remaining--;
            if (timerText) timerText.textContent = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;
            if (remaining <= 0) {
                clearInterval(this.timerInterval);
                this.finishLevel();
            }
        }, 1000);
    }

    goBack() {
        window.location.href = 'levels.html';
    }

    retryLevel() {
        window.location.reload();
    }

    goToNextLevel() {
        // In a real app we'd get the ID from result, assume we handled it in modal logic or stored it
        // For now, reload to levels or handle via param if passed
        // Simplest: go back to list, they will see next unlocked
        window.location.href = 'levels.html';
    }

    // --- MCQ Methods ---
    
    loadMCQMode() {
        // Check global appSettings first
        if (window.appSettings) {
            this.isMCQMode = window.appSettings.mcqMode || false;
        } else {
            // Fallback to localStorage
            const saved = localStorage.getItem('appSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.isMCQMode = settings.mcqMode || false;
            }
        }
    }

    setupTypingMode() {
        // Show typing input, hide MCQ
        const typingArea = document.getElementById('typingInputArea');
        const mcqArea = document.getElementById('mcqInputArea');
        
        if (typingArea) typingArea.style.display = 'flex';
        if (mcqArea) mcqArea.style.display = 'none';
        
        // Enable input
        const input = document.getElementById('answerInput');
        if (input) {
            input.disabled = false;
            input.focus();
        }
        const submitBtn = document.getElementById('submitButton');
        if (submitBtn) submitBtn.disabled = false;
    }

    setupMCQMode() {
        // Show MCQ, hide typing input
        const typingArea = document.getElementById('typingInputArea');
        const mcqArea = document.getElementById('mcqInputArea');
        
        if (typingArea) typingArea.style.display = 'none';
        if (mcqArea) mcqArea.style.display = 'block';
        
        // Generate MCQ options
        this.generateMCQOptions();
        
        // Reset selection
        this.selectedMCQOption = null;
        
        // Enable MCQ options
        document.querySelectorAll('.mcq-option').forEach(option => {
            option.disabled = false;
            option.classList.remove('selected', 'correct', 'incorrect');
        });
    }

    generateMCQOptions() {
        const currentQuestion = this.questions[this.currentQuestionIndex];
        const correctAnswer = currentQuestion.answer;
        const options = [correctAnswer];
        
        // Generate 3 wrong options with safety checks
        let attempts = 0;
        const maxAttempts = 100; // Prevent infinite loop
        
        while (options.length < 4 && attempts < maxAttempts) {
            attempts++;
            
            let wrongAnswer;
            if (correctAnswer === 0) {
                // For zero, use small integers
                wrongAnswer = Math.floor(Math.random() * 10) - 5; // Range: -5 to 5
            } else {
                // For non-zero, use variation
                const variation = (Math.random() - 0.5) * Math.abs(correctAnswer) * 0.5; // ±25% variation
                wrongAnswer = Math.round(correctAnswer + variation);
            }
            
            // Avoid duplicates and ensure it's different from correct answer
            if (!options.includes(wrongAnswer) && Math.abs(wrongAnswer - correctAnswer) > 0.01) {
                options.push(wrongAnswer);
            }
        }
        
        // If we still don't have enough options, add some fallback values
        while (options.length < 4) {
            const fallback = correctAnswer + options.length;
            if (!options.includes(fallback)) {
                options.push(fallback);
            } else {
                options.push(correctAnswer + options.length + 1);
            }
        }
        
        // Shuffle options
        this.mcqOptions = this.shuffleArray(options);
        
        // Update UI
        const optionLabels = ['A', 'B', 'C', 'D'];
        document.querySelectorAll('.mcq-option').forEach((option, index) => {
            const valueSpan = option.querySelector('.option-value');
            valueSpan.textContent = this.mcqOptions[index];
            option.dataset.answer = this.mcqOptions[index];
        });
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    selectMCQOption(option) {
        // Remove previous selection
        document.querySelectorAll('.mcq-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selection to clicked option
        const selectedElement = document.querySelector(`[data-option="${option}"]`);
        selectedElement.classList.add('selected');
        this.selectedMCQOption = option;
        
        // Auto-submit after selection
        setTimeout(() => {
            this.submitMCQAnswer();
        }, 300);
    }

    submitMCQAnswer() {
        if (!this.selectedMCQOption) return;
        
        const selectedElement = document.querySelector(`[data-option="${this.selectedMCQOption}"]`);
        const userAnswer = parseFloat(selectedElement.dataset.answer);
        const currentQuestion = this.questions[this.currentQuestionIndex];
        const correct = Math.abs(userAnswer - currentQuestion.answer) < 0.01;
        
        // Accumulate time
        const now = Date.now();
        const duration = (now - this.questionStartTime) / 1000;
        this.totalTimeTaken += duration;
        
        if (correct) {
            this.correctCount++;
        }
        
        // Show correct/incorrect feedback on options
        document.querySelectorAll('.mcq-option').forEach(option => {
            const answer = parseFloat(option.dataset.answer);
            option.disabled = true;
            
            if (Math.abs(answer - currentQuestion.answer) < 0.01) {
                option.classList.add('correct');
            } else if (option.dataset.option === this.selectedMCQOption && !correct) {
                option.classList.add('incorrect');
            }
        });
        
        this.setState('FEEDBACK');
        this.showFeedback(correct, currentQuestion.answer);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.levelProgress = new LevelProgress();
});
