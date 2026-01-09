// Analytics Manager with Charts
class AnalyticsManager {
    constructor() {
        this.statistics = null;
        this.attempts = [];
        this.charts = {};
        
        this.initializeEventListeners();
        this.loadStatistics();
    }

    initializeEventListeners() {
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadStatistics());
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('clearBtn')?.addEventListener('click', () => this.clearAllData());
        document.getElementById('backBtn')?.addEventListener('click', () => navigateToHome());
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
        const avgTime = (totalTime / totalProblems).toFixed(2);

        // Calculate streak
        let streak = 0;
        for (let i = this.attempts.length - 1; i >= 0; i--) {
            if (this.attempts[i].isCorrect) {
                streak++;
            } else {
                break;
            }
        }

        // Best accuracy in recent attempts (last 10)
        const recentAttempts = this.attempts.slice(-10);
        const bestAccuracy = recentAttempts.length > 0 
            ? Math.round((recentAttempts.filter(a => a.isCorrect).length / recentAttempts.length) * 100)
            : 0;

        // Update overall stats display
        document.getElementById('totalProblems').textContent = totalProblems;
        document.getElementById('correctAnswers').textContent = correctAnswers;
        document.getElementById('overallAccuracy').textContent = overallAccuracy + '%';
        document.getElementById('avgTime').textContent = avgTime + 's';
        document.getElementById('currentStreak').textContent = streak;
        document.getElementById('bestAccuracy').textContent = bestAccuracy + '%';

        // Calculate statistics by operation
        this.displayOperationStats();

        // Display charts
        this.displayCharts();

