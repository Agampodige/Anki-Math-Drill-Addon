// Analytics Manager with Charts
class AnalyticsManager {
    constructor() {
        this.statistics = null;
        this.attempts = [];
        this.charts = {};
        this.currentRange = 7;

        this.initializeEventListeners();
        this.loadStatistics();
    }

    initializeEventListeners() {
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadStatistics());
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('clearBtn')?.addEventListener('click', () => this.clearAllData());

        // Range selector for daily progress
        document.getElementById('progressRangeSelector')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.range-btn');
            if (!btn) return;

            // UI Update
            document.querySelectorAll('#progressRangeSelector .range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Re-render chart
            const days = parseInt(btn.dataset.range);
            this.currentRange = days;
            this.createDailyProgressChart(this.attempts, days);
        });
        // Back button handled by inline onclick in HTML or app.js

        // Listen for bridge connection
        window.addEventListener('pybridge-connected', () => {
            console.log('Analytics: Bridge connected, loading statistics...');
            this.loadStatistics();
        });
    }

    loadStatistics() {
        // Try to get statistics from Python backend first
        if (typeof pybridge !== 'undefined' && pybridge) {
            const message = JSON.stringify({
                type: 'get_statistics',
                payload: {}
            });
            pybridge.sendMessage(message);
        } else {
            // Fallback to localStorage
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('mathDrillAttempts');
        if (saved) {
            const data = JSON.parse(saved);
            this.attempts = data.attempts || [];
            this.calculateStatistics();
        } else {
            this.showEmptyState();
        }
    }

    calculateStatistics() {
        if (this.attempts.length === 0) {
            this.showEmptyState();
            return;
        }

        // Overall statistics
        const totalProblems = this.attempts.length;
        const correctAnswers = this.attempts.filter(a => a.isCorrect).length;
        const overallAccuracy = Math.round((correctAnswers / totalProblems) * 100);
        const totalTime = this.attempts.reduce((sum, a) => sum + a.timeTaken, 0);
        const avgTime = (totalTime / totalProblems).toFixed(1);

        // Update overall stats display
        document.getElementById('totalProblems').textContent = totalProblems;
        document.getElementById('correctAnswers').textContent = correctAnswers;
        document.getElementById('overallAccuracy').textContent = overallAccuracy + '%';
        document.getElementById('avgTime').textContent = avgTime + 's';

        // Calculate statistics by operation
        this.displayOperationStatsFromLocal();

        // Display charts
        this.displayCharts();

        // Render Activity Heatmap (fallback path)
        this.renderActivityHeatmap(this.attempts);
    }

    displayOperationStatsFromLocal() {
        const byOperation = {};
        // Group by operation
        this.attempts.forEach(attempt => {
            const op = attempt.operation;
            if (!byOperation[op]) {
                byOperation[op] = {
                    count: 0,
                    correct: 0,
                    totalTime: 0
                };
            }
            byOperation[op].count++;
            if (attempt.isCorrect) byOperation[op].correct++;
            byOperation[op].totalTime += attempt.timeTaken;
        });

        // Convert to format similar to backend
        const stats = {};
        Object.keys(byOperation).forEach(op => {
            const d = byOperation[op];
            stats[op] = {
                count: d.count,
                correct: d.correct,
                accuracy: (d.correct / d.count) * 100,
                avgTime: d.totalTime / d.count
            };
        });

        this.renderOperationStats(stats);
    }

    displayStatisticsFromBackend(stats) {
        if (stats.error) {
            console.error('Error loading statistics:', stats.error);
            this.loadFromLocalStorage();
            return;
        }

        // Update overall stats
        document.getElementById('totalProblems').textContent = stats.totalAttempts || 0;
        document.getElementById('correctAnswers').textContent = stats.correctCount || 0;
        document.getElementById('overallAccuracy').textContent = Math.round(stats.accuracy || 0) + '%';
        document.getElementById('avgTime').textContent = (stats.averageTime || 0).toFixed(1) + 's';

        // Display operation stats - backend now returns correct structure
        this.renderOperationStats(stats.byOperation || {});

        // Update local attempts with backend data if available so we can use them for everything
        if (stats.attempts && Array.isArray(stats.attempts)) {
            this.attempts = stats.attempts;
        }

        this.displayChartsFromAggregates(stats.byOperation || {});

        // Render trend chart using the attempts we just received
        this.createTrendChart(this.attempts);

        // Render Insights & Streaks
        this.renderInsights(this.attempts, stats.byOperation || {});

        // Render Recent Activity
        this.renderRecentActivity(this.attempts);

        // Render Activity Heatmap
        this.renderActivityHeatmap(this.attempts);

        // Render Daily Progress Chart
        this.createDailyProgressChart(this.attempts, this.currentRange);
    }

    renderActivityHeatmap(attempts) {
        const grid = document.getElementById('heatmapGrid');
        const monthsContainer = document.getElementById('heatmapMonths');
        if (!grid) return;

        grid.innerHTML = '';
        if (monthsContainer) monthsContainer.innerHTML = '';

        try {
            // 1. Process attempts into day map "YYYY-MM-DD" -> count
            const counts = {};
            attempts.forEach(a => {
                let date;
                const ts = a.timestamp || a.date;
                if (!ts) return;

                try {
                    if (typeof ts === 'number') {
                        date = new Date(ts * 1000);
                    } else {
                        date = new Date(ts);
                    }
                    if (isNaN(date.getTime())) return;
                } catch (e) { return; }

                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const dayStr = `${year}-${month}-${day}`;
                counts[dayStr] = (counts[dayStr] || 0) + 1;
            });

            // 2. Generate last 364 days (52 weeks)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const squares = [];
            const monthLabels = [];
            let lastMonth = -1;

            for (let i = 0; i < 364; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() - (363 - i));

                const month = d.getMonth();
                if (month !== lastMonth && i % 7 === 0) {
                    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
                    monthLabels.push({ name: monthName, index: i });
                    lastMonth = month;
                }

                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const dayStr = `${y}-${m}-${dd}`;
                const count = counts[dayStr] || 0;

                let level = 0;
                if (count > 0) level = 1;
                if (count > 4) level = 2;
                if (count > 9) level = 3;
                if (count > 14) level = 4;

                const formattedDate = d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });

                squares.push({ date: dayStr, formattedDate, count, level });
            }

            // 3. Render Month Labels
            if (monthsContainer) {
                monthLabels.forEach(ml => {
                    const el = document.createElement('div');
                    el.className = 'heatmap-month';
                    el.textContent = ml.name;
                    monthsContainer.appendChild(el);
                });
            }

            // 4. Render cells
            squares.forEach(sq => {
                const el = document.createElement('div');
                el.className = 'heatmap-cell';
                el.dataset.level = sq.level;
                el.title = `${sq.formattedDate}: ${sq.count} attempt${sq.count !== 1 ? 's' : ''}`;
                grid.appendChild(el);
            });
        } catch (error) {
            console.error('Error rendering heatmap:', error);
            grid.innerHTML = '<p style="color: #9ca3af; padding: 20px; text-align: center;">Unable to render heatmap</p>';
        }
    }

    renderInsights(attempts, byOperation) {
        // Calculate Streaks
        const streaks = this.calculateStreaks(attempts);
        document.getElementById('currentStreak').textContent = `${streaks.current} Day${streaks.current !== 1 ? 's' : ''}`;
        document.getElementById('bestStreak').textContent = `${streaks.best} Day${streaks.best !== 1 ? 's' : ''}`;

        // Top Operation (Highest Accuracy with significant attempts)
        let topOp = '-';
        let maxAcc = -1;
        Object.entries(byOperation).forEach(([op, data]) => {
            if (data.count >= 5 && data.accuracy > maxAcc) {
                maxAcc = data.accuracy;
                topOp = this.getOperationDisplay(op);
            }
        });
        document.getElementById('topOperation').textContent = topOp;

        // Focus Area (Lowest Accuracy or most incorrect)
        let focusOp = '-';
        let minAcc = 101;
        Object.entries(byOperation).forEach(([op, data]) => {
            if (data.count >= 3 && data.accuracy < minAcc) {
                minAcc = data.accuracy;
                focusOp = this.getOperationDisplay(op);
            }
        });
        document.getElementById('focusArea').textContent = focusOp;
    }

    calculateStreaks(attempts) {
        if (!attempts || attempts.length === 0) return { current: 0, best: 0 };

        const getLocalDateString = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const dates = new Set();
        attempts.forEach(a => {
            const ts = a.timestamp || a.date;
            if (!ts) return;
            const date = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
            if (!isNaN(date.getTime())) {
                dates.add(getLocalDateString(date));
            }
        });

        const sortedDates = Array.from(dates).sort().reverse();
        if (sortedDates.length === 0) return { current: 0, best: 0 };

        // Current Streak
        let current = 0;
        const now = new Date();
        const today = getLocalDateString(now);
        const yesterdayDate = new Date(now);
        yesterdayDate.setDate(now.getDate() - 1);
        const yesterday = getLocalDateString(yesterdayDate);

        let startDateIdx = -1;
        if (sortedDates[0] === today) startDateIdx = 0;
        else if (sortedDates[0] === yesterday) startDateIdx = 0;

        if (startDateIdx !== -1) {
            current = 1;
            for (let i = startDateIdx; i < sortedDates.length - 1; i++) {
                const d1 = new Date(sortedDates[i]);
                const d2 = new Date(sortedDates[i + 1]);
                // Need to use UTC normalization for comparison to avoid DST issues
                d1.setHours(12, 0, 0, 0);
                d2.setHours(12, 0, 0, 0);
                const diff = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
                if (diff === 1) current++;
                else break;
            }
        }

        // Best Streak
        let best = 0;
        let tempStreak = 1;
        const sortedAsc = [...sortedDates].reverse();
        for (let i = 0; i < sortedAsc.length - 1; i++) {
            const d1 = new Date(sortedAsc[i]);
            const d2 = new Date(sortedAsc[i + 1]);
            d1.setHours(12, 0, 0, 0);
            d2.setHours(12, 0, 0, 0);
            const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
            if (diff === 1) tempStreak++;
            else {
                best = Math.max(best, tempStreak);
                tempStreak = 1;
            }
        }
        best = Math.max(best, tempStreak);

        return { current, best };
    }

    renderRecentActivity(attempts) {
        const container = document.getElementById('recentActivityBody');
        if (!container) return;

        if (!attempts || attempts.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="empty-row">No recent activity</td></tr>';
            return;
        }

        // Sort by timestamp descending
        const sorted = [...attempts].sort((a, b) => {
            const t1 = a.timestamp || 0;
            const t2 = b.timestamp || 0;
            return t2 - t1;
        }).slice(0, 10);

        container.innerHTML = sorted.map(a => {
            const date = a.timestamp ?
                new Date(typeof a.timestamp === 'number' ? a.timestamp * 1000 : a.timestamp) :
                new Date();
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${this.getOperationDisplay(a.operation)}</td>
                    <td class="font-mono">${a.problem}</td>
                    <td>
                        <span class="result-tag ${a.isCorrect ? 'correct' : 'incorrect'}">
                            ${a.isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                    </td>
                    <td>${(a.timeTaken || 0).toFixed(1)}s</td>
                </tr>
            `;
        }).join('');
    }

    renderOperationStats(byOperation) {
        const statsHtml = Object.entries(byOperation).map(([op, data]) => {
            const opDisplay = this.getOperationDisplay(op);
            const accuracy = Math.round(data.accuracy);
            const avgTime = data.avgTime.toFixed(1);

            return `
                <div class="stat-card operation-card">
                    <h3>${opDisplay}</h3>
                    <div class="op-stat-grid">
                        <div class="op-stat">
                            <span class="label">Attempts</span>
                            <span class="value">${data.count}</span>
                        </div>
                        <div class="op-stat">
                            <span class="label">Accuracy</span>
                            <span class="value ${accuracy >= 80 ? 'good' : accuracy >= 50 ? 'medium' : 'bad'}">${accuracy}%</span>
                        </div>
                        <div class="op-stat">
                            <span class="label">Time</span>
                            <span class="value">${avgTime}s</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const container = document.getElementById('operationStats');
        if (container) {
            container.innerHTML = statsHtml || '<p class="empty-message">No operation data available</p>';
        }
    }

    getOperationDisplay(op) {
        const displays = {
            'addition': '➕ Addition',
            'subtraction': '➖ Subtraction',
            'multiplication': '✖️ Multiplication',
            'division': '➗ Division',
            'complex': '🔀 Complex'
        };
        return displays[op] || op;
    }

    displayCharts() {
        const byOperation = this.groupByOperation();
        this.displayChartsFromAggregates(this.aggregateFromAttempts(byOperation));
        // Trend chart needs raw attempts
        this.createTrendChart(this.attempts);
        // Daily progress chart
        this.createDailyProgressChart(this.attempts, this.currentRange);
    }

    groupByOperation() {
        const byOperation = {};
        this.attempts.forEach(attempt => {
            const op = attempt.operation;
            if (!byOperation[op]) {
                byOperation[op] = [];
            }
            byOperation[op].push(attempt);
        });
        return byOperation;
    }

    aggregateFromAttempts(byOperation) {
        const agg = {};
        Object.keys(byOperation).forEach(op => {
            const attempts = byOperation[op];
            const correct = attempts.filter(a => a.isCorrect).length;
            const totalTime = attempts.reduce((sum, a) => sum + a.timeTaken, 0);
            agg[op] = {
                count: attempts.length,
                accuracy: (correct / attempts.length) * 100,
                avgTime: totalTime / attempts.length
            };
        });
        return agg;
    }

    displayChartsFromAggregates(byOperation) {
        // Destroy existing charts
        ['accuracy', 'attempts', 'time', 'trend', 'dailyProgress'].forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                this.charts[key] = null;
            }
        });

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            return;
        }

        try {
            const labels = Object.keys(byOperation).map(op => this.getOperationDisplay(op));
            const accuracyData = Object.values(byOperation).map(d => Math.round(d.accuracy));
            const attemptsData = Object.values(byOperation).map(d => d.count);
            const timeData = Object.values(byOperation).map(d => parseFloat(d.avgTime.toFixed(1)));

            // 1. Accuracy Chart (Doughnut)
            const ctxAcc = document.getElementById('accuracyChart');
            if (ctxAcc) {
                this.charts.accuracy = new Chart(ctxAcc, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: accuracyData,
                            backgroundColor: [
                                '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'
                            ],
                            borderWidth: 2,
                            borderColor: 'rgba(255, 255, 255, 0.1)'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    boxWidth: 12,
                                    color: '#e0e0e0',
                                    padding: 10,
                                    font: { size: 11 }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        return context.label + ': ' + context.parsed + '%';
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // 2. Attempts Chart (Bar)
            const ctxAtt = document.getElementById('attemptsChart');
            if (ctxAtt) {
                this.charts.attempts = new Chart(ctxAtt, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Attempts',
                            data: attemptsData,
                            backgroundColor: '#3B82F6',
                            borderRadius: 6,
                            borderSkipped: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: 12,
                                titleColor: '#fff',
                                bodyColor: '#fff'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    precision: 0,
                                    color: '#b0b0b0'
                                },
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.1)'
                                }
                            },
                            x: {
                                ticks: { color: '#b0b0b0' },
                                grid: { display: false }
                            }
                        }
                    }
                });
            }

            // 3. Time Chart (Bar)
            const ctxTime = document.getElementById('timeChart');
            if (ctxTime) {
                this.charts.time = new Chart(ctxTime, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Avg Time (seconds)',
                            data: timeData,
                            backgroundColor: '#F59E0B',
                            borderRadius: 6,
                            borderSkipped: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                padding: 12,
                                callbacks: {
                                    label: function (context) {
                                        return 'Avg Time: ' + context.parsed.y + 's';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { color: '#b0b0b0' },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                            },
                            x: {
                                ticks: { color: '#b0b0b0' },
                                grid: { display: false }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error creating charts:', error);
        }
    }

    // Note: Trend chart requires raw attempts data which we might not have 
    // if loading from backend get_statistics. We'll skip it if no local attempts.
    createTrendChart(attempts) {
        if (!attempts || attempts.length === 0) return;

        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        // Calculate rolling average or bins
        const windowSize = Math.max(5, Math.floor(attempts.length / 10));
        const dataPoints = [];
        const labels = [];

        for (let i = 0; i < attempts.length; i += windowSize) {
            const chunk = attempts.slice(i, i + windowSize);
            const correct = chunk.filter(a => a.isCorrect).length;
            const acc = Math.round((correct / chunk.length) * 100);
            dataPoints.push(acc);
            labels.push(`${i + 1}`);
        }

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Accuracy Trend',
                    data: dataPoints,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
    }

    createDailyProgressChart(attempts, days = 7) {
        if (!attempts || attempts.length === 0) return;

        const ctx = document.getElementById('dailyProgressChart');
        if (!ctx) return;

        // Process attempts into day maps "YYYY-MM-DD" -> count/correct
        const counts = {};
        const correctCounts = {};

        const getLocalDayStr = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        attempts.forEach(a => {
            let date;
            const ts = a.timestamp || a.date;
            if (!ts) return;

            try {
                if (typeof ts === 'number') {
                    date = new Date(ts * 1000);
                } else {
                    date = new Date(ts);
                }
                if (isNaN(date.getTime())) return;
            } catch (e) { return; }

            const dayStr = getLocalDayStr(date);
            counts[dayStr] = (counts[dayStr] || 0) + 1;
            if (a.isCorrect) {
                correctCounts[dayStr] = (correctCounts[dayStr] || 0) + 1;
            }
        });

        // Generate date labels based on range
        const labels = [];
        const totalData = [];
        const correctData = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dayStr = getLocalDayStr(d);

            let label;
            if (days <= 14) {
                // For a few days, show month and day
                label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else if (days <= 91) {
                // For a month or three, show every few days or just day
                if (i % Math.ceil(days / 10) === 0 || i === 0 || i === days - 1) {
                    label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } else {
                    label = '';
                }
            } else {
                // For a year, show month
                if (i % 30 === 0 || i === 0 || i === days - 1) {
                    label = d.toLocaleDateString('en-US', { month: 'short' });
                } else {
                    label = '';
                }
            }

            labels.push(label);
            totalData.push(counts[dayStr] || 0);
            correctData.push(correctCounts[dayStr] || 0);
        }

        if (this.charts.dailyProgress) {
            this.charts.dailyProgress.destroy();
        }

        this.charts.dailyProgress = new Chart(ctx, {
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Correct Cards',
                        data: correctData,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        order: 1,
                        z: 10
                    },
                    {
                        type: 'bar',
                        label: 'Total Attempts',
                        data: totalData,
                        backgroundColor: '#8B5CF6',
                        borderRadius: 4,
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e0e0e0',
                            font: { size: 10 },
                            usePointStyle: true,
                            padding: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0, color: '#b0b0b0' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        ticks: {
                            color: '#b0b0b0',
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 0
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    exportData() {
        try {
            // Ask user for format
            const format = prompt('Export format: Enter "json" or "csv"', 'json');

            if (!format) return; // User cancelled

            if (format.toLowerCase() === 'csv') {
                this.exportCSV();
            } else {
                this.exportJSON();
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export data. Please try again.');
        }
    }

    exportJSON() {
        const timestamp = new Date().toISOString().split('T')[0];
        const dataStr = JSON.stringify({
            exportDate: new Date().toISOString(),
            totalAttempts: this.attempts.length,
            attempts: this.attempts
        }, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `math-drill-data-${timestamp}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    exportCSV() {
        if (this.attempts.length === 0) {
            alert('No data to export');
            return;
        }

        // CSV header
        const headers = ['ID', 'Operation', 'Problem', 'User Answer', 'Correct Answer', 'Is Correct', 'Time Taken (s)', 'Timestamp'];
        let csv = headers.join(',') + '\n';

        // CSV rows
        this.attempts.forEach(a => {
            const row = [
                a.id || '',
                a.operation || '',
                `"${a.problem || ''}"`,
                a.userAnswer || '',
                a.correctAnswer || '',
                a.isCorrect ? 'Yes' : 'No',
                (a.timeTaken || 0).toFixed(2),
                a.timestamp ? (typeof a.timestamp === 'number' ? new Date(a.timestamp * 1000).toISOString() : new Date(a.timestamp).toISOString()) : ''
            ];
            csv += row.join(',') + '\n';
        });

        const timestamp = new Date().toISOString().split('T')[0];
        const dataBlob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `math-drill-data-${timestamp}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    showEmptyState() {
        document.getElementById('totalProblems').textContent = '0';
        document.getElementById('operationStats').innerHTML = '<p class="empty-message">No practice attempts yet.</p>';
        // Clear charts
        ['accuracy', 'attempts', 'time', 'trend'].forEach(k => {
            if (this.charts[k]) this.charts[k].destroy();
        });
    }

    clearAllData() {
        if (confirm('Delete all data?')) {
            localStorage.removeItem('mathDrillAttempts');
            if (typeof pybridge !== 'undefined' && pybridge) {
                pybridge.sendMessage(JSON.stringify({ type: 'clear_attempts', payload: {} }));
            }
            this.attempts = [];
            this.showEmptyState();
        }
    }
}

// Handle messages from Python backend
window.handleBackendMessage = function (message) {
    try {
        const data = JSON.parse(message);
        if (data.type === 'statistics_response' && window.analyticsManager) {
            window.analyticsManager.displayStatisticsFromBackend(data.payload);
        }
    } catch (e) {
        console.error('Bridge error:', e);
    }
};

document.addEventListener('DOMContentLoaded', function () {
    window.analyticsManager = new AnalyticsManager();
});
