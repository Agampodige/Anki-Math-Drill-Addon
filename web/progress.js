class ProgressPage {
    constructor() {
        // Don't initialize immediately - wait for bridge
        this.initialized = false;
        this.currentPeriod = 'week';
        this.heatmapView = 'month'; // 'month' or 'year'
        this.progressData = {};
        this.chart = null;
        this.hasReceivedBackendData = false; // Track if we got data from backend

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
        this.velocityContainer = document.getElementById('velocityContainer');
        this.activityHeatmap = document.getElementById('activityHeatmap');
        this.adaptiveInsightsCard = document.getElementById('adaptiveInsightsCard');
        this.adaptiveInsightsList = document.getElementById('adaptiveInsightsList');

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

        // Graph Toggles
        document.getElementById('toggleAccuracy')?.addEventListener('change', () => this.updatePerformanceChart());
        document.getElementById('toggleSpeed')?.addEventListener('change', () => this.updatePerformanceChart());
        document.getElementById('toggleQuestions')?.addEventListener('change', () => this.updatePerformanceChart());

        // Period selector buttons
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                // Reload progress data for the new period
                this.loadProgressData();
            });
        });

        // Heatmap Toggles
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.heatmapView = e.target.dataset.view;
                this.renderActivityHeatmap();
            });
        });

        // Window Resize
        window.addEventListener('resize', () => {
            if (this.progressData.chartData) {
                this.updatePerformanceChart();
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
                new Promise((_, reject) => setTimeout(() => reject(new Error('Bridge timeout')), 2000)) // Increased to 2000ms to allow push to arrive
            ]);

            console.log('📊 Received data:', data);

            // If we got data back, display it.
            if (data && Object.keys(data).length > 0) {
                console.log('⚡ Displaying data instantly.');
                this.progressData = data;
                this.hasReceivedBackendData = true; // Mark that we've received data from the backend
                this.updateAllSections();
                this.showLoading(false);
                // Heavy data spinners will be turned off by updateHeavyData when it's pushed
            } else {
                // No data yet, we are waiting for a push from Python.
                console.log('⏳ No data received. Waiting for data push from Python.');
            }

        } catch (error) {
            // Wait a bit before falling back to give the backend push a chance to arrive
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check if we already received data via push before falling back
            if (this.hasReceivedBackendData || (this.progressData && this.progressData.chartData && this.progressData.chartData.length > 0)) {
                console.log('✅ Already have data from backend push, skipping fallback');
                this.showLoading(false);
                this.showHeavyDataLoading(false);
                return;
            }

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
                fetch('../data/attempts.json'),
                fetch('../data/sessions.json').catch(() => ({ ok: false })) // Optional sessions file
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
            const operations = ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Linear Algebra'];

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

            // Create continuous timeline chart data matching backend behavior
            // Determine days range based on current period
            let daysRange = 7; // default to week
            if (this.currentPeriod === 'month') daysRange = 30;
            else if (this.currentPeriod === 'year') daysRange = 365;
            else if (this.currentPeriod === 'all') daysRange = 730;

            const chartData = [];
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);

            // Create continuous timeline for the period
            for (let i = daysRange - 1; i >= 0; i--) {
                const chartDate = new Date(currentDate);
                chartDate.setDate(currentDate.getDate() - i);
                const dateStr = chartDate.toISOString().split('T')[0];

                // Find matching daily data
                const dayStats = dailyStats.get(dateStr);

                // Determine label format
                let label;
                if (daysRange <= 7) {
                    label = chartDate.toLocaleDateString('en', { weekday: 'short' });
                } else {
                    label = chartDate.toLocaleDateString('en', { month: '2-digit', day: '2-digit' });
                }

                if (dayStats) {
                    // Real data available
                    chartData.push({
                        date: dateStr,
                        label: label,
                        accuracy: (dayStats.correct / dayStats.count) * 100,
                        speed: dayStats.timeSum / dayStats.count,
                        questions: dayStats.count
                    });
                } else {
                    // No data for this day - show as zero
                    chartData.push({
                        date: dateStr,
                        label: label,
                        accuracy: 0,
                        speed: 0,
                        questions: 0
                    });
                }
            }


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
            this.hasReceivedBackendData = true; // Mark that we received backend data

            // Update fast sections
            this.updateStatsOverview();
            this.updateRecentActivity();
            if (this.chartCanvas) {
                this.updatePerformanceChart();
            }

            // New Analytics sections
            this.updateLearningVelocity();
            this.renderActivityHeatmap();
            this.updateAdaptiveInsights();

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
                        ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Linear Algebra'].forEach(op => {
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

                    // New Analytics
                    this.updateLearningVelocity();
                    this.renderActivityHeatmap();
                    this.updateAdaptiveInsights();
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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 class="section-title" style="margin-bottom: 0; font-weight: 700;">Operation Performance</h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                ${operationBreakdown.map(op => {
            const acc = (op.correct / op.count) * 100;
            return `
                    <div style="padding: 16px; background: var(--surface-glass); border: var(--border-glass); border-radius: 12px; transition: transform 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="font-weight: 700; color: var(--text-primary);">${op.operation}</div>
                            <div style="font-size: 12px; color: var(--text-tertiary);">${op.count} Qs</div>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                                <span style="color: var(--text-secondary);">Accuracy</span>
                                <span style="color: var(--success); font-weight: 600;">${acc.toFixed(1)}%</span>
                            </div>
                            <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                                <div style="height: 100%; width: ${acc}%; background: var(--success); border-radius: 3px;"></div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 12px;">
                            <span style="color: var(--text-secondary);">Avg Speed</span>
                            <span style="color: var(--warning); font-weight: 600;">${(op.avg_time || 0).toFixed(2)}s</span>
                        </div>
                    </div>
                `}).join('')}
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
        ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Linear Algebra'].forEach(op => {
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
        switch (level.toLowerCase()) {
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

    getFilteredChartData() {
        const allChartData = this.progressData.chartData || [];

        console.log('🔍 Chart data debug:', {
            totalData: allChartData.length,
            currentPeriod: this.currentPeriod,
            sampleData: allChartData.slice(0, 3),
            fullSample: allChartData.slice(0, 1).map(d => ({
                date: d.date,
                label: d.label,
                accuracy: d.accuracy,
                speed: d.speed,
                questions: d.questions
            }))
        });

        // The backend already filters data by period, so we just return it
        // But we still need to handle the case where frontend period differs from backend
        if (allChartData.length === 0) {
            console.warn('⚠️ No chart data available');
            return [];
        }

        // For performance, if we have too many data points, sample them intelligently
        const maxPoints = 100; // Increased back to 100 for better data resolution
        if (allChartData.length > maxPoints) {
            // Use smart sampling that preserves important data points
            const step = Math.ceil(allChartData.length / maxPoints);
            const sampled = [];

            // Always include first and last points
            sampled.push(allChartData[0]);

            // Sample intermediate points
            for (let i = step; i < allChartData.length - 1; i += step) {
                sampled.push(allChartData[i]);
            }

            // Always include last point if not already included
            if (sampled[sampled.length - 1] !== allChartData[allChartData.length - 1]) {
                sampled.push(allChartData[allChartData.length - 1]);
            }

            console.log(`📊 Smart data sampling: ${allChartData.length} -> ${sampled.length} points`);
            return sampled;
        }

        return allChartData;
    }

    drawBaseChart(ctx, width, height, padding, chartData, showAccuracy, showSpeed, showQuestions) {
        console.log('🎨 drawBaseChart called:', {
            chartDataLength: chartData.length,
            showAccuracy,
            showSpeed,
            showQuestions,
            canvasSize: { width, height },
            firstDataPoint: chartData[0],
            lastDataPoint: chartData[chartData.length - 1]
        });

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Get Toggle States
        const labels = chartData.map(d => d.label);
        const accuracyData = chartData.map(d => d.accuracy);
        const speedData = chartData.map(d => d.speed);
        const questionsData = chartData.map(d => d.questions || 0);

        console.log('🎨 Processed data arrays:', {
            labelsCount: labels.length,
            accuracyDataSample: accuracyData.slice(0, 3),
            speedDataSample: speedData.slice(0, 3),
            questionsDataSample: questionsData.slice(0, 3)
        });

        // Validate data before drawing
        if (chartData.length === 0 || !chartData[0]) {
            console.warn('⚠️ No valid chart data to draw');
            return;
        }

        // Check if all data points have valid values
        const invalidPoints = chartData.filter(d =>
            typeof d.accuracy !== 'number' ||
            typeof d.speed !== 'number' ||
            typeof d.questions !== 'number'
        );

        if (invalidPoints.length > 0) {
            console.warn('⚠️ Invalid data points found:', invalidPoints.length);
        }

        const maxAccuracy = 100; // Always 100%
        const maxSpeed = Math.max(...speedData, 10) * 1.2; // Add some headroom
        const maxQuestions = Math.max(...questionsData, 20) * 1.2;

        console.log('🎨 Chart bounds:', { maxAccuracy, maxSpeed, maxQuestions });

        const chartWidth = width - (padding.left + padding.right);
        const chartHeight = height - (padding.top + padding.bottom);

        // Helper: Get X and Y coordinates
        const getX = (index) => padding.left + (index / (labels.length - 1)) * chartWidth;
        const getYAccuracy = (val) => padding.top + chartHeight - (val / maxAccuracy) * chartHeight;
        const getYSpeed = (val) => padding.top + chartHeight - (val / maxSpeed) * chartHeight;
        const getYQuestions = (val) => padding.top + chartHeight - (val / maxQuestions) * chartHeight;

        // Draw Grid & Axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        // Horizontal Grid
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }

        // Draw Questions Line (Background layer)
        if (showQuestions) {
            ctx.strokeStyle = '#818cf8'; // Primary indigo
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            questionsData.forEach((value, index) => {
                const x = getX(index);
                const y = getYQuestions(value);
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Draw gradient fill
            const gradQuest = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
            gradQuest.addColorStop(0, 'rgba(129, 140, 248, 0.2)');
            gradQuest.addColorStop(1, 'rgba(129, 140, 248, 0.0)');
            ctx.lineTo(getX(questionsData.length - 1), height - padding.bottom);
            ctx.lineTo(getX(0), height - padding.bottom);
            ctx.fillStyle = gradQuest;
            ctx.fill();

            // Draw Points
            ctx.fillStyle = '#818cf8';
            questionsData.forEach((value, index) => {
                const x = getX(index);
                const y = getYQuestions(value);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw Accuracy Line
        if (showAccuracy) {
            ctx.strokeStyle = '#2ECC71'; // Success Color
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            accuracyData.forEach((value, index) => {
                const x = getX(index);
                const y = getYAccuracy(value);
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Draw gradient fill
            const gradAcc = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
            gradAcc.addColorStop(0, 'rgba(46, 204, 113, 0.2)');
            gradAcc.addColorStop(1, 'rgba(46, 204, 113, 0.0)');
            ctx.lineTo(getX(accuracyData.length - 1), height - padding.bottom);
            ctx.lineTo(getX(0), height - padding.bottom);
            ctx.fillStyle = gradAcc;
            ctx.fill();

            // Draw Points
            ctx.fillStyle = '#2ECC71';
            accuracyData.forEach((value, index) => {
                const x = getX(index);
                const y = getYAccuracy(value);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw Speed Line
        if (showSpeed) {
            ctx.strokeStyle = '#e0af68'; // Warning Color
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            speedData.forEach((value, index) => {
                const x = getX(index);
                const y = getYSpeed(value);
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Draw Points
            ctx.fillStyle = '#e0af68';
            speedData.forEach((value, index) => {
                const x = getX(index);
                const y = getYSpeed(value);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';

        labels.forEach((label, index) => {
            // Show all labels if few, otherwise skip
            if (labels.length <= 7 || index % Math.ceil(labels.length / 7) === 0) {
                const x = getX(index);
                ctx.fillText(label, x, height - 10);
            }
        });

        console.log('✅ Chart drawing completed successfully', {
            linesDrawn: showAccuracy ? 1 : 0 + showSpeed ? 1 : 0 + showQuestions ? 1 : 0,
            totalLabels: labels.length,
            canvasState: 'drawn'
        });
    }

    updatePerformanceChart() {
        const chartData = this.getFilteredChartData();
        const container = this.chartCanvas.parentNode;
        const tooltip = document.getElementById('chartTooltip');

        console.log('🎨 Chart Update Debug:', {
            chartDataLength: chartData.length,
            chartDataSample: chartData.slice(0, 2),
            canvasExists: !!this.chartCanvas,
            containerExists: !!container
        });

        // Remove any existing no-data message
        const existingMsg = container.querySelector('.no-data-msg');
        if (existingMsg) {
            existingMsg.remove();
        }

        if (chartData.length === 0) {
            if (this.chartCanvas) {
                this.chartCanvas.style.display = 'none';
            }
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'no-data-msg';
            noDataMsg.style.cssText = 'text-align: center; color: var(--text-tertiary); padding: 40px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed var(--border-color);';
            noDataMsg.textContent = 'No data available for the selected period.';
            if (container) {
                container.appendChild(noDataMsg);
            }
            return;
        }

        // Check if any metric is actually active
        const showAccuracy = document.getElementById('toggleAccuracy')?.checked ?? true;
        const showSpeed = document.getElementById('toggleSpeed')?.checked ?? true;
        const showQuestions = document.getElementById('toggleQuestions')?.checked ?? true;

        console.log('🎛 Toggle States Debug:', {
            showAccuracy,
            showSpeed,
            showQuestions,
            accuracyElement: document.getElementById('toggleAccuracy'),
            speedElement: document.getElementById('toggleSpeed'),
            questionsElement: document.getElementById('toggleQuestions')
        });

        if (!showAccuracy && !showSpeed && !showQuestions) {
            if (this.chartCanvas) {
                this.chartCanvas.style.display = 'none';
            }
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'no-data-msg';
            noDataMsg.style.cssText = 'text-align: center; color: var(--text-tertiary); padding: 40px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px dashed var(--border-color);';
            noDataMsg.textContent = 'Please select at least one metric to display.';
            if (container) {
                container.appendChild(noDataMsg);
            }
            return;
        }

        if (this.chartCanvas) {
            this.chartCanvas.style.display = 'block';
        }

        // Canvas Setup
        const ctx = this.chartCanvas.getContext('2d');
        const canvas = this.chartCanvas;

        console.log('🎨 Canvas Setup Debug:', {
            ctx: !!ctx,
            canvas: !!canvas,
            canvasRect: canvas ? canvas.getBoundingClientRect() : null,
            containerRect: container ? container.getBoundingClientRect() : null
        });

        // Use container dimensions for responsiveness
        const rect = container.getBoundingClientRect();
        console.log('🎨 Container Rect:', rect);

        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = 250 * dpr; // Fixed height in CSS is 250px
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = '250px';
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = 250;
        const padding = { top: 20, right: 40, bottom: 30, left: 40 };

        console.log('🎨 Canvas Dimensions:', { width, height, dpr, padding });

        // Helper functions for hover interaction
        const chartWidth = width - (padding.left + padding.right);
        const chartHeight = height - (padding.top + padding.bottom);
        const labels = chartData.map(d => d.label);
        const accuracyData = chartData.map(d => d.accuracy);
        const speedData = chartData.map(d => d.speed);
        const questionsData = chartData.map(d => d.questions || 0);
        const maxAccuracy = 100;
        const maxSpeed = Math.max(...speedData, 10) * 1.2;
        const maxQuestions = Math.max(...questionsData, 20) * 1.2;

        console.log('🎨 Data Mapping Debug:', {
            chartDataLength: chartData.length,
            labels: labels.slice(0, 3),
            accuracyData: accuracyData.slice(0, 3),
            speedData: speedData.slice(0, 3),
            questionsData: questionsData.slice(0, 3),
            chartDimensions: { chartWidth, chartHeight }
        });

        const getX = (index) => padding.left + (index / (labels.length - 1)) * chartWidth;
        const getYAccuracy = (val) => padding.top + chartHeight - (val / maxAccuracy) * chartHeight;
        const getYSpeed = (val) => padding.top + chartHeight - (val / maxSpeed) * chartHeight;
        const getYQuestions = (val) => padding.top + chartHeight - (val / maxQuestions) * chartHeight;

        // Use the new drawBaseChart method
        this.drawBaseChart(ctx, width, height, padding, chartData, showAccuracy, showSpeed, showQuestions);

        // Add fallback display if chart data exists but canvas might not be visible
        if (chartData.length > 0) {
            console.log('🎨 Chart rendered with data:', {
                dataPoints: chartData.length,
                firstPoint: chartData[0],
                lastPoint: chartData[chartData.length - 1]
            });

            // Force canvas to be visible
            if (this.chartCanvas) {
                this.chartCanvas.style.display = 'block';
                this.chartCanvas.style.visibility = 'visible';
            }
        }

        // -----------------------
        // Interaction (Tooltips)
        // -----------------------
        // Remove old listener to avoid duplicates
        if (this._chartMoveHandler) {
            canvas.removeEventListener('mousemove', this._chartMoveHandler);
            canvas.removeEventListener('mouseleave', this._chartLeaveHandler);
        }

        this._chartMoveHandler = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left);
            const mouseY = (e.clientY - rect.top);

            let found = false;
            let closestIndex = -1;
            let closestDistance = Infinity;

            // Find closest point with better accuracy
            chartData.forEach((item, index) => {
                const x = getX(index);
                const distance = Math.abs(mouseX - x);

                // Check if mouse is near this X column (within half the column width)
                const columnWidth = chartWidth / Math.max(labels.length - 1, 1);
                if (distance < columnWidth / 2 && distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = index;
                    found = true;
                }
            });

            if (found && closestIndex >= 0 && tooltip) {
                const item = chartData[closestIndex];

                // Better tooltip positioning - keep within viewport
                let tooltipX = e.clientX + 10;
                let tooltipY = e.clientY + 10;

                // Prevent tooltip from going off screen
                if (tooltipX + 200 > window.innerWidth) {
                    tooltipX = e.clientX - 210;
                }
                if (tooltipY + 150 > window.innerHeight) {
                    tooltipY = e.clientY - 160;
                }

                tooltip.style.display = 'block';
                tooltip.style.left = `${tooltipX}px`;
                tooltip.style.top = `${tooltipY}px`;

                let content = `<strong>${item.label || 'N/A'}</strong><br>`;

                // Add data validation and better formatting
                if (showAccuracy && typeof item.accuracy === 'number' && !isNaN(item.accuracy)) {
                    content += `<span style="color:#2ECC71">●</span> Accuracy: ${item.accuracy.toFixed(1)}%<br>`;
                }
                if (showSpeed && typeof item.speed === 'number' && !isNaN(item.speed) && item.speed > 0) {
                    content += `<span style="color:#e0af68">●</span> Speed: ${item.speed.toFixed(2)}s<br>`;
                }
                if (showQuestions && typeof item.questions === 'number' && !isNaN(item.questions) && item.questions >= 0) {
                    content += `<span style="color:#818cf8">●</span> Questions: ${item.questions}`;
                }

                // If no valid data found, show a message
                if (content === `<strong>${item.label || 'N/A'}</strong><br>`) {
                    content += '<span style="color:#888">No data available</span>';
                }

                tooltip.innerHTML = content;

                // Store original chart data to avoid recursion
                const originalChartData = chartData;
                const originalShowAccuracy = showAccuracy;
                const originalShowSpeed = showSpeed;
                const originalShowQuestions = showQuestions;

                // Redraw the base chart without highlights
                this.drawBaseChart(ctx, width, height, padding, originalChartData, originalShowAccuracy, originalShowSpeed, originalShowQuestions);

                // Then add visual feedback - highlight the point and draw vertical line
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                const highlightX = getX(closestIndex);

                // Draw vertical line at hover position
                ctx.beginPath();
                ctx.moveTo(highlightX, padding.top);
                ctx.lineTo(highlightX, height - padding.bottom);
                ctx.stroke();
                ctx.restore();

                // Draw highlight circle at the data point
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
                ctx.lineWidth = 2;

                // Highlight each active metric point with validation
                if (showAccuracy && typeof item.accuracy === 'number' && !isNaN(item.accuracy)) {
                    const y = getYAccuracy(item.accuracy);
                    ctx.beginPath();
                    ctx.arc(highlightX, y, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                if (showSpeed && typeof item.speed === 'number' && !isNaN(item.speed) && item.speed > 0) {
                    const y = getYSpeed(item.speed);
                    ctx.beginPath();
                    ctx.arc(highlightX, y, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                if (showQuestions && typeof item.questions === 'number' && !isNaN(item.questions) && item.questions >= 0) {
                    const y = getYQuestions(item.questions);
                    ctx.beginPath();
                    ctx.arc(highlightX, y, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.restore();
            } else {
                if (tooltip) tooltip.style.display = 'none';
                // Redraw base chart to clear highlights when mouse leaves
                if (chartData.length > 0) {
                    this.drawBaseChart(ctx, width, height, padding, chartData, showAccuracy, showSpeed, showQuestions);
                }
            }
        };

        this._chartLeaveHandler = () => {
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        };

        canvas.addEventListener('mousemove', this._chartMoveHandler);
        canvas.addEventListener('mouseleave', this._chartLeaveHandler);
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

    updateLearningVelocity() {
        if (!this.velocityContainer) return;

        const v = this.progressData.learningVelocity || {};
        const velocity = {
            velocity_score: Number(v.velocity_score) || 0,
            improvement_rate: Number(v.improvement_rate) || 0,
            consistency_score: Number(v.consistency_score) || 0,
            trend: v.trend || 'stable'
        };

        let trendColor = 'var(--text-secondary)';
        let trendIcon = '➡️';

        if (velocity.trend === 'improving') {
            trendColor = 'var(--success)';
            trendIcon = '📈';
        } else if (velocity.trend === 'declining') {
            trendColor = 'var(--error)';
            trendIcon = '📉';
        }

        this.velocityContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                <span style="font-size: 14px; color: var(--text-secondary);">Overall Velocity</span>
                <span style="font-size: 18px; font-weight: 700; color: var(--primary);">${velocity.velocity_score.toFixed(1)}</span>
            </div>
            <div style="display: flex; gap: 8px;">
                <div style="flex: 1; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase;">Growth</div>
                    <div style="font-size: 16px; font-weight: 600; color: ${velocity.improvement_rate >= 0 ? 'var(--success)' : 'var(--error)'};">${velocity.improvement_rate >= 0 ? '+' : ''}${velocity.improvement_rate.toFixed(1)}%</div>
                </div>
                <div style="flex: 1; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase;">Consistency</div>
                    <div style="font-size: 16px; font-weight: 600; color: var(--accent);">${velocity.consistency_score.toFixed(0)}</div>
                </div>
            </div>
            <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span style="font-size: 14px; color: var(--text-secondary);">Current Trend:</span>
                <span style="font-weight: 600; color: ${trendColor};">${trendIcon} ${velocity.trend.toUpperCase()}</span>
            </div>
        `;
    }

    renderActivityHeatmap() {
        console.log('🔥 Heatmap Debug: this.activityHeatmap element:', this.activityHeatmap);
        if (!this.activityHeatmap) {
            console.log('🔥 Heatmap Debug: activityHeatmap element not found!');
            return;
        }

        // Use daily attempts data instead of goal history
        const recentActivity = this.progressData.recentActivity || [];
        console.log('🔥 Heatmap Debug: recentActivity length:', recentActivity.length);
        console.log('🔥 Heatmap Debug: recentActivity data:', recentActivity);
        const heatmapData = new Map();

        // Populate heatmap with daily attempt counts
        recentActivity.forEach(item => {
            heatmapData.set(item.date, item.questions || 0);
        });

        // Update debug to show actual data being used
        console.log('🔥 Heatmap Debug: Using daily attempts data, values:', Array.from(heatmapData.values()));

        // Determine timeframe
        const isYear = this.heatmapView === 'year';
        const dayCount = isYear ? 364 : 28; // Multiples of 7 (52 weeks or 4 weeks)

        // Generate all required dates for the timeframe
        const today = new Date();
        const dates = [];
        for (let i = dayCount - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dates.push(`${year}-${month}-${day}`);
        }

        // Populate heatmap with daily attempt counts
        recentActivity.forEach(item => {
            heatmapData.set(item.date, item.questions || 0);
        });

        // Find max value for dynamic scaling
        const values = Array.from(heatmapData.values());
        const maxVal = Math.max(...values, 10); // Maintain a minimum scale

        this.activityHeatmap.innerHTML = '';

        // Update Grid layout
        if (this.activityHeatmap) {
            if (isYear) {
                this.activityHeatmap.style.gridTemplateColumns = 'repeat(52, 1fr)';
                this.activityHeatmap.style.maxWidth = '1000px';
                this.activityHeatmap.style.gap = '2px';
            } else {
                this.activityHeatmap.style.gridTemplateColumns = 'repeat(7, 1fr)';
                this.activityHeatmap.style.maxWidth = '250px';
                this.activityHeatmap.style.gap = '6px';
            }
        }

        dates.forEach(date => {
            const count = heatmapData.get(date) || 0;
            const cell = document.createElement('div');
            cell.style.aspectRatio = '1';
            cell.style.borderRadius = isYear ? '1px' : '2px';
            cell.title = `${date}: ${count} questions`;

            // Dynamic color intensity based on max volume
            if (count === 0) {
                cell.style.background = 'rgba(255,255,255,0.03)';
                cell.style.border = isYear ? 'none' : '1px solid rgba(255,255,255,0.08)';
            } else {
                // Calculate opacity based on percentage of max volume
                // Minimum 0.2 opacity for any activity, up to 1.0
                const intensity = 0.2 + (Math.min(count / maxVal, 1) * 0.8);
                cell.style.background = `rgba(52, 211, 153, ${intensity})`; // Using --success color Emerald 400
                if (!isYear) {
                    cell.style.boxShadow = `0 0 4px rgba(52, 211, 153, ${intensity * 0.3})`;
                }
            }

            if (this.activityHeatmap) {
                this.activityHeatmap.appendChild(cell);
            }
        });
        console.log('🔥 Heatmap Debug: Render completed, cells created:', dates.length);
    }

    updateAdaptiveInsights() {
        if (!this.adaptiveInsightsList) return;

        const insights = this.progressData.adaptiveInsights || {};
        const suggestions = insights.suggestions || [];

        if (suggestions.length === 0) {
            if (this.adaptiveInsightsCard) {
                this.adaptiveInsightsCard.style.display = 'none';
            }
            return;
        }

        if (this.adaptiveInsightsCard) {
            this.adaptiveInsightsCard.style.display = 'block';
        }
        if (this.adaptiveInsightsList) {
            this.adaptiveInsightsList.innerHTML = '';
        }

        suggestions.slice(0, 3).forEach(suggestion => {
            const card = document.createElement('div');
            card.style.cssText = 'padding: 12px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid var(--accent);';
            card.innerHTML = `
                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 14px;">${suggestion.title || 'Recommendation'}</div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">${suggestion.text || suggestion}</div>
            `;
            if (this.adaptiveInsightsList) {
                this.adaptiveInsightsList.appendChild(card);
            }
        });
    }
}

// Global function for Python to call
window.updateFromPython = function (action, data) {
    if (window.progressPage) {
        switch (action) {
            case 'updateProgress':
                window.progressPage.loadProgressData();
                break;
            case 'updateStats':
                window.progressPage.updateStatsOverview();
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
window.testProgressData = function () {
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



// Instantiate the ProgressPage
const progressPage = new ProgressPage();
window.progressPage = progressPage;
