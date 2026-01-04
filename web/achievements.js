class AchievementsPage {
    constructor() {
        // Don't initialize immediately - wait for bridge
        this.initialized = false;
        this.achievements = [];
        this.stats = {};
        
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
        
        // Timeout after 1 second instead of 5 seconds for faster fallback
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.pythonBridge && !this.initialized) {
                console.warn('Bridge not available, initializing AchievementsPage in standalone mode');
                this.initialize();
            }
        }, 1000); // Reduced from 5000ms to 1000ms
    }
    
    initialize() {
        if (this.initialized) return;
        this.initialized = true;
        
        console.log('🏆 Initializing AchievementsPage...');
        
        this.initElements();
        this.loadAchievements();
    }

    initElements() {
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.achievementsList = document.getElementById('achievementsList');
    }

    async loadAchievements() {
        console.log('🔄 Loading achievements...');
        this.showLoading(true);
        
        try {
            // Check if Python bridge is available
            if (!window.pythonBridge) {
                console.log('⚡ Python bridge not available, loading achievements from JSON');
                await this.loadAchievementsFromJSON();
                this.showLoading(false);
                return;
            }
            
            console.log('🔗 Python bridge available, requesting achievements...');
            
            // Request achievements from Python
            const achievements = await this.sendToPythonAsync('get_achievements', {});
            
            if (achievements && achievements.length > 0) {
                console.log('✅ Received achievements from Python:', achievements);
                this.achievements = achievements;
                this.renderAchievements();
            } else {
                console.log('⚠️ No achievements received, loading from JSON');
                await this.loadAchievementsFromJSON();
            }
            
        } catch (error) {
            console.error('❌ Error loading achievements:', error);
            console.log('🔄 Loading achievements from JSON as fallback...');
            await this.loadAchievementsFromJSON();
        }
        
        this.showLoading(false);
    }

    async loadAchievementsFromJSON() {
        try {
            console.log('📁 Loading achievements from JSON file...');
            const startTime = performance.now();
            
            // Load both files in PARALLEL instead of sequentially
            const [achievementsResponse, attemptsResponse] = await Promise.all([
                fetch('../data/achievements.json'),
                fetch('../data/attempts.json')
            ]);
            
            // Check responses
            if (!achievementsResponse.ok) {
                throw new Error(`Achievements JSON: HTTP ${achievementsResponse.status}`);
            }
            
            const unlockedAchievements = await achievementsResponse.json();
            console.log(`✅ Loaded ${unlockedAchievements.length} unlocked achievements`);
            
            const attempts = attemptsResponse.ok ? await attemptsResponse.json() : [];
            console.log(`✅ Loaded ${attempts.length} attempts`);
            
            // Calculate stats from attempts (optimized single-pass)
            const stats = this.calculateStatsFromAttempts(attempts);
            console.log('📊 Calculated stats:', stats);
            
            // Get all possible achievements
            const allAchievements = this.getAllAchievementDefinitions();
            
            // Merge unlocked achievements with definitions
            this.achievements = allAchievements.map(achievement => {
                const unlocked = unlockedAchievements.find(ua => ua.code === achievement.id);
                return {
                    ...achievement,
                    unlocked: !!unlocked,
                    unlockedAt: unlocked?.unlocked_at || null,
                    progress: this.calculateProgress(achievement, stats)
                };
            });
            
            const loadTime = performance.now() - startTime;
            console.log(`⚡ Achievements loaded in ${loadTime.toFixed(2)}ms`);
            
            this.renderAchievements();
            
        } catch (error) {
            console.error('❌ Error loading achievements from JSON:', error);
            this.showError('Unable to load achievements. Please try again later.');
        }
    }

    calculateStatsFromAttempts(attempts) {
        const totalAttempts = attempts.length;
        
        // Early return for empty data
        if (totalAttempts === 0) {
            return {
                lifetimeCount: 0,
                accuracy: 0,
                bestSpeed: 0,
                maxStreak: 0,
                uniqueDays: 0,
                operationStats: {}
            };
        }
        
        // Single-pass optimization - calculate everything in one loop
        let totalCorrect = 0;
        let totalSumTime = 0;
        let maxStreak = 0;
        let currentStreak = 0;
        let bestSpeed = Infinity;
        const uniqueDays = new Set();
        const operationStats = new Map();
        
        attempts.forEach(attempt => {
            const { correct, time_taken = 0, operation, created, timestamp } = attempt;
            
            // Basic stats
            if (correct) {
                totalCorrect++;
                totalSumTime += time_taken;
                if (time_taken > 0 && time_taken < bestSpeed) {
                    bestSpeed = time_taken;
                }
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
            
            // Unique days
            const date = created || timestamp?.split('T')[0];
            if (date) uniqueDays.add(date);
            
            // Operation stats (using Map for better performance)
            if (operation) {
                if (!operationStats.has(operation)) {
                    operationStats.set(operation, { count: 0, correct: 0 });
                }
                const opStats = operationStats.get(operation);
                opStats.count++;
                if (correct) opStats.correct++;
            }
        });
        
        const accuracy = (totalCorrect / totalAttempts) * 100;
        
        // Convert Map back to object for compatibility
        const operationStatsObj = {};
        operationStats.forEach((value, key) => {
            operationStatsObj[key] = value;
        });
        
        return {
            lifetimeCount: totalAttempts,
            accuracy,
            bestSpeed: bestSpeed === Infinity ? 0 : bestSpeed,
            maxStreak,
            uniqueDays: uniqueDays.size,
            operationStats: operationStatsObj
        };
    }

    getAllAchievementDefinitions() {
        return [
            {
                id: 'first_win',
                title: 'First Steps',
                description: 'Complete your first session',
                icon: '🌱',
                category: 'basic',
                condition: (stats) => stats.lifetimeCount >= 1
            },
            {
                id: 'novice',
                title: 'Novice',
                description: 'Complete 10 questions total',
                icon: '📚',
                category: 'basic',
                condition: (stats) => stats.lifetimeCount >= 10
            },
            {
                id: 'apprentice',
                title: 'Apprentice',
                description: 'Complete 25 questions total',
                icon: '🎓',
                category: 'basic',
                condition: (stats) => stats.lifetimeCount >= 25
            },
            {
                id: 'centurion',
                title: 'Centurion',
                description: 'Complete 100 questions total',
                icon: '💯',
                category: 'basic',
                condition: (stats) => stats.lifetimeCount >= 100
            },
            {
                id: 'veteran',
                title: 'Veteran',
                description: 'Complete 500 questions total',
                icon: '🎖️',
                category: 'basic',
                condition: (stats) => stats.lifetimeCount >= 500
            },
            {
                id: 'legend',
                title: 'Legend',
                description: 'Complete 1000 questions total',
                icon: '👑',
                category: 'basic',
                condition: (stats) => stats.lifetimeCount >= 1000
            },
            {
                id: 'streak_5',
                title: 'On Fire',
                description: 'Achieve a 5-question streak',
                icon: '🔥',
                category: 'streak',
                condition: (stats) => stats.maxStreak >= 5
            },
            {
                id: 'streak_10',
                title: 'Blazing',
                description: 'Achieve a 10-question streak',
                icon: '💥',
                category: 'streak',
                condition: (stats) => stats.maxStreak >= 10
            },
            {
                id: 'streak_25',
                title: 'Inferno',
                description: 'Achieve a 25-question streak',
                icon: '🌋',
                category: 'streak',
                condition: (stats) => stats.maxStreak >= 25
            },
            {
                id: 'accuracy_master',
                title: 'Precision',
                description: 'Maintain 90% accuracy over 50 questions',
                icon: '🎯',
                category: 'accuracy',
                condition: (stats) => stats.lifetimeCount >= 50 && stats.accuracy >= 90
            },
            {
                id: 'speed_demon',
                title: 'Speed Demon',
                description: 'Answer a question in under 2 seconds',
                icon: '⚡',
                category: 'speed',
                condition: (stats) => stats.bestSpeed <= 2.0 && stats.bestSpeed > 0
            },
            {
                id: 'daily_player',
                title: 'Daily Player',
                description: 'Play on 3 different days',
                icon: '📅',
                category: 'consistency',
                condition: (stats) => stats.uniqueDays >= 3
            },
            {
                id: 'weekly_warrior',
                title: 'Weekly Warrior',
                description: 'Play on 7 different days',
                icon: '📆',
                category: 'consistency',
                condition: (stats) => stats.uniqueDays >= 7
            },
            {
                id: 'addition_master',
                title: 'Addition Master',
                description: 'Complete 50 addition questions with 90%+ accuracy',
                icon: '➕',
                category: 'operation',
                condition: (stats) => {
                    const addStats = stats.operationStats['Addition'] || { count: 0, correct: 0 };
                    return addStats.count >= 50 && (addStats.correct / addStats.count) * 100 >= 90;
                }
            },
            {
                id: 'subtraction_master',
                title: 'Subtraction Master',
                description: 'Complete 50 subtraction questions with 90%+ accuracy',
                icon: '➖',
                category: 'operation',
                condition: (stats) => {
                    const subStats = stats.operationStats['Subtraction'] || { count: 0, correct: 0 };
                    return subStats.count >= 50 && (subStats.correct / subStats.count) * 100 >= 90;
                }
            }
        ];
    }

    calculateProgress(achievement, stats) {
        if (achievement.unlocked) return 100;
        
        // Calculate progress percentage for locked achievements
        const condition = achievement.condition;
        
        if (achievement.id === 'novice') return Math.min(100, (stats.lifetimeCount / 10) * 100);
        if (achievement.id === 'apprentice') return Math.min(100, (stats.lifetimeCount / 25) * 100);
        if (achievement.id === 'centurion') return Math.min(100, (stats.lifetimeCount / 100) * 100);
        if (achievement.id === 'veteran') return Math.min(100, (stats.lifetimeCount / 500) * 100);
        if (achievement.id === 'legend') return Math.min(100, (stats.lifetimeCount / 1000) * 100);
        
        if (achievement.id === 'streak_5') return Math.min(100, (stats.maxStreak / 5) * 100);
        if (achievement.id === 'streak_10') return Math.min(100, (stats.maxStreak / 10) * 100);
        if (achievement.id === 'streak_25') return Math.min(100, (stats.maxStreak / 25) * 100);
        
        if (achievement.id === 'accuracy_master') {
            if (stats.lifetimeCount < 50) return (stats.lifetimeCount / 50) * 50;
            return Math.min(100, (stats.accuracy / 90) * 50 + 50);
        }
        
        if (achievement.id === 'daily_player') return Math.min(100, (stats.uniqueDays / 3) * 100);
        if (achievement.id === 'weekly_warrior') return Math.min(100, (stats.uniqueDays / 7) * 100);
        
        return 0; // No progress calculable
    }

    renderAchievements() {
        if (!this.achievementsList) return;
        
        console.log('🎨 Rendering achievements...');
        const renderStart = performance.now();
        
        // Use requestAnimationFrame for smoother rendering
        requestAnimationFrame(() => {
            // Group achievements by category
            const categories = {
                basic: { name: 'Basic Progress', achievements: [] },
                streak: { name: 'Streaks', achievements: [] },
                accuracy: { name: 'Accuracy', achievements: [] },
                speed: { name: 'Speed', achievements: [] },
                consistency: { name: 'Consistency', achievements: [] },
                operation: { name: 'Operations', achievements: [] }
            };
            
            this.achievements.forEach(achievement => {
                const category = categories[achievement.category] || categories.basic;
                category.achievements.push(achievement);
            });
            
            // Clear and render categories
            this.achievementsList.innerHTML = '';
            
            // Batch DOM updates for better performance
            const categoryFragments = document.createDocumentFragment();
            
            Object.entries(categories).forEach(([categoryKey, category]) => {
                if (category.achievements.length === 0) return;
                
                const categorySection = document.createElement('div');
                categorySection.className = 'achievement-category';
                
                // Create category HTML
                const achievementCards = category.achievements.map(achievement => 
                    this.renderAchievementCard(achievement)
                ).join('');
                
                categorySection.innerHTML = `
                    <h3 class="category-title">${category.name}</h3>
                    <div class="achievements-grid">
                        ${achievementCards}
                    </div>
                `;
                
                categoryFragments.appendChild(categorySection);
            });
            
            // Single DOM append operation
            this.achievementsList.appendChild(categoryFragments);
            
            const renderTime = performance.now() - renderStart;
            console.log(`✅ Rendered ${this.achievements.length} achievements in ${renderTime.toFixed(2)}ms`);
        });
    }

    renderAchievementCard(achievement) {
        const progress = achievement.progress || 0;
        const isUnlocked = achievement.unlocked;
        
        return `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">
                    ${achievement.icon}
                </div>
                <div class="achievement-info">
                    <h4>${achievement.title}</h4>
                    <p>${achievement.description}</p>
                    ${!isUnlocked && progress > 0 ? `
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <span class="progress-text">${Math.round(progress)}%</span>
                    ` : ''}
                </div>
                <div class="achievement-status">
                    ${isUnlocked ? '✅' : '🔒'}
                </div>
            </div>
        `;
    }

    showLoading(show) {
        if (this.loadingSpinner) {
            this.loadingSpinner.style.display = show ? 'block' : 'none';
        }
    }

    showError(message) {
        if (this.achievementsList) {
            this.achievementsList.innerHTML = `
                <div class="error-message">
                    <p>❌ ${message}</p>
                </div>
            `;
        }
    }

    sendToPythonAsync(action, data) {
        return new Promise((resolve, reject) => {
            if (window.pythonBridge) {
                const callbackId = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                if (!window.pythonBridge.callbacks) {
                    window.pythonBridge.callbacks = {};
                }
                
                // Set up timeout
                const timeout = setTimeout(() => {
                    delete window.pythonBridge.callbacks[callbackId];
                    reject(new Error('Python bridge timeout'));
                }, 3000);
                
                // The Python bridge will call this callback directly
                window.pythonBridge.callbacks[callbackId] = (result) => {
                    clearTimeout(timeout);
                    console.log('Received callback result:', result);
                    resolve(result);
                };
                
                try {
                    console.log('Sending to Python bridge:', action, data, callbackId);
                    window.pythonBridge.send(action, JSON.stringify(data), callbackId);
                } catch (error) {
                    clearTimeout(timeout);
                    delete window.pythonBridge.callbacks[callbackId];
                    reject(error);
                }
            } else {
                reject(new Error('Python bridge not available'));
            }
        });
    }
}

// Initialize the achievements page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏆 DOM ready, initializing AchievementsPage...');
    window.achievementsPage = new AchievementsPage();
});