        // Display recent attempts
        this.displayRecentAttempts();
    }

    displayOperationStats() {
        const byOperation = {};

        // Group by operation
        this.attempts.forEach(attempt => {
            const op = attempt.operation;
            if (!byOperation[op]) {
                byOperation[op] = {
                    count: 0,
                    correct: 0,
                    totalTime: 0,
                    items: []
                };
            }
            
            byOperation[op].count++;
            if (attempt.isCorrect) byOperation[op].correct++;
            byOperation[op].totalTime += attempt.timeTaken;
            byOperation[op].items.push(attempt);
        });

        // Create operation stats HTML
        const statsHtml = Object.entries(byOperation).map(([op, data]) => {
            const accuracy = Math.round((data.correct / data.count) * 100);
            const avgTime = (data.totalTime / data.count).toFixed(2);
            const opDisplay = this.getOperationDisplay(op);

            return `
                <div class="operation-stat-card">
                    <h3>${opDisplay}</h3>
                    <div class="stat-row">
                        <span>Attempts:</span> <strong>${data.count}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Correct:</span> <strong>${data.correct}/${data.count}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Accuracy:</span> <strong>${accuracy}%</strong>
                    </div>
                    <div class="stat-row">
                        <span>Avg Time:</span> <strong>${avgTime}s</strong>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('operationStats').innerHTML = statsHtml || '<p>No data available</p>';
    }

    displayCharts() {
        const byOperation = this.groupByOperation();
        
        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};

        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded yet, charts will be available after page reload');
            return;
        }

        // 1. Accuracy by Operation
        this.createAccuracyChart(byOperation);

        // 2. Attempts by Operation
        this.createAttemptsChart(byOperation);

        // 3. Average Time by Operation
        this.createTimeChart(byOperation);

        // 4. Accuracy Trend
        this.createTrendChart();
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

    createAccuracyChart(byOperation) {
        const labels = Object.keys(byOperation).map(op => this.getOperationDisplay(op));
        const data = Object.values(byOperation).map(attempts => {
            const correct = attempts.filter(a => a.isCorrect).length;
            return Math.round((correct / attempts.length) * 100);
        });

        const ctx = document.getElementById('accuracyChart');
        if (!ctx) return;

        this.charts.accuracy = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                        '#FF9F40', '#FF6384', '#C9CBCF'
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 15, font: { size: 12 } }
                    },
                    title: { display: true, text: 'Accuracy by Operation (%)', padding: 15 }
                }
            }
        });
    }

    createAttemptsChart(byOperation) {
        const labels = Object.keys(byOperation).map(op => this.getOperationDisplay(op));
        const data = Object.values(byOperation).map(attempts => attempts.length);

        const ctx = document.getElementById('attemptsChart');
        if (!ctx) return;

        this.charts.attempts = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Attempts',
                    data: data,
                    backgroundColor: '#3498db',
                    borderColor: '#2980b9',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    createTimeChart(byOperation) {
        const labels = Object.keys(byOperation).map(op => this.getOperationDisplay(op));
        const data = Object.values(byOperation).map(attempts => {
            const avgTime = attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length;
            return parseFloat(avgTime.toFixed(2));
        });

        const ctx = document.getElementById('timeChart');
        if (!ctx) return;

        this.charts.time = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Time (seconds)',
                    data: data,
                    backgroundColor: '#2ecc71',
                    borderColor: '#27ae60',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    createTrendChart() {
        // Calculate accuracy for every 10 attempts
        const windowSize = 10;
        const trendData = [];
        const labels = [];

        for (let i = 0; i < this.attempts.length; i += windowSize) {
            const window = this.attempts.slice(i, i + windowSize);
            const correct = window.filter(a => a.isCorrect).length;
            const accuracy = Math.round((correct / window.length) * 100);
            trendData.push(accuracy);
            labels.push(`${i + 1}-${Math.min(i + windowSize, this.attempts.length)}`);
        }

        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Accuracy Trend',
                    data: trendData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 5,
                    pointBackgroundColor: '#e74c3c',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { stepSize: 10 }
                    }
                }
            }
        });
    }

    displayRecentAttempts() {
        const tbody = document.getElementById('attemptsBody');
        
        // Show last 20 attempts
        const recent = this.attempts.slice(-20).reverse();

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">No attempts yet</td></tr>';
            return;
        }

        const html = recent.map((attempt, idx) => {
            const resultClass = attempt.isCorrect ? 'correct' : 'incorrect';
            const resultText = attempt.isCorrect ? '✓ Correct' : '✗ Wrong';
            return `
            <tr class="${resultClass}-row">
                <td>${attempt.id || idx + 1}</td>
                <td>${this.getOperationDisplay(attempt.operation)}</td>
                <td>${attempt.question}</td>
                <td>${attempt.userAnswer}</td>
                <td>${attempt.correctAnswer}</td>
                <td>${attempt.timeTaken.toFixed(2)}</td>
                <td class="result-cell"><span class="result-badge ${resultClass}">${resultText}</span></td>
            </tr>
        `).join('');

        tbody.innerHTML = html;
    }

    exportData() {
        if (this.attempts.length === 0) {
            alert('📊 No data to export');
            return;
        }

        const dataStr = JSON.stringify({
            exportDate: new Date().toISOString(),
            totalAttempts: this.attempts.length,
            attempts: this.attempts
        }, null, 2);
        
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `math-drill-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        alert('📥 Data exported successfully!');
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
        document.getElementById('overallAccuracy').textContent = (stats.accuracy || 0) + '%';
        document.getElementById('avgTime').textContent = (stats.avgTime || 0) + 's';

        // Display operation stats
        const byOperation = stats.byOperation || {};
        const statsHtml = Object.entries(byOperation).map(([op, data]) => {
            const opDisplay = this.getOperationDisplay(op);
            return `
                <div class="operation-stat-card">
                    <h3>${opDisplay}</h3>
                    <div class="stat-row">
                        <span>Attempts:</span> <strong>${data.count}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Correct:</span> <strong>${data.correct}/${data.count}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Accuracy:</span> <strong>${Math.round(data.accuracy)}%</strong>
                    </div>
                    <div class="stat-row">
                        <span>Avg Time:</span> <strong>${data.avgTime.toFixed(2)}s</strong>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('operationStats').innerHTML = statsHtml || '<p>No data available</p>';

        // Load attempts for recent table
        this.loadFromLocalStorage();
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

    showEmptyState() {
        document.getElementById('totalProblems').textContent = '0';
        document.getElementById('correctAnswers').textContent = '0';
        document.getElementById('overallAccuracy').textContent = '0%';
        document.getElementById('avgTime').textContent = '0.0s';
        document.getElementById('currentStreak').textContent = '0';
        document.getElementById('bestAccuracy').textContent = '0%';
        document.getElementById('operationStats').innerHTML = '<p class="loading">📊 No practice attempts yet. Start practicing to see your statistics!</p>';
        document.getElementById('attemptsBody').innerHTML = '<tr><td colspan="7" class="loading">No attempts yet</td></tr>';
    }

    clearAllData() {
        if (confirm('Are you sure you want to delete all practice data? This cannot be undone.')) {
            localStorage.removeItem('mathDrillAttempts');
            
            // Clear on Python backend too
            if (typeof pybridge !== 'undefined' && pybridge) {
                const message = JSON.stringify({
                    type: 'clear_attempts',
                    payload: {}
                });
                pybridge.sendMessage(message);
            }
            
            this.attempts = [];
            this.showEmptyState();
            alert('🗑️ All data has been cleared!');
        }
    }
}

// Handle messages from Python backend
function handleBackendMessage(message) {
    try {
        const data = JSON.parse(message);
        
        if (data.type === 'statistics_response' && window.analyticsManager) {
            window.analyticsManager.displayStatisticsFromBackend(data.payload);
        }
    } catch (e) {
        console.error('Error handling backend message:', e);
    }
}

// Initialize Analytics Manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.analyticsManager = new AnalyticsManager();
});
