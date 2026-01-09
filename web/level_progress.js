class LevelProgress {
    constructor() {
        this.levelId = null;
        this.currentLevel = null;
        this.currentQuestion = 0;
        this.correctAnswers = 0;
        this.questions = [];
        this.startTime = null;
        this.questionStartTime = null;
        this.totalQuestionTime = 0;
        this.timerInterval = null;
        this.levelTimerInterval = null;
        this.levelTimeRemaining = null;
        this.maxStars = 3;
        this.estimatedStars = 1;

        this.initializeEventListeners();
        this.setupBridge();
        this.loadLevel();
    }

    setupBridge() {
        // Don't block on bridge setup, it might not be ready yet
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
            
            if (data.type === 'get_level_response') {
                this.currentLevel = data.payload;
                console.log('✓ Loaded level:', this.currentLevel.name);
                this.initializeLevelUI();
                this.generateQuestions();
                this.startLevel();
            } else if (data.type === 'complete_level_response') {
                const result = data.payload;
                if (result.success) {
                    console.log('✓ Level completed with', result.starsEarned, 'stars');
                    this.showCompletionModal(result);
                }
            } else if (data.type === 'error') {
                console.error('Error from Python:', data.payload.message);
                document.getElementById('levelTitle').textContent = 'Error: ' + data.payload.message;
            } else {
                console.warn('Unknown response type:', data.type);
            }
        } catch (e) {
            console.error('Error parsing Python response:', e, response);
        }
    }

    initializeEventListeners() {
        document.getElementById('backButton').addEventListener('click', () => this.goBackToLevels());
        document.getElementById('answerInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitAnswer();
        });
        document.getElementById('submitButton').addEventListener('click', () => this.submitAnswer());
        document.getElementById('nextButton').addEventListener('click', () => this.nextQuestion());
        document.getElementById('nextLevelBtn').addEventListener('click', () => this.goToNextLevel());
        document.getElementById('retryLevelBtn').addEventListener('click', () => this.retryLevel());
        document.getElementById('backToLevelsBtn').addEventListener('click', () => this.goBackToLevels());
    }

    loadLevel() {
        // Get level ID from URL parameter
        const params = new URLSearchParams(window.location.search);
        this.levelId = parseInt(params.get('levelId')) || 1;

        console.log('Loading level:', this.levelId);

        // Retry until bridge is ready
        const attemptLoad = () => {
            if (!window.pybridge) {
                console.warn('⏳ Bridge not ready, retrying...');
                setTimeout(attemptLoad, 100);
                return;
            }

            console.log('🚀 Sending get_level message for level', this.levelId);
            const message = {
                type: 'get_level',
                payload: { levelId: this.levelId }
            };

            try {
                window.pybridge.sendMessage(JSON.stringify(message));
                console.log('📤 Level load request sent');
            } catch (e) {
                console.error('❌ Error:', e);
            }
        };

        // Start trying after a small delay
        setTimeout(attemptLoad, 50);
    }

    initializeLevelUI() {
        if (!this.currentLevel) return;

        document.getElementById('levelTitle').textContent = this.currentLevel.name;
        document.getElementById('levelDescription').textContent = this.currentLevel.description_long || this.currentLevel.description;

        // Show timer if time-based level
        const timeLimit = this.currentLevel.requirements.timeLimit;
        if (timeLimit) {
            document.getElementById('timerStatDiv').style.display = 'flex';
            this.levelTimeRemaining = timeLimit;
            this.updateTimerDisplay();
        }
    }

    generateQuestions() {
        if (!this.currentLevel) return;

        const total = this.currentLevel.requirements.totalQuestions;
        const operation = this.currentLevel.operation;
        const digits = this.currentLevel.digits;

        this.questions = [];

        for (let i = 0; i < total; i++) {
            const question = this.generateSingleQuestion(operation, digits);
            this.questions.push(question);
        }

        this.currentQuestion = 0;
    }

    generateSingleQuestion(operation, digits) {
        const max = Math.pow(10, digits);
        const min = Math.pow(10, digits - 1);

        if (operation === 'addition') {
            const a = Math.floor(Math.random() * (max - min)) + min;
            const b = Math.floor(Math.random() * (max - min)) + min;
            return {
                prompt: `${a} + ${b} = ?`,
                answer: a + b,
                operation: 'addition'
            };
        } else if (operation === 'subtraction') {
            const a = Math.floor(Math.random() * (max - min)) + min;
            const b = Math.floor(Math.random() * (max - min)) + min;
            return {
                prompt: `${Math.max(a, b)} - ${Math.min(a, b)} = ?`,
                answer: Math.max(a, b) - Math.min(a, b),
                operation: 'subtraction'
            };
        } else if (operation === 'multiplication') {
            const a = Math.floor(Math.random() * (Math.pow(10, Math.ceil(digits / 2)) - 1)) + 2;
            const b = Math.floor(Math.random() * (Math.pow(10, Math.ceil(digits / 2)) - 1)) + 2;
            return {
                prompt: `${a} × ${b} = ?`,
                answer: a * b,
                operation: 'multiplication'
            };
        } else if (operation === 'division') {
            const divisor = Math.floor(Math.random() * (Math.pow(10, Math.ceil(digits / 2)) - 2)) + 2;
            const quotient = Math.floor(Math.random() * (max - min)) + min;
            const dividend = divisor * quotient;
            return {
                prompt: `${dividend} ÷ ${divisor} = ?`,
                answer: quotient,
                operation: 'division'
            };
        } else if (operation === 'complex') {
            return this.generateComplexQuestion(digits);
        }

        return { prompt: '0 + 0 = ?', answer: 0, operation: 'addition' };
    }

    generateComplexQuestion(digits) {
        const patterns = [
            () => {
                const a = Math.floor(Math.random() * 100) + 10;
                const b = Math.floor(Math.random() * 100) + 10;
                const c = Math.floor(Math.random() * 10) + 1;
                return {
                    prompt: `(${a} + ${b}) × ${c} = ?`,
                    answer: (a + b) * c
                };
            },
            () => {
                const a = Math.floor(Math.random() * 100) + 50;
                const b = Math.floor(Math.random() * 50) + 10;
                const c = Math.floor(Math.random() * 5) + 2;
                return {
                    prompt: `(${a} - ${b}) ÷ ${c} = ?`,
                    answer: Math.floor((a - b) / c)
                };
            },
            () => {
                const a = Math.floor(Math.random() * 20) + 2;
                const b = Math.floor(Math.random() * 20) + 2;
                const c = Math.floor(Math.random() * 10) + 1;
                return {
                    prompt: `${a} × ${b} + ${c} = ?`,
                    answer: (a * b) + c
                };
            },
            () => {
                const a = Math.floor(Math.random() * 200) + 100;
                const b = Math.floor(Math.random() * 50) + 20;
                const c = Math.floor(Math.random() * 10) + 2;
                return {
                    prompt: `${a} ÷ ${c} + ${b} = ?`,
                    answer: Math.floor(a / c) + b
                };
            },
            () => {
                const a = Math.floor(Math.random() * 30) + 10;
                const b = Math.floor(Math.random() * 30) + 10;
                const c = Math.floor(Math.random() * 30) + 10;
                return {
                    prompt: `${a} + ${b} + ${c} = ?`,
                    answer: a + b + c
                };
            },
            () => {
                const a = Math.floor(Math.random() * 50) + 50;
                const b = Math.floor(Math.random() * 30) + 10;
                const c = Math.floor(Math.random() * 30) + 10;
                return {
                    prompt: `${a} - ${b} + ${c} = ?`,
                    answer: a - b + c
                };
            },
            () => {
                const a = Math.floor(Math.random() * 15) + 2;
                const b = Math.floor(Math.random() * 15) + 2;
                const c = Math.floor(Math.random() * 10) + 1;
                return {
                    prompt: `${a} × ${b} - ${c} = ?`,
                    answer: (a * b) - c
                };
            },
            () => {
                const a = Math.floor(Math.random() * 200) + 100;
                const b = Math.floor(Math.random() * 50) + 50;
                const c = Math.floor(Math.random() * 5) + 2;
                return {
                    prompt: `(${a} + ${b}) ÷ ${c} = ?`,
                    answer: Math.floor((a + b) / c)
                };
            }
        ];

        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        const q = pattern();
        return {
            ...q,
            operation: 'complex'
        };
    }

    startLevel() {
        this.startTime = Date.now();
        this.displayQuestion();

        // Start level timer if time-based
        if (this.levelTimeRemaining !== null) {
            this.levelTimerInterval = setInterval(() => this.updateLevelTimer(), 1000);
        }
    }

    displayQuestion() {
        if (this.currentQuestion >= this.questions.length) {
            this.completeLevel();
            return;
        }

        const question = this.questions[this.currentQuestion];
        this.questionStartTime = Date.now();

        document.getElementById('questionPrompt').textContent = question.prompt;
        document.getElementById('answerInput').value = '';
        document.getElementById('answerInput').focus();

        // Hide feedback, show input
        document.getElementById('feedbackArea').style.display = 'none';
        document.getElementById('answerInput').disabled = false;
        document.getElementById('submitButton').disabled = false;

        this.updateProgressBar();
    }

    submitAnswer() {
        const answerInput = document.getElementById('answerInput');
        const answer = parseInt(answerInput.value);

        if (isNaN(answer)) {
            answerInput.focus();
            return;
        }

        const question = this.questions[this.currentQuestion];
        const isCorrect = answer === question.answer;

        // Track time for this question (not including future auto-advance delay)
        const questionTime = (Date.now() - this.questionStartTime) / 1000;
        this.totalQuestionTime += questionTime;

        if (isCorrect) {
            this.correctAnswers++;
            this.updateStarsEstimate();
        }

        // Show feedback
        this.showFeedback(isCorrect);

        // Disable input
        answerInput.disabled = true;
        document.getElementById('submitButton').disabled = true;

        // Auto-advance after delay
        const delay = isCorrect ? 1500 : 2000;
        let remaining = delay / 1000;

        this.timerInterval = setInterval(() => {
            remaining -= 0.1;
            if (remaining <= 0) {
                clearInterval(this.timerInterval);
                this.nextQuestion();
            }
        }, 100);
    }

    showFeedback(isCorrect) {
        const feedbackArea = document.getElementById('feedbackArea');
        const feedbackMessage = document.getElementById('feedbackMessage');

        if (isCorrect) {
            feedbackMessage.innerHTML = '<span style="color: var(--success-color);">✓ Correct!</span>';
        } else {
            const question = this.questions[this.currentQuestion];
            feedbackMessage.innerHTML = `<span style="color: var(--danger-color);">✗ Wrong! Answer: ${question.answer}</span>`;
        }

        feedbackArea.style.display = 'block';
    }

    nextQuestion() {
        clearInterval(this.timerInterval);
        this.currentQuestion++;
        this.displayQuestion();
    }

    updateProgressBar() {
        const progress = (this.currentQuestion / this.questions.length) * 100;
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressText').textContent = `${this.currentQuestion}/${this.questions.length}`;

        // Update accuracy
        const accuracy = this.questions.length > 0 
            ? Math.round((this.correctAnswers / (this.currentQuestion + 1)) * 100) 
            : 0;
        document.getElementById('accuracyText').textContent = accuracy + '%';
    }

    updateStarsEstimate() {
        const accuracy = (this.correctAnswers / (this.currentQuestion + 1)) * 100;

        if (accuracy >= 95) {
            this.estimatedStars = 3;
        } else if (accuracy >= 85) {
            this.estimatedStars = 2;
        } else {
            this.estimatedStars = 1;
        }

        this.updateStarsDisplay(this.estimatedStars, true);
    }

    updateStarsDisplay(stars, isEstimate = false) {
        const starsDisplay = document.getElementById('starsDisplay');
        starsDisplay.innerHTML = '';

        for (let i = 0; i < 3; i++) {
            const star = document.createElement('span');
            star.className = i < stars ? 'star filled' : 'star empty';
            star.textContent = i < stars ? '★' : '☆';
            starsDisplay.appendChild(star);
        }
    }

    updateLevelTimer() {
        this.levelTimeRemaining--;

        if (this.levelTimeRemaining <= 0) {
            clearInterval(this.levelTimerInterval);
            this.completeLevel();
            return;
        }

        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        if (this.levelTimeRemaining === null) return;

        const minutes = Math.floor(this.levelTimeRemaining / 60);
        const seconds = this.levelTimeRemaining % 60;
        document.getElementById('timerText').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    completeLevel() {
        clearInterval(this.levelTimerInterval);
        clearInterval(this.timerInterval);

        if (!window.pybridge) {
            console.error('Bridge not available');
            return;
        }

        const message = {
            type: 'complete_level',
            payload: {
                levelId: this.levelId,
                correctAnswers: this.correctAnswers,
                totalQuestions: this.questions.length,
                timeTaken: this.totalQuestionTime
            }
        };

        try {
            window.pybridge.sendMessage(JSON.stringify(message));
        } catch (e) {
            console.error('Error sending completion:', e);
        }
    }

    showCompletionModal(result) {
        const accuracy = result.accuracy || 0;
        const starsEarned = result.starsEarned || 1;
        const timeTaken = Math.round(result.timeTaken || 0);

        // Update modal content
        document.getElementById('finalAccuracy').textContent = Math.round(accuracy) + '%';
        document.getElementById('finalTime').textContent = timeTaken + 's';

        // Display earned stars
        const earnedStarsDiv = document.getElementById('earnedStars');
        earnedStarsDiv.innerHTML = '';
        for (let i = 0; i < starsEarned; i++) {
            const star = document.createElement('span');
            star.className = 'star-lg';
            star.textContent = '★';
            earnedStarsDiv.appendChild(star);
        }

        // Update completion text
        let message = 'Great job!';
        if (starsEarned === 3) {
            message = 'Perfect! You earned 3 stars!';
        } else if (starsEarned === 2) {
            message = 'Excellent! You earned 2 stars!';
        } else if (starsEarned === 1) {
            message = 'Good effort! You earned 1 star!';
        }
        document.getElementById('completionText').textContent = message;

        // Show/hide next level button
        const nextLevelBtn = document.getElementById('nextLevelBtn');
        if (result.nextLevelId) {
            nextLevelBtn.style.display = 'inline-block';
        } else {
            nextLevelBtn.style.display = 'none';
        }

        // Show modal
        document.getElementById('modalOverlay').style.display = 'block';
        document.getElementById('completionModal').style.display = 'block';
    }

    goToNextLevel() {
        const nextLevelId = this.currentLevel.rewards.unlocksLevel;
        if (nextLevelId) {
            window.location.href = `level_progress.html?levelId=${nextLevelId}`;
        }
    }

    retryLevel() {
        window.location.href = `level_progress.html?levelId=${this.levelId}`;
    }

    goBackToLevels() {
        window.location.href = 'levels.html';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.levelProgress = new LevelProgress();
});
