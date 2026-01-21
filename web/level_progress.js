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
            const data = JSON.parse(responseStr);
            const type = data.type;
            const payload = data.payload;

            if (type === 'get_level_response') {
                this.startLevel(payload);
            } else if (type === 'complete_level_response') {
                this.showCompletionModal(payload);
            } else if (type === 'error') {
                console.error('Backend Error:', payload.message);
                alert('Error: ' + payload.message); // Simple fallback
            }
        } catch (e) {
            console.error('Response parse error:', e);
        }
    }

    sendToPython(msg) {
        if (this.bridge) {
            this.bridge.sendMessage(JSON.stringify(msg));
        }
    }

    // --- Game Logic ---

    startLevel(data) {
        this.levelData = data;
        this.questions = this.generateQuestions(data);
        this.currentQuestionIndex = 0;
        this.correctCount = 0;
        this.totalTimeTaken = 0;

        this.updateHeaderUI();
        this.setState('PLAYING');
        this.loadQuestion(0);

        this.levelStartTime = Date.now();
        // If level has a total time limit, we could track it here
        if (this.levelData.requirements.timeLimit) {
            this.startLevelTimer(this.levelData.requirements.timeLimit);
        }
    }

    generateQuestions(level) {
        // Generate robust questions based on ops
        const count = level.requirements.totalQuestions;
        const qs = [];
        for (let i = 0; i < count; i++) {
            qs.push(this.createQuestion(level.operation, level.digits));
        }
        return qs;
    }

    createQuestion(op, digits) {
        const max = Math.pow(10, digits);
        const min = Math.pow(10, digits - 1);

        // Helper
        const rand = (min, max) => Math.floor(Math.random() * (max - min)) + min;

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
    }

    createComplexQuestion(digits) {
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

        // UI
        this.setText('questionPrompt', q.prompt);
        this.setValue('answerInput', '');
        this.setText('progressText', `${index + 1}/${this.questions.length}`);

        const feedback = document.getElementById('feedbackArea');
        if (feedback) feedback.style.display = 'none';

        const input = document.getElementById('answerInput');
        if (input) {
            input.disabled = false;
            input.focus();
        }
        document.getElementById('submitButton').disabled = false;

        this.updateProgressBar();
    }

    submitAnswer() {
        if (this.state !== 'PLAYING') return;

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
        const msg = document.getElementById('feedbackMessage');

        if (area && msg) {
            area.style.display = 'flex';
            msg.innerHTML = isCorrect
                ? '<span class="success">✓ Correct</span>'
                : `<span class="error">✗ Incorrect<br><small>Answer: ${correctAnswer}</small></span>`;
        }

        // Lock input
        document.getElementById('answerInput').disabled = true;
        document.getElementById('submitButton').disabled = true;

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
            title.textContent = result.success ? 'Level Complete!' : 'Level Failed';
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
}

document.addEventListener('DOMContentLoaded', () => {
    window.levelProgress = new LevelProgress();
});
