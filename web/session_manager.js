// Session Manager for tracking practice sessions
class SessionManager {
    constructor() {
        this.currentSession = null;
        this.sessionHistory = [];
        this.loadSessionHistory();
    }

    // Start a new practice session
    startSession(operation, digits, isAdaptive = false) {
        this.currentSession = {
            id: this.generateSessionId(),
            startTime: Date.now(),
            endTime: null,
            operation: operation,
            digits: digits,
            isAdaptive: isAdaptive,
            questionsAttempted: 0,
            questionsCorrect: 0,
            totalTime: 0,
            averageTime: 0,
            streak: 0,
            bestStreak: 0,
            weaknesses: [],
            improvements: [],
            sessionStatus: 'active', // active, completed, abandoned
            pauseCount: 0,
            totalPauseTime: 0,
            accuracy: 0,
            timePerQuestion: [],
            difficultyProgression: []
        };
        
        console.log('Session started:', this.currentSession.id);
        return this.currentSession;
    }

    // Record a question attempt in the current session
    recordAttempt(attempt) {
        if (!this.currentSession || this.currentSession.sessionStatus !== 'active') {
            console.warn('No active session to record attempt');
            return;
        }

        this.currentSession.questionsAttempted++;
        if (attempt.isCorrect) {
            this.currentSession.questionsCorrect++;
            this.currentSession.streak++;
            if (this.currentSession.streak > this.currentSession.bestStreak) {
                this.currentSession.bestStreak = this.currentSession.streak;
            }
        } else {
            this.currentSession.streak = 0;
        }

        // Record time per question
        if (attempt.timeTaken) {
            this.currentSession.timePerQuestion.push(attempt.timeTaken);
        }

        // Update accuracy
        this.currentSession.accuracy = (this.currentSession.questionsCorrect / this.currentSession.questionsAttempted) * 100;

        // Track weaknesses and improvements
        this.analyzePerformance(attempt);
    }

    // Record a pause event
    recordPause(pauseDuration) {
        if (!this.currentSession || this.currentSession.sessionStatus !== 'active') return;
        
        this.currentSession.pauseCount++;
        this.currentSession.totalPauseTime += pauseDuration;
    }

    // End the current session
    endSession(reason = 'completed') {
        if (!this.currentSession) {
            console.warn('No active session to end');
            return null;
        }

        this.currentSession.endTime = Date.now();
        this.currentSession.sessionStatus = reason;
        this.currentSession.totalTime = this.currentSession.endTime - this.currentSession.startTime - this.currentSession.totalPauseTime;
        
        // Calculate average time per question
        if (this.currentSession.timePerQuestion.length > 0) {
            this.currentSession.averageTime = this.currentSession.timePerQuestion.reduce((a, b) => a + b, 0) / this.currentSession.timePerQuestion.length;
        }

        // Generate session insights
        this.generateSessionInsights();

        // Add to history
        this.sessionHistory.push(this.currentSession);
        this.saveSessionHistory();

        const completedSession = this.currentSession;
        this.currentSession = null;

        console.log('Session ended:', completedSession.id, 'Status:', reason);
        return completedSession;
    }

    // Analyze performance to identify weaknesses and improvements
    analyzePerformance(attempt) {
        if (!attempt.isCorrect) {
            // Track weaknesses
            const weakness = {
                operation: attempt.operation,
                problem: attempt.problem,
                userAnswer: attempt.userAnswer,
                correctAnswer: attempt.correctAnswer,
                timeTaken: attempt.timeTaken,
                timestamp: attempt.timestamp
            };
            this.currentSession.weaknesses.push(weakness);
        } else {
            // Track improvements (correct answers that were previously weak)
            const improvement = {
                operation: attempt.operation,
                problem: attempt.problem,
                timeTaken: attempt.timeTaken,
                timestamp: attempt.timestamp
            };
            this.currentSession.improvements.push(improvement);
        }
    }

    // Generate insights for the session
    generateSessionInsights() {
        const session = this.currentSession;
        
        // Performance rating
        if (session.accuracy >= 90) {
            session.performanceRating = 'excellent';
        } else if (session.accuracy >= 75) {
            session.performanceRating = 'good';
        } else if (session.accuracy >= 60) {
            session.performanceRating = 'fair';
        } else {
            session.performanceRating = 'needs_improvement';
        }

        // Speed rating
        const avgTime = session.averageTime;
        if (avgTime <= 3) {
            session.speedRating = 'very_fast';
        } else if (avgTime <= 5) {
            session.speedRating = 'fast';
        } else if (avgTime <= 8) {
            session.speedRating = 'normal';
        } else {
            session.speedRating = 'slow';
        }

        // Consistency rating (based on time variance)
        if (session.timePerQuestion.length > 2) {
            const variance = this.calculateVariance(session.timePerQuestion);
            if (variance <= 2) {
                session.consistencyRating = 'very_consistent';
            } else if (variance <= 5) {
                session.consistencyRating = 'consistent';
            } else {
                session.consistencyRating = 'inconsistent';
            }
        }
    }

    // Calculate variance for consistency analysis
    calculateVariance(numbers) {
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
    }

