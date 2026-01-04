class ProgressPage {
    constructor() {
        // Don't initialize immediately - wait for bridge
        this.initialized = false;
        this.currentPeriod = 'week';
        this.progressData = {};
        this.chart = null;
        
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
                console.warn('Bridge not available, initializing ProgressPage in standalone mode');
                this.initialize();
            }
        }, 1000); // Reduced from 5000ms to 1000ms
    }
    
    initialize() {
        if (this.initialized) return;
        this.initialized = true;
        
        console.log('🚀 Initializing ProgressPage...');
        
        this.initElements();
        this.initEventListeners();
        this.loadTheme(); // Load theme preference
        this.initSystemThemeListener(); // Listen for system theme changes
        this.loadProgressData();
    }

    initElements() {
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.statsOverview = document.getElementById('statsOverview');
        
        // Stats elements
        this.totalQuestions = document.getElementById('totalQuestions');
        this.avgAccuracy = document.getElementById('avgAccuracy');
        this.avgSpeed = document.getElementById('avgSpeed');
        this.currentStreak = document.getElementById('currentStreak');
        
        // Content containers
        this.masteryGridLarge = document.getElementById('masteryGridLarge');
        this.weaknessListLarge = document.getElementById('weaknessListLarge');
        this.recentActivity = document.getElementById('recentActivity');
        this.achievementProgress = document.getElementById('achievementProgress');
        this.personalBests = document.getElementById('personalBests');
        
        // Chart
        this.chartCanvas = document.getElementById('performanceChart');
    }

    initEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.loadProgressData();
            });
        });
        
        // Back button
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.goBack();
            }
        });
    }

    async loadProgressData() {
        console.log('🚀 Starting to load progress data...');
        const startTime = performance.now();
        
        this.showLoading(true);
        this.showHeavyDataLoading(true);
        
        try {
            // Check if Python bridge is available
            if (!window.pythonBridge) {
                console.log('⚡ Python bridge not available, loading real data from JSON');
                const loadStart = performance.now();
                await this.loadSampleData();
                const loadTime = performance.now() - loadStart;
                console.log(`✅ Data loaded in ${loadTime.toFixed(2)}ms`);
                this.showLoading(false);
                this.showHeavyDataLoading(false);
                return;
            }
            
            console.log('🔗 Python bridge available, requesting data...');
            
            // Request data from Python with timeout
            const data = await Promise.race([
                this.sendToPythonAsync('get_progress_data', { period: this.currentPeriod }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Bridge timeout')), 1000)) // Reduced from 5000ms to 1000ms
            ]);
            
            console.log('📊 Received data:', data);
            
            // If we got data back, display it.
            if (data && Object.keys(data).length > 0) {
                console.log('⚡ Displaying data instantly.');
                this.progressData = data;
                this.updateAllSections();
                this.showLoading(false);
                // Heavy data spinners will be turned off by updateHeavyData when it's pushed
            } else {
                // No data yet, we are waiting for a push from Python.
                console.log('⏳ No data received. Waiting for data push from Python.');
            }
            
        } catch (error) {
            console.error('❌ Error loading progress data:', error);
            console.log('🔄 Loading real data as fallback...');
            const fallbackStart = performance.now();
            await this.loadSampleData();
            const fallbackTime = performance.now() - fallbackStart;
            console.log(`✅ Fallback loaded in ${fallbackTime.toFixed(2)}ms`);
            this.showLoading(false);
            this.showHeavyDataLoading(false);
        }
        
        const totalTime = performance.now() - startTime;
        console.log(`🎯 Total load time: ${totalTime.toFixed(2)}ms`);
    }
    
    showHeavyDataLoading(show) {
        // Show loading indicators for heavy data components
        const heavyComponents = ['masteryGridLarge', 'weaknessListLarge', 'achievementProgress', 'personalBests'];
        
        heavyComponents.forEach(componentId => {
            const element = document.getElementById(componentId);
            if (element) {
                if (show) {
                    // Only show loading if element is empty or already showing loading
                    if (!element.innerHTML.trim() || element.innerHTML.includes('Loading...')) {
                        element.innerHTML = `
                            <div style="text-align: center; color: var(--muted-color); padding: 20px;">
                                <div class="mini-spinner" style="width: 20px; height: 20px; border: 2px solid var(--muted-color); border-top: 2px solid var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
                                <p>Loading...</p>
                            </div>
                        `;
                    }
                } else {
                    // Hide loading by clearing the content (will be filled by update methods)
                    if (element.innerHTML.includes('Loading...')) {
                        element.innerHTML = '';
                    }
                }
            }
        });
    }
    
    async loadSampleData() {
        // Load real data from JSON file when Python bridge is not available
        const startTime = performance.now();
        console.log('🚀 Loading real data from JSON file...');
        
        try {
            // Load both files in PARALLEL for maximum speed
            const loadStart = performance.now();
            const [attemptsResponse, sessionsResponse] = await Promise.all([
                fetch('./attempts.json'),
                fetch('./sessions.json').catch(() => ({ ok: false })) // Optional sessions file
            ]);
            const loadTime = performance.now() - loadStart;
            
            if (!attemptsResponse.ok) {
                throw new Error(`Attempts JSON: HTTP ${attemptsResponse.status}`);
            }
            
            const attempts = await attemptsResponse.json();
            const sessions = sessionsResponse.ok ? await sessionsResponse.json() : [];
            
            console.log(`✅ Loaded ${attempts.length} attempts and ${sessions.length} sessions in ${loadTime.toFixed(2)}ms`);
            
            // Early return for empty data
            if (attempts.length === 0) {
                console.log('⚠️ No attempts found, showing empty state');
                this.progressData = {
                    stats: { totalQuestions: 0, avgAccuracy: 0, avgSpeed: 0, currentStreak: 0, practiceDays: 0 },
                    recentActivity: [],
                    mastery: {},
                    chartData: []
                };
                this.updateAllSections();
                return;
            }
            
            // Ultra-optimized single-pass processing
            const processStart = performance.now();
            const dailyStats = new Map();
            const masteryStats = new Map();
            const operations = ['Addition', 'Subtraction', 'Multiplication', 'Division'];
            
            let totalCorrect = 0;
            let totalSumTime = 0;
            let maxStreak = 0;
            let currentStreak = 0;
            let bestSpeed = Infinity;
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            
            // Single loop to calculate everything
            attempts.forEach(attempt => {
                const { correct, time_taken = 0, operation, digits, created, timestamp } = attempt;
                
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
                
                // Daily stats (optimized with Map)
                const date = created || timestamp?.split('T')[0];
                if (date) {
                    if (!dailyStats.has(date)) {
                        dailyStats.set(date, { count: 0, correct: 0, timeSum: 0 });
                    }
                    const dayStats = dailyStats.get(date);
                    dayStats.count++;
                    if (correct) dayStats.correct++;
                    dayStats.timeSum += time_taken;
                }
                
                // Mastery stats (optimized with Map)
                if (operation && digits) {
                    const key = `${operation}-${digits}`;
                    if (!masteryStats.has(key)) {
                        masteryStats.set(key, { count: 0, correct: 0, timeSum: 0 });
                    }
                    const mastery = masteryStats.get(key);
                    mastery.count++;
                    if (correct) mastery.correct++;
                    mastery.timeSum += time_taken;
                }
            });
            
            const totalAttempts = attempts.length;
            const accuracy = (totalCorrect / totalAttempts) * 100;
            const avgSpeed = totalSumTime / totalAttempts;
            
            // Process recent activity (more efficient)
            const recentActivity = Array.from(dailyStats.entries())
                .sort(([a], [b]) => b.localeCompare(a))
                .slice(0, 7)
                .map(([date, stats]) => {
                    let timeAgo = date;
                    if (date === today) timeAgo = 'Today';
                    else if (date === yesterday) timeAgo = 'Yesterday';
                    else {
                        const days = Math.floor((new Date(today) - new Date(date)) / 86400000);
                        timeAgo = `${days} days ago`;
                    }
                    
                    return {
                        date,
                        timeAgo,
                        questions: stats.count,
                        accuracy: (stats.correct / stats.count) * 100,
                        avgSpeed: stats.timeSum / stats.count
                    };
                });
            
            // Process mastery data (optimized)
            const mastery = {};
            operations.forEach(op => {
                [1, 2, 3].forEach(digit => {
                    const key = `${op}-${digit}`;
                    const stats = masteryStats.get(key) || { count: 0, correct: 0, timeSum: 0 };
                    const acc = stats.count > 0 ? (stats.correct / stats.count) * 100 : 0;
                    const speed = stats.count > 0 ? stats.timeSum / stats.count : 0;
                    
                    let level = 'Novice';
                    if (acc >= 90 && speed < 3.0) level = 'Master';
                    else if (acc >= 80 && speed < 5.0) level = 'Pro';
                    else if (acc >= 70) level = 'Apprentice';
                    
                    mastery[key] = { level, acc, speed, count: stats.count };
                });
            });
            
            // Create chart data (simplified)
            const chartData = recentActivity.slice(0, 7).reverse().map(activity => ({
                label: new Date(activity.date).toLocaleDateString('en', { weekday: 'short' }),
                accuracy: activity.accuracy,
                speed: activity.avgSpeed
            }));
            
            const processTime = performance.now() - processStart;
            const totalTime = performance.now() - startTime;
            
            console.log(`⚡ Processed data in ${processTime.toFixed(2)}ms (total: ${totalTime.toFixed(2)}ms)`);
            
            const realData = {
                stats: {
                    totalQuestions: totalAttempts,
                    avgAccuracy: accuracy,
                    avgSpeed: avgSpeed,
                    currentStreak: maxStreak, // Use calculated max streak
                    practiceDays: dailyStats.size
                },
                chartData,
                recentActivity,
                mastery,
                weaknesses: [], // Will be calculated separately if needed
                achievements: [], // Will be loaded separately if needed
                personalBests: {} // Will be calculated separately if needed
            };
            
            console.log('🎯 Data ready:', {
                attempts: totalAttempts,
                accuracy: accuracy.toFixed(1) + '%',
                speed: avgSpeed.toFixed(2) + 's',
                maxStreak: maxStreak,
                days: dailyStats.size,
                masteryKeys: Object.keys(mastery).length
            });
            
            this.progressData = realData;
            this.updateAllSections();
            
        } catch (error) {
            const loadTime = performance.now() - startTime;
            console.error(`❌ Error loading data after ${loadTime.toFixed(2)}ms:`, error);
            
            // Fast fallback to zeros
            this.progressData = {
                stats: { totalQuestions: 0, avgAccuracy: 0, avgSpeed: 0, currentStreak: 0, practiceDays: 0 },
                recentActivity: [],
                mastery: {},
                chartData: []
            };
            this.updateAllSections();
        }
    }

    updateFastData(data) {
        console.log('Received fast data push from Python:', data);
        if (data && Object.keys(data).length > 0) {
            this.progressData = data;
            
            // Update fast sections
            this.updateStatsOverview();
            this.updateRecentActivity();
            if (this.chartCanvas) {
                this.updatePerformanceChart();
            }
            
            // Hide main loading spinner
            this.showLoading(false);
        } else {
            console.warn('Received empty fast data push.');
            this.showLoading(false); // Hide spinner anyway to prevent getting stuck
        }
    }

    updateAllSections() {
        // Use requestAnimationFrame for smoother UI updates
        requestAnimationFrame(() => {
            // Update critical stats first
            this.updateStatsOverview();
            
            // Then update other sections in the next frame
            requestAnimationFrame(() => {
                this.updateRecentActivity();
                
                // Update heavy components last with batching
                requestAnimationFrame(() => {
                    // Batch DOM updates for better performance
                    const fragment = document.createDocumentFragment();
                    
                    // Update mastery grid
                    if (this.masteryGridLarge) {
                        const tempContainer = document.createElement('div');
                        this.masteryGridLarge.innerHTML = '';
                        
                        // Headers
                        tempContainer.innerHTML += '<div class="mastery-header-cell"></div>';
                        [1, 2, 3].forEach(d => {
                            const header = document.createElement('div');
                            header.className = 'mastery-header-cell';
                            header.textContent = `${d} Digit`;
                            tempContainer.appendChild(header);
                        });
                        
                        // Operations
                        ['Addition', 'Subtraction', 'Multiplication', 'Division'].forEach(op => {
                            const opLabel = document.createElement('div');
                            opLabel.className = 'operation-label';
                            opLabel.textContent = op;
                            tempContainer.appendChild(opLabel);
                            
                            [1, 2, 3].forEach(d => {
                                const key = `${op}-${d}`;
                                const stats = this.progressData.mastery?.[key] || { level: 'Novice', acc: 0, speed: 0, count: 0 };
                                const cell = document.createElement('div');
                                cell.className = `mastery-cell-large ${stats.level.toLowerCase()}`;
                                
                                cell.innerHTML = `
                                    <div class="mastery-level">${stats.level.toUpperCase()}</div>
                                    <div class="mastery-detail">${stats.acc.toFixed(0)}% | ${stats.speed.toFixed(1)}s</div>
                                    <div class="mastery-count">(${stats.count} plays)</div>
                                `;
                                
                                tempContainer.appendChild(cell);
                            });
                        });
                        
                        // Append all at once
                        while (tempContainer.firstChild) {
                            this.masteryGridLarge.appendChild(tempContainer.firstChild);
                        }
                    }
                    
                    // Update weakness analysis
                    if (this.weaknessListLarge) {
                        this.updateWeaknessAnalysis();
                    }
                    
                    // Update achievements
                    if (this.achievementProgress) {
                        this.updateAchievementProgress();
                    }
                    
                    // Update personal bests
                    this.updatePersonalBests();
                    
                    // Update chart
                    if (this.chartCanvas) {
                        this.updatePerformanceChart();
                    }
                });
            });
        });
    }
    
    updateHeavyData(heavyData) {
        console.log('Received heavy data update:', heavyData);
        
        let updatedComponents = 0;
        const totalComponents = 4; // mastery, weaknesses, achievements, personalBests
        
        // Update heavy data components
        if (heavyData.mastery && Object.keys(heavyData.mastery).length > 0) {
            this.progressData.mastery = heavyData.mastery;
            this.updateMasteryGrid();
            updatedComponents++;
        }
        
        if (heavyData.weaknesses && heavyData.weaknesses.length > 0) {
            this.progressData.weaknesses = heavyData.weaknesses;
            if (this.weaknessListLarge) {
                this.updateWeaknessAnalysis();
                updatedComponents++;
            }
        }
        
        if (heavyData.achievements && heavyData.achievements.length > 0) {
            this.progressData.achievements = heavyData.achievements;
            if (this.achievementProgress) {
                this.updateAchievementProgress();
                updatedComponents++;
            }
        }
        
        if (heavyData.personalBests && Object.keys(heavyData.personalBests).length > 0) {
            this.progressData.personalBests = heavyData.personalBests;
            this.updatePersonalBests();
            updatedComponents++;
        }
        
        // Update progress data with new heavy data
        this.updateAllSections();
        
        // Hide loading indicators when all components are updated
        if (updatedComponents > 0) {
            this.showHeavyDataLoading(false);
        } else {
            // If we received an empty heavy data update, still hide the spinners
            // to avoid them being stuck indefinitely.
            this.showHeavyDataLoading(false);
        }
        
        console.log(`Heavy data update completed: ${updatedComponents}/${totalComponents} components updated`);
    }

    updateStatsOverview() {
        const stats = this.progressData.stats || {};
        
        this.totalQuestions.textContent = stats.totalQuestions || 0;
        this.avgAccuracy.textContent = stats.avgAccuracy ? `${stats.avgAccuracy.toFixed(1)}%` : '0%';
        this.avgSpeed.textContent = stats.avgSpeed ? `${stats.avgSpeed.toFixed(2)}s` : '0.0s';
        this.currentStreak.textContent = stats.currentStreak || 0;
        
        // Add practice days if available
        if (stats.practiceDays !== undefined) {
            // Update the streak label to show both streak and practice days
            const streakLabel = this.currentStreak.parentElement;
            if (streakLabel) {
                streakLabel.innerHTML = `
                    <div class="stat-value" id="currentStreak" aria-label="Current streak">${stats.currentStreak || 0}</div>
                    <div class="stat-label">Streak (${stats.practiceDays} days)</div>
                `;
            }
        }
        
        // Add operation breakdown if available
        if (this.progressData.operationBreakdown && this.progressData.operationBreakdown.length > 0) {
            this.addOperationBreakdown();
        }
    }
    
    addOperationBreakdown() {
        // Check if operation breakdown already exists
        if (document.getElementById('operationBreakdown')) {
            return;
        }
        
        const operationBreakdown = this.progressData.operationBreakdown || [];
        const breakdownDiv = document.createElement('div');
        breakdownDiv.id = 'operationBreakdown';
        breakdownDiv.className = 'operation-breakdown';
        breakdownDiv.style.cssText = 'margin-top: 20px; padding: 15px; background-color: var(--dark-bg); border-radius: 8px;';
        
        breakdownDiv.innerHTML = `
            <h4 style="margin-bottom: 10px; color: var(--text-primary);">Operation Performance</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                ${operationBreakdown.map(op => `
                    <div style="text-align: center; padding: 10px; background-color: var(--card-bg); border-radius: 6px;">
                        <div style="font-weight: bold; color: var(--accent-color);">${op.operation}</div>
                        <div style="font-size: 14px; color: var(--text-secondary);">${op.count} questions</div>
                        <div style="font-size: 12px; color: var(--success-color);">
                            ${((op.correct / op.count) * 100).toFixed(1)}% accuracy
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Insert after stats overview
        this.statsOverview.parentNode.insertBefore(breakdownDiv, this.statsOverview.nextSibling);
    }

    updateMasteryGrid() {
        const mastery = this.progressData.mastery || {};
        this.masteryGridLarge.innerHTML = '';
        
        // Headers
        this.masteryGridLarge.innerHTML += '<div class="mastery-header-cell"></div>';
        [1, 2, 3].forEach(d => {
            const header = document.createElement('div');
            header.className = 'mastery-header-cell';
            header.textContent = `${d} Digit`;
            this.masteryGridLarge.appendChild(header);
        });
        
        // Operations
        ['Addition', 'Subtraction', 'Multiplication', 'Division'].forEach(op => {
            const opLabel = document.createElement('div');
            opLabel.className = 'operation-label';
            opLabel.textContent = op;
            this.masteryGridLarge.appendChild(opLabel);
            
            [1, 2, 3].forEach(d => {
                const key = `${op}-${d}`;
                const stats = mastery[key] || { level: 'Novice', acc: 0, speed: 0, count: 0 };
                const cell = document.createElement('div');
                cell.className = `mastery-cell-large ${stats.level.toLowerCase()}`;
                
                cell.innerHTML = `
                    <div class="mastery-level">${stats.level.toUpperCase()}</div>
                    <div class="mastery-detail">${stats.acc.toFixed(0)}% | ${stats.speed.toFixed(1)}s</div>
                    <div class="mastery-count">(${stats.count} plays)</div>
                `;
                
                this.masteryGridLarge.appendChild(cell);
            });
        });
    }

    updateWeaknessAnalysis() {
        const weaknesses = this.progressData.weaknesses || [];
        this.weaknessListLarge.innerHTML = '';
        
        if (weaknesses.length === 0) {
            // Check if there's any practice data at all
            const hasPracticeData = this.progressData.stats && this.progressData.stats.totalQuestions > 0;
            
            if (hasPracticeData) {
                this.weaknessListLarge.innerHTML = `
                    <div style="text-align: center; color: var(--success-color); padding: 20px;">
                        🎉 Great job! No significant weaknesses detected. Keep up the consistent practice!
                    </div>
                `;
            } else {
                this.weaknessListLarge.innerHTML = `
                    <div style="text-align: center; color: var(--muted-color); padding: 20px;">
                        📝 Start practicing to see your weakness analysis here.
                    </div>
                `;
            }
            return;
        }
        
        // Sort weaknesses by severity
        weaknesses.sort((a, b) => b.weaknessScore - a.weaknessScore);
        
        weaknesses.forEach((weakness, index) => {
            const card = document.createElement('div');
            let cardClass = 'weakness-card';
            
            // Determine severity class
            if (!weakness.practiced || weakness.total_attempts === 0) {
                cardClass += ' unpracticed';
            } else if (weakness.weaknessScore > 70) {
                cardClass += ' high-weakness';
            } else if (weakness.weaknessScore > 50) {
                cardClass += ' medium-weakness';
            } else {
                cardClass += ' low-weakness';
            }
            
            card.className = cardClass;
            
            // Create priority indicator
            let priorityBadge = '';
            if (index === 0 && weakness.weaknessScore > 50) {
                priorityBadge = '<span style="background-color: var(--error-color); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 8px;">PRIORITY</span>';
            }
            
            const scoreText = !weakness.practiced || weakness.total_attempts === 0 ? 
                'NEW' : `Score: ${weakness.weaknessScore.toFixed(0)}`;
            
            const statsText = weakness.practiced && weakness.total_attempts > 0 ? 
                `Accuracy: ${weakness.accuracy.toFixed(0)}% | Speed: ${weakness.speed.toFixed(1)}s | ${weakness.total_attempts} attempts` : 
                'Not practiced yet';
            
            // Generate practice recommendation
            let practiceRecommendation = '';
            if (!weakness.practiced || weakness.total_attempts === 0) {
                practiceRecommendation = '<p class="suggestions">📝 Start here to build foundation skills</p>';
            } else if (weakness.weaknessScore > 70) {
                practiceRecommendation = '<p class="suggestions">🎯 Focus area - Practice daily for improvement</p>';
            } else if (weakness.weaknessScore > 50) {
                practiceRecommendation = '<p class="suggestions">📈 Needs regular practice</p>';
            }
            
            card.innerHTML = `
                <div class="weakness-info">
                    <h4>${weakness.operation} - ${weakness.digits} digits${priorityBadge}</h4>
                    <p>Level: <span style="color: ${this.getMasteryLevelColor(weakness.level)}; font-weight: bold;">${weakness.level}</span></p>
                    <p>${statsText}</p>
                    ${practiceRecommendation}
                    ${weakness.suggestions && weakness.suggestions.length > 0 ? `<p class="suggestions">Tips: ${weakness.suggestions.join(' | ')}</p>` : ''}
                </div>
                <div class="weakness-score">${scoreText}</div>
            `;
            
            this.weaknessListLarge.appendChild(card);
        });
    }
    
    getMasteryLevelColor(level) {
        switch(level.toLowerCase()) {
            case 'master': return '#e0af68';
            case 'pro': return '#2ECC71';
            case 'apprentice': return '#3498DB';
            case 'novice': return '#E74C3C';
            default: return 'var(--text-secondary)';
        }
    }

    updateRecentActivity() {
        const activity = this.progressData.recentActivity || [];
        this.recentActivity.innerHTML = '';
        
        if (activity.length === 0) {
            this.recentActivity.innerHTML = `
                <div style="text-align: center; color: var(--muted-color); padding: 20px;">
                    No recent activity found.
                </div>
            `;
            return;
        }
        
        activity.forEach(item => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            const speedDisplay = item.avgSpeed ? 
                `${item.avgSpeed.toFixed(2)}s avg` : 
                (item.speed ? `${item.speed}s avg` : 'N/A');
            
            activityItem.innerHTML = `
                <div>
                    <div>${item.date}</div>
                    <div class="activity-date">${item.timeAgo}</div>
                </div>
                <div class="activity-stats">
                    <span class="activity-count">${item.questions} questions</span>
                    <span class="activity-accuracy">${item.accuracy.toFixed(1)}%</span>
                    <span>${speedDisplay}</span>
                </div>
            `;
            
            this.recentActivity.appendChild(activityItem);
        });
    }

    updateAchievementProgress() {
        const achievements = this.progressData.achievements || [];
        this.achievementProgress.innerHTML = '';
        
        if (achievements.length === 0) {
            this.achievementProgress.innerHTML = `
                <div style="text-align: center; color: var(--muted-color); padding: 20px;">
                    No achievements yet. Keep practicing to unlock them!
                </div>
            `;
            return;
        }
        
        achievements.forEach(achievement => {
            const progressItem = document.createElement('div');
            progressItem.style.cssText = 'margin-bottom: 15px; padding: 10px; background-color: var(--dark-bg); border-radius: 8px;';
            
            const progress = achievement.progress || 0;
            const isUnlocked = achievement.unlocked;
            
            progressItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: ${isUnlocked ? '#e0af68' : 'var(--muted-color)'}; font-weight: bold;">
                        ${isUnlocked ? '🏆' : '🔒'} ${achievement.name}
                    </span>
                    <span style="color: var(--text-color); font-size: 14px;">
                        ${isUnlocked ? 'Unlocked!' : `${progress}%`}
                    </span>
                </div>
                <div style="background-color: var(--progress-bg); border-radius: 4px; height: 6px; overflow: hidden;">
                    <div style="background-color: ${isUnlocked ? '#e0af68' : 'var(--accent-color)'}; height: 100%; width: ${progress}%; transition: width 0.3s ease;"></div>
                </div>
                <div style="color: var(--muted-color); font-size: 12px; margin-top: 5px;">
                    ${achievement.desc}
                </div>
            `;
            
            this.achievementProgress.appendChild(progressItem);
        });
    }

    updatePersonalBests() {
        const bests = this.progressData.personalBests || {};
        this.personalBests.innerHTML = '';
        
        const categories = [
            { key: 'drill', title: '🎯 Drill (20 Questions)', unit: 'time' },
            { key: 'sprint', title: '⚡ Sprint (60s)', unit: 'score' },
            { key: 'accuracy', title: '🎯 Best Accuracy', unit: 'percent' },
            { key: 'speed', title: '⚡ Fastest Speed', unit: 'time' }
        ];
        
        categories.forEach(category => {
            const best = bests[category.key];
            const bestItem = document.createElement('div');
            bestItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 10px; background-color: var(--dark-bg); border-radius: 8px;';
            
            let value = 'Not set';
            if (best) {
                switch (category.unit) {
                    case 'time':
                        value = `${best.toFixed(2)}s`;
                        break;
                    case 'score':
                        value = `${best} questions`;
                        break;
                    case 'percent':
                        value = `${best.toFixed(1)}%`;
                        break;
                }
            }
            
            bestItem.innerHTML = `
                <span style="color: var(--text-color);">${category.title}</span>
                <span style="color: var(--accent-color); font-weight: bold;">${value}</span>
            `;
            
            this.personalBests.appendChild(bestItem);
        });
    }

    updatePerformanceChart() {
        const chartData = this.progressData.chartData || [];
        const container = this.chartCanvas.parentNode;
        
        // Remove any existing no-data message
        const existingMsg = container.querySelector('.no-data-msg');
        if (existingMsg) {
            existingMsg.remove();
        }
        
        if (chartData.length === 0) {
            this.chartCanvas.style.display = 'none';
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'no-data-msg';
            noDataMsg.style.cssText = 'text-align: center; color: var(--muted-color); padding: 40px;';
            noDataMsg.textContent = 'No chart data available for the selected period.';
            container.appendChild(noDataMsg);
            return;
        }
        
        this.chartCanvas.style.display = 'block';
        
        // Simple canvas chart implementation
        const ctx = this.chartCanvas.getContext('2d');
        const canvas = this.chartCanvas;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Prepare data
        const labels = chartData.map(d => d.label);
        const accuracyData = chartData.map(d => d.accuracy);
        const speedData = chartData.map(d => d.speed);
        
        const maxAccuracy = Math.max(...accuracyData, 100);
        const maxSpeed = Math.max(...speedData, 10);
        
        const padding = 40;
        const chartWidth = canvas.width - (padding * 2);
        const chartHeight = canvas.height - (padding * 2);
        
        // Draw axes
        ctx.strokeStyle = '#4B5E4B';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        // Draw accuracy line
        ctx.strokeStyle = '#2ECC71';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        accuracyData.forEach((value, index) => {
            const x = padding + (index / (accuracyData.length - 1)) * chartWidth;
            const y = canvas.height - padding - (value / maxAccuracy) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw speed line
        ctx.strokeStyle = '#e0af68';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        speedData.forEach((value, index) => {
            const x = padding + (index / (speedData.length - 1)) * chartWidth;
            const y = canvas.height - padding - (value / maxSpeed) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw labels
        ctx.fillStyle = '#ECF0F1';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        
        labels.forEach((label, index) => {
            if (index % Math.ceil(labels.length / 7) === 0) { // Show every nth label
                const x = padding + (index / (labels.length - 1)) * chartWidth;
                ctx.fillText(label, x, canvas.height - padding + 20);
            }
        });
        
        // Draw legend
        ctx.fillStyle = '#2ECC71';
        ctx.fillRect(canvas.width - 150, 10, 15, 3);
        ctx.fillStyle = '#ECF0F1';
        ctx.font = '12px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('Accuracy', canvas.width - 130, 14);
        
        ctx.fillStyle = '#e0af68';
        ctx.fillRect(canvas.width - 150, 25, 15, 3);
        ctx.fillStyle = '#ECF0F1';
        ctx.fillText('Speed', canvas.width - 130, 29);
    }

    showLoading(show) {
        if (this.loadingSpinner) {
            this.loadingSpinner.style.display = show ? 'block' : 'none';
        }
        if (this.statsOverview) {
            this.statsOverview.style.display = show ? 'none' : 'grid';
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--error-color);
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 1000;
            max-width: 400px;
            text-align: center;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            document.body.removeChild(errorDiv);
        }, 3000);
    }

    sendToPythonAsync(action, data) {
        return new Promise((resolve, reject) => {
            if (window.pythonBridge) {
                const callbackId = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                if (!window.pythonBridge.callbacks) {
                    window.pythonBridge.callbacks = {};
                }
                
                // Set up timeout - reduced for faster feedback
                const timeout = setTimeout(() => {
                    delete window.pythonBridge.callbacks[callbackId];
                    reject(new Error('Python bridge timeout'));
                }, 1000); // Reduced from 3000ms to 1000ms
                
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

    goBack() {
        // Close the progress page and return to main app
        if (window.parent && window.parent.app) {
            // If embedded in main app
            window.parent.app.closeModal('progress');
        } else {
            // If standalone, try to navigate back
            window.history.back();
        }
    }

    loadTheme() {
        // Load theme from localStorage or system preference
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (systemDark ? 'dark' : 'light');
        
        document.documentElement.setAttribute('data-theme', theme);
    }

    initSystemThemeListener() {
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            // Only auto-change if user hasn't manually set a preference
            if (!localStorage.getItem('theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
            }
        });
    }
}

// Global function for Python to call
window.updateFromPython = function(action, data) {
    if (window.progressPage) {
        switch(action) {
            case 'updateProgress':
                window.progressPage.loadProgressData();
                break;
            case 'updateStats':
                window.progressPage.updateStatsDisplay();
                break;
            // Add more as needed
        }
    }
};

// Auto-test if no Python bridge after 3 seconds
setTimeout(() => {
    if (!window.pythonBridge && !window.progressPage) {
        console.log('No Python bridge detected, running test with mock data...');
        window.testProgressData();
    }
}, 3000);

// Add manual test function for debugging
window.testProgressData = function() {
    console.log('Testing progress data with mock data...');
    const mockData = {
        stats: {
            totalQuestions: 47,
            avgAccuracy: 61.7,
            avgSpeed: 4.94,
            currentStreak: 5
        },
        mastery: {
            'Addition-1': { level: 'Apprentice', acc: 85, speed: 2.5, count: 25 },
            'Addition-2': { level: 'Novice', acc: 61, speed: 4.0, count: 22 }
        },
        recentActivity: [
            { date: '2026-01-02', timeAgo: 'Today', questions: 47, accuracy: 61.7, avgSpeed: 4.94 }
        ],
        personalBests: {
            'drill': 45.2,
            'sprint': 28,
            'accuracy': 61.7,
            'speed': 2.5
        },
        weaknesses: [],
        achievements: [],
        chartData: [
            { label: 'Mon', accuracy: 65, speed: 5.5 },
            { label: 'Tue', accuracy: 70, speed: 5.2 },
            { label: 'Wed', accuracy: 75, speed: 4.8 },
            { label: 'Thu', accuracy: 72, speed: 5.0 },
            { label: 'Fri', accuracy: 80, speed: 4.5 },
            { label: 'Sat', accuracy: 85, speed: 4.2 },
            { label: 'Sun', accuracy: 88, speed: 4.0 }
        ]
    };
    
    progressPage.progressData = mockData;
    progressPage.updateAllSections();
    console.log('Test data loaded successfully');
};

// Global function for going back
window.goBack = () => progressPage.goBack();

// Handle window resize for chart
window.addEventListener('resize', () => {
    if (progressPage.progressData.chartData) {
        progressPage.updatePerformanceChart();
    }
});

// Auto-test if no Python bridge after 3 seconds
setTimeout(() => {
    if (!window.pythonBridge) {
        console.log('No Python bridge detected, running test with mock data...');
        window.testProgressData();
    }
}, 3000);
