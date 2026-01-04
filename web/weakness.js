class WeaknessPage {
    constructor() {
        this.initialized = false;
        this.weaknessData = {};
        
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
        
        // Timeout after 1 second for faster fallback
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.pythonBridge && !this.initialized) {
                console.warn('Bridge not available, initializing WeaknessPage in standalone mode');
                this.initialize();
            }
        }, 1000);
    }
    
    initialize() {
        if (this.initialized) return;
        this.initialized = true;
        
        console.log('🚀 Initializing WeaknessPage...');
        
        this.initElements();
        this.loadWeaknessData();
    }

    initElements() {
        this.weaknessList = document.getElementById('weaknessList');
    }

    async loadWeaknessData() {
        const startTime = performance.now();
        console.log('🚀 Starting to load weakness data...');
        
        try {
            // Check if Python bridge is available
            if (!window.pythonBridge) {
                console.log('⚡ Python bridge not available, loading real data from JSON');
                await this.loadSampleData();
                return;
            }
            
            console.log('🔗 Python bridge available, requesting data...');
            
            // Request weakness data from Python
            const callbackId = 'weakness_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            window.pythonBridge.send('get_weakness_data', {}, callbackId);
            
            // Wait for response with timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Python bridge timeout')), 1000)
            );
            
            const responsePromise = new Promise((resolve) => {
                window.pythonBridge.registerCallback(callbackId, (data) => {
                    resolve(data);
                });
            });
            
            try {
                const data = await Promise.race([responsePromise, timeoutPromise]);
                console.log('✅ Received weakness data from Python:', data);
                
                if (data && Object.keys(data).length > 0) {
                    this.weaknessData = data;
                    this.updateWeaknessDisplay();
                } else {
                    console.log('⚠️ Empty data received, loading from JSON');
                    await this.loadSampleData();
                }
            } catch (error) {
                console.log('❌ Error loading weakness data:', error.message);
                console.log('🔄 Loading real data as fallback...');
                await this.loadSampleData();
            }
            
        } catch (error) {
            console.log('❌ Error in loadWeaknessData:', error);
            await this.loadSampleData();
        }
        
        const totalTime = performance.now() - startTime;
        console.log(`🎯 Total load time: ${totalTime.toFixed(2)}ms`);
    }
    
    async loadSampleData() {
        // Load real data from JSON file when Python bridge is not available
        const startTime = performance.now();
        console.log('🚀 Loading real weakness data from JSON file...');
        
        try {
            const loadStart = performance.now();
            const [attemptsResponse] = await Promise.all([
                fetch('../data/attempts.json')
            ]);
            const loadTime = performance.now() - loadStart;
            
            if (!attemptsResponse.ok) {
                throw new Error(`Attempts JSON: HTTP ${attemptsResponse.status}`);
            }
            
            const attempts = await attemptsResponse.json();
            console.log(`✅ Loaded ${attempts.length} attempts in ${loadTime.toFixed(2)}ms`);
            
            // Early return for empty data
            if (attempts.length === 0) {
                console.log('⚠️ No attempts found, showing empty state');
                this.showEmptyState();
                return;
            }
            
            // Process weakness data
            const weaknessStats = new Map();
            
            attempts.forEach(attempt => {
                const { operation, digits, correct, time_taken = 0 } = attempt;
                
                if (operation && digits) {
                    const key = `${operation}-${digits}`;
                    if (!weaknessStats.has(key)) {
                        weaknessStats.set(key, {
                            operation,
                            digits,
                            totalAttempts: 0,
                            correctAttempts: 0,
                            totalTime: 0,
                            avgTime: 0,
                            accuracy: 0,
                            weaknessScore: 0
                        });
                    }
                    
                    const stats = weaknessStats.get(key);
                    stats.totalAttempts++;
                    if (correct) {
                        stats.correctAttempts++;
                    }
                    stats.totalTime += time_taken;
                    stats.avgTime = stats.totalTime / stats.totalAttempts;
                    stats.accuracy = (stats.correctAttempts / stats.totalAttempts) * 100;
                    
                    // Calculate weakness score (higher = weaker)
                    // Score based on low accuracy and slow speed
                    const accuracyPenalty = Math.max(0, 100 - stats.accuracy) * 0.7;
                    const speedPenalty = Math.max(0, stats.avgTime - 3) * 10; // 3 seconds is target
                    stats.weaknessScore = Math.min(100, accuracyPenalty + speedPenalty);
                }
            });
            
            // Convert to array and sort by weakness score
            const weaknesses = Array.from(weaknessStats.values())
                .sort((a, b) => b.weaknessScore - a.weaknessScore);
            
            this.weaknessData = { weaknesses };
            this.updateWeaknessDisplay();
            
        } catch (error) {
            console.log('❌ Error loading sample data:', error);
            this.showErrorState(error.message);
        }
        
        const totalTime = performance.now() - startTime;
        console.log(`🎯 Total load time: ${totalTime.toFixed(2)}ms`);
    }

    updateWeaknessDisplay() {
        if (!this.weaknessList) return;
        
        const weaknesses = this.weaknessData.weaknesses || [];
        
        if (weaknesses.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.weaknessList.innerHTML = '';
        
        weaknesses.forEach(weakness => {
            const card = this.createWeaknessCard(weakness);
            this.weaknessList.appendChild(card);
        });
    }

    createWeaknessCard(weakness) {
        const { operation, digits, accuracy, avgTime, weaknessScore, totalAttempts } = weakness;
        
        // Determine weakness level
        let levelClass, levelText, suggestions;
        if (totalAttempts === 0) {
            levelClass = 'unpracticed';
            levelText = 'Not practiced yet';
            suggestions = '📝 Start here to build foundation skills';
        } else if (weaknessScore >= 70) {
            levelClass = 'high-weakness';
            levelText = digits === 1 ? 'Beginner' : digits === 2 ? 'Intermediate' : 'Advanced';
            suggestions = this.getHighWeaknessSuggestions(operation, digits);
        } else if (weaknessScore >= 40) {
            levelClass = 'medium-weakness';
            levelText = digits === 1 ? 'Beginner' : digits === 2 ? 'Intermediate' : 'Advanced';
            suggestions = this.getMediumWeaknessSuggestions(operation, digits);
        } else {
            levelClass = 'low-weakness';
            levelText = digits === 1 ? 'Beginner' : digits === 2 ? 'Intermediate' : 'Advanced';
            suggestions = this.getLowWeaknessSuggestions(operation, digits);
        }
        
        const card = document.createElement('div');
        card.className = `weakness-card ${levelClass}`;
        
        const scoreDisplay = totalAttempts === 0 ? 'NEW' : `Score: ${Math.round(weaknessScore)}`;
        const statsDisplay = totalAttempts === 0 ? 'Not practiced yet' : 
            `Accuracy: ${Math.round(accuracy)}% | Speed: ${avgTime.toFixed(1)}s`;
        
        card.innerHTML = `
            <div class="weakness-info">
                <h4>${operation} - ${digits} digits</h4>
                <p>Level: ${levelText}</p>
                <p>${statsDisplay}</p>
                <p class="suggestions">Tips: ${suggestions}</p>
            </div>
            <div class="weakness-score">${scoreDisplay}</div>
        `;
        
        return card;
    }

    getHighWeaknessSuggestions(operation, digits) {
        const suggestions = {
            'Addition': 'Focus on number grouping, practice with smaller numbers first',
            'Subtraction': 'Work on borrowing techniques, use number lines for visualization',
            'Multiplication': 'Break down large numbers, practice multiplication tables',
            'Division': 'Learn common divisors, practice estimation skills'
        };
        return suggestions[operation] || 'Practice fundamental skills, start with easier problems';
    }

    getMediumWeaknessSuggestions(operation, digits) {
        const suggestions = {
            'Addition': 'Improve mental math speed, try different addition strategies',
            'Subtraction': 'Practice with larger numbers, work on speed',
            'Multiplication': 'Use multiplication tricks, learn common patterns',
            'Division': 'Practice long division, memorize common division facts'
        };
        return suggestions[operation] || 'Build on existing skills, increase practice frequency';
    }

    getLowWeaknessSuggestions(operation, digits) {
        const suggestions = {
            'Addition': 'Focus on speed, try advanced mental math techniques',
            'Subtraction': 'Work on complex problems, improve accuracy',
            'Multiplication': 'Practice with larger numbers, learn advanced tricks',
            'Division': 'Tackle complex divisions, work on efficiency'
        };
        return suggestions[operation] || 'Maintain skills, challenge yourself with harder problems';
    }

    showEmptyState() {
        if (!this.weaknessList) return;
        
        this.weaknessList.innerHTML = `
            <div class="empty-state">
                <h3>No weakness data available</h3>
                <p>Start practicing to see your weakness analysis here.</p>
            </div>
        `;
    }

    showErrorState(error) {
        if (!this.weaknessList) return;
        
        this.weaknessList.innerHTML = `
            <div class="error-state">
                <h3>Error loading weakness data</h3>
                <p>${error}</p>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Global function for Python to call
window.updateFromPython = function(action, data) {
    if (window.weaknessPage) {
        switch(action) {
            case 'updateWeakness':
                window.weaknessPage.loadWeaknessData();
                break;
            // Add more as needed
        }
    }
};

// Instantiate the WeaknessPage
const weaknessPage = new WeaknessPage();
window.weaknessPage = weaknessPage;
