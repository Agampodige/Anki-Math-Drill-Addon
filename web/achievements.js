document.addEventListener('DOMContentLoaded', () => {
    const achievementsList = document.getElementById('achievementsList');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Achievement Definitions
    const achievements = [
        {
            id: 'beginner',
            title: 'Math Rookie',
            description: 'Answer your first question correctly.',
            icon: '🌱',
            condition: (stats) => stats.lifetimeCount >= 1
        },
        {
            id: 'streak_10',
            title: 'On Fire',
            description: 'Reach a streak of 10 correct answers.',
            icon: '🔥',
            condition: (stats) => stats.maxStreak >= 10
        },
        {
            id: 'accuracy_master',
            title: 'Precision',
            description: 'Maintain 90% accuracy over 50 questions.',
            icon: '🎯',
            condition: (stats) => stats.lifetimeCount >= 50 && stats.accuracy >= 90
        },
        {
            id: 'speed_demon',
            title: 'Speed Demon',
            description: 'Answer a question in under 2 seconds.',
            icon: '⚡',
            condition: (stats) => stats.bestSpeed <= 2.0 && stats.bestSpeed > 0
        },
        {
            id: 'veteran',
            title: 'Math Veteran',
            description: 'Answer 100 questions total.',
            icon: '🎖️',
            condition: (stats) => stats.lifetimeCount >= 100
        }
    ];

    // Function to load stats
    async function loadStats() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn('Failed to load stats from API, falling back to localStorage:', error);
            // Fallback to localStorage (shared with index.html/script.js)
            return {
                lifetimeCount: parseInt(localStorage.getItem('mathDrill_lifetimeCount') || '0'),
                maxStreak: parseInt(localStorage.getItem('mathDrill_maxStreak') || '0'),
                accuracy: parseFloat(localStorage.getItem('mathDrill_accuracy') || '0'),
                bestSpeed: parseFloat(localStorage.getItem('mathDrill_bestSpeed') || '0')
            };
        }
    }

    function renderAchievements(stats) {
        achievementsList.innerHTML = '';
        
        achievements.forEach(ach => {
            const unlocked = ach.condition(stats);
            const card = document.createElement('div');
            // Reusing weakness-card styles if available, or falling back to generic styling
            card.className = `weakness-card ${unlocked ? 'low-weakness' : 'unpracticed'}`;
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            
            card.innerHTML = `
                <div class="weakness-info">
                    <h4 style="display: flex; align-items: center; gap: 8px;">
                        <span>${ach.icon}</span> ${ach.title}
                    </h4>
                    <p>${ach.description}</p>
                </div>
                <div class="weakness-score">
                    ${unlocked ? '✅' : '🔒'}
                </div>
            `;
            
            achievementsList.appendChild(card);
        });
    }

    // Initialize
    loadStats()
        .then(stats => renderAchievements(stats))
        .catch(err => {
            console.error('Error loading achievements:', err);
            achievementsList.innerHTML = '<p>Unable to load achievements.</p>';
        })
        .finally(() => {
            if (loadingSpinner) loadingSpinner.style.display = 'none';
        });
});