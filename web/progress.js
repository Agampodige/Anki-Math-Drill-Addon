class ProgressPage {
    constructor() {
        this.currentPeriod = 'week';
        this.progressData = {};
        this.chart = null;
        
        this.initElements();
        this.initEventListeners();
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
        
        // Create missing elements if needed
        if (!this.achievementProgress) {
            const achievementCard = document.createElement('div');
            achievementCard.className = 'progress-card';
            achievementCard.innerHTML = `
                <h3>🏆 Achievement Progress</h3>
                <div id="achievementProgress"></div>
            `;
            document.querySelector('.progress-grid').appendChild(achievementCard);
            this.achievementProgress = document.getElementById('achievementProgress');
        }
        
        if (!this.weaknessListLarge) {
            const weaknessCard = document.createElement('div');
            weaknessCard.className = 'progress-card';
            weaknessCard.innerHTML = `
                <h3>🎯 Weakness Analysis</h3>
                <div id="weaknessListLarge"></div>
            `;
            document.querySelector('.progress-grid').insertBefore(
                weaknessCard, 
                document.querySelector('.progress-card:nth-child(2)')
            );
            this.weaknessListLarge = document.getElementById('weaknessListLarge');
        }
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
        console.log('Starting to load progress data...');
        
        try {
            // Check if Python bridge is available
            if (!window.pythonBridge) {
                console.log('Python bridge not available, loading sample data');
                this.loadSampleData();
                return;
            }
            
            console.log('Python bridge available, requesting data...');
            
            // For instant loading, don't show main loading spinner initially
            // Let the cached data handle the display immediately
            
            // Load all progress data from Python
            const data = await this.sendToPythonAsync('get_progress_data', { period: this.currentPeriod });
            
            console.log('Received data:', data);
            
            if (data && typeof data === 'object') {
                this.progressData = data;
                
                // Update all components immediately since data should be cached
                this.updateAllSections();
                
                // Hide any loading indicators
                this.showLoading(false);
                this.showHeavyDataLoading(false);
                
                console.log('Progress data loaded and displayed instantly');
            } else {
                console.log('Invalid data received, loading sample data');
                this.loadSampleData();
            }
            
        } catch (error) {
            console.error('Error loading progress data:', error);
            console.log('Loading sample data as fallback...');
            this.loadSampleData();
        } finally {
            this.showLoading(false);
        }
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
    
    loadSampleData() {
        // Load sample data when Python bridge is not available
        const sampleData = {
            stats: {
                totalQuestions: 0,
                avgAccuracy: 0,
                avgSpeed: 0,
                currentStreak: 0
            },
            mastery: {
                'Addition-1': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Addition-2': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Addition-3': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Subtraction-1': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Subtraction-2': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Subtraction-3': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Multiplication-1': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Multiplication-2': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Multiplication-3': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Division-1': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Division-2': { level: 'Novice', acc: 0, speed: 0, count: 0 },
                'Division-3': { level: 'Novice', acc: 0, speed: 0, count: 0 }
            },
            recentActivity: [],
            personalBests: {},
            weaknesses: [],
            achievements: []
        };
        
        this.progressData = sampleData;
        this.updateAllSections();
    }

    updateAllSections() {
        this.updateStatsOverview();
        this.updateMasteryGrid();
        if (this.weaknessListLarge) {
            this.updateWeaknessAnalysis();
        }
        this.updateRecentActivity();
        if (this.achievementProgress) {
            this.updateAchievementProgress();
        }
        this.updatePersonalBests();
        if (this.chartCanvas) {
            this.updatePerformanceChart();
        }
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
        
        // Hide loading indicators when all components are updated
        if (updatedComponents > 0) {
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
            this.weaknessListLarge.innerHTML = `
                <div style="text-align: center; color: var(--success-color); padding: 20px;">
                    🎉 No weakness data available! Keep up the great work!
                </div>
            `;
            return;
        }
        
        weaknesses.forEach(weakness => {
            const card = document.createElement('div');
            let cardClass = 'weakness-card-large';
            
            if (!weakness.practiced) {
                cardClass += ' unpracticed';
            } else if (weakness.weaknessScore > 70) {
                cardClass += ' high-weakness';
            } else if (weakness.weaknessScore > 50) {
                cardClass += ' medium-weakness';
            } else {
                cardClass += ' low-weakness';
            }
            
            card.className = cardClass;
            
            const scoreText = !weakness.practiced ? 'NEW' : `Score: ${weakness.weaknessScore.toFixed(0)}`;
            const statsText = weakness.practiced ? 
                `Accuracy: ${weakness.accuracy.toFixed(0)}% | Speed: ${weakness.speed.toFixed(1)}s` : 
                'Not practiced yet';
            
            card.innerHTML = `
                <div class="weakness-info">
                    <h4>${weakness.operation} - ${weakness.digits} digits</h4>
                    <p>Level: ${weakness.level}</p>
                    <p>${statsText}</p>
                    ${!weakness.practiced ? '<p class="suggestions">📝 Start here to build foundation skills</p>' : ''}
                    ${weakness.suggestions && weakness.suggestions.length > 0 ? `<p class="suggestions">Tips: ${weakness.suggestions.join(' | ')}</p>` : ''}
                </div>
                <div class="weakness-score">${scoreText}</div>
            `;
            
            this.weaknessListLarge.appendChild(card);
        });
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
        
        if (chartData.length === 0) {
            this.chartCanvas.style.display = 'none';
            const noDataMsg = document.createElement('div');
            noDataMsg.style.cssText = 'text-align: center; color: var(--muted-color); padding: 40px;';
            noDataMsg.textContent = 'No chart data available for the selected period.';
            this.chartCanvas.parentNode.appendChild(noDataMsg);
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
                }, 3000); // Reduced from 5000ms to 3000ms
                
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
}

// Initialize the progress page
const progressPage = new ProgressPage();

// Make progressPage globally available for Python bridge
window.progressPage = progressPage;

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
        achievements: []
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