    // Get session summary for display
    getSessionSummary(session = null) {
        const s = session || this.currentSession;
        if (!s) return null;

        return {
            id: s.id,
            duration: this.formatDuration(s.totalTime || (Date.now() - s.startTime)),
            accuracy: Math.round(s.accuracy || 0),
            questionsAttempted: s.questionsAttempted,
            questionsCorrect: s.questionsCorrect,
            averageTime: (s.averageTime || 0).toFixed(1),
            bestStreak: s.bestStreak,
            performanceRating: s.performanceRating || 'unknown',
            speedRating: s.speedRating || 'unknown',
            consistencyRating: s.consistencyRating || 'unknown',
            weaknessesCount: s.weaknesses.length,
            improvementsCount: s.improvements.length,
            operation: s.operation,
            digits: s.digits
        };
    }

    // Get session history
    getSessionHistory(limit = 10) {
        return this.sessionHistory
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, limit)
            .map(session => this.getSessionSummary(session));
    }

    // Get overall session statistics
    getOverallSessionStats() {
        if (this.sessionHistory.length === 0) {
            return {
                totalSessions: 0,
                totalPracticeTime: 0,
                averageAccuracy: 0,
                averageSessionLength: 0,
                mostPracticedOperation: 'none',
                improvementTrend: 'stable'
            };
        }

        const completedSessions = this.sessionHistory.filter(s => s.sessionStatus === 'completed');
        const totalPracticeTime = completedSessions.reduce((sum, s) => sum + s.totalTime, 0);
        const averageAccuracy = completedSessions.reduce((sum, s) => sum + s.accuracy, 0) / completedSessions.length;
        const averageSessionLength = totalPracticeTime / completedSessions.length;

        // Find most practiced operation
        const operationCounts = {};
        completedSessions.forEach(s => {
            operationCounts[s.operation] = (operationCounts[s.operation] || 0) + 1;
        });
        const mostPracticedOperation = Object.keys(operationCounts).reduce((a, b) => 
            operationCounts[a] > operationCounts[b] ? a : b, 'none');

        // Calculate improvement trend (last 5 sessions vs previous 5)
        const recentSessions = completedSessions.slice(0, 5);
        const previousSessions = completedSessions.slice(5, 10);
        let improvementTrend = 'stable';
        
        if (recentSessions.length >= 3 && previousSessions.length >= 3) {
            const recentAvg = recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length;
            const previousAvg = previousSessions.reduce((sum, s) => sum + s.accuracy, 0) / previousSessions.length;
            
            if (recentAvg > previousAvg + 5) improvementTrend = 'improving';
            else if (recentAvg < previousAvg - 5) improvementTrend = 'declining';
        }

        return {
            totalSessions: completedSessions.length,
            totalPracticeTime: totalPracticeTime,
            averageAccuracy: Math.round(averageAccuracy),
            averageSessionLength: Math.round(averageSessionLength),
            mostPracticedOperation: mostPracticedOperation,
            improvementTrend: improvementTrend
        };
    }

    // Generate unique session ID
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Format duration for display
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${remainingSeconds}s`;
        }
    }

    // Save session history to localStorage and backend
    saveSessionHistory() {
        try {
            localStorage.setItem('mathDrillSessionHistory', JSON.stringify(this.sessionHistory));
            
            // Also save to backend if available
            if (typeof pybridge !== 'undefined' && pybridge) {
                this.sessionHistory.forEach(session => {
                    const message = JSON.stringify({
                        type: 'save_session',
                        payload: session
                    });
                    pybridge.sendMessage(message);
                });
            }
        } catch (e) {
            console.error('Error saving session history:', e);
        }
    }

    // Load session history from localStorage and backend
    loadSessionHistory() {
        try {
            // First try to load from backend
            if (typeof pybridge !== 'undefined' && pybridge) {
                const message = JSON.stringify({
                    type: 'load_sessions',
                    payload: {}
                });
                pybridge.sendMessage(message);
            }
            
            // Fallback to localStorage
            const saved = localStorage.getItem('mathDrillSessionHistory');
            if (saved) {
                this.sessionHistory = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading session history:', e);
            this.sessionHistory = [];
        }
    }

    // Clear session history
    clearSessionHistory() {
        this.sessionHistory = [];
        this.currentSession = null;
        localStorage.removeItem('mathDrillSessionHistory');
    }

    // Export session data
    exportSessionData() {
        return {
            currentSession: this.currentSession,
            sessionHistory: this.sessionHistory,
            overallStats: this.getOverallSessionStats(),
            exportDate: new Date().toISOString()
        };
    }
}

// Global instance
window.sessionManager = new SessionManager();

// Handle backend session responses
window.handleSessionResponse = function(message) {
    try {
        const data = JSON.parse(message);
        if (data.type === 'load_sessions_response' && window.sessionManager) {
            if (data.payload.sessions && data.payload.sessions.length > 0) {
                window.sessionManager.sessionHistory = data.payload.sessions;
            }
        }
    } catch (e) {
        console.error('Session response error:', e);
    }
};